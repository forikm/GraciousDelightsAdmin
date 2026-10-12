import { getPool } from '../lib/db.js';
import { cookies, cookie, digest, randomToken, verifyPassword } from '../lib/auth.js';
import { readState, mutate, problem } from '../lib/store.js';
import { SITE_ROLE } from '../lib/site.js';

export function createHandler(getDb=getPool, env=process.env, role=SITE_ROLE) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const send = (status,body) => {res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
    try {
      const secure = !!env.VERCEL || env.APP_ORIGIN?.startsWith('https:');
      const url = new URL(req.url,'http://localhost');
      const op=url.searchParams.get('op') || 'state';
      if (!['customer','admin'].includes(role)) throw problem(503,'Invalid site configuration.');
      if (role==='customer' && ['login','logout'].includes(op)) throw problem(404,'Admin sign-in is available only on the admin website.');
      if (!['GET','POST'].includes(req.method)) throw problem(405,'Method not allowed.');
      if (req.method==='POST') {
        const origin = env.APP_ORIGIN || `${secure?'https':'http'}://${req.headers.host}`;
        if (req.headers.origin!==origin || !req.headers['content-type']?.startsWith('application/json')) throw problem(403,'Only same-site JSON requests are accepted.');
      }
      const db=getDb();
      if (op==='image' && req.method==='GET') {
        const id=url.searchParams.get('id');
        if (!/^[a-f0-9]{64}$/.test(id || '')) throw problem(404,'Image not found.');
        const {rows}=await db.query('SELECT mime,bytes FROM product_images WHERE id=$1',[id]);
        if (!rows[0]) throw problem(404,'Image not found.');
        res.setHeader('Content-Type',rows[0].mime);res.setHeader('Cache-Control','public,max-age=31536000,immutable');
        res.end(rows[0].bytes);return;
      }
      const incoming=cookies(req.headers.cookie);
      const guest=/^[a-f0-9]{64}$/.test(incoming.gd_guest || '') ? incoming.gd_guest : randomToken();
      const setCookies=[];
      if (guest!==incoming.gd_guest) setCookies.push(cookie('gd_guest',guest,60*60*24*90,secure));
      const identity={owner:digest(guest),admin:false};
      const credentialVersion=digest(`admin:${env.ADMIN_EMAIL}:${env.ADMIN_PASSWORD_HASH}`);
      if (role==='admin' && /^[a-f0-9]{64}$/.test(incoming.gd_admin || '')) {
        identity.admin=!!(await db.query('SELECT token_hash FROM admin_sessions WHERE token_hash=$1 AND credential_version=$2 AND expires_at>now()',[digest(incoming.gd_admin),credentialVersion])).rows.length;
      }
      const rateLimit=async (scope,max) => {
        // Vercel supplies the client address. Socket address is used by the local server.
        const address=env.VERCEL?String(req.headers['x-forwarded-for'] || '').split(',')[0].trim():req.socket?.remoteAddress || 'local';
        const key=digest(`${scope}:${address}`);
        const {rows}=await db.query(`INSERT INTO request_limits(key,count,expires_at) VALUES($1,1,now()+interval '15 minutes')
          ON CONFLICT(key) DO UPDATE SET count=CASE WHEN request_limits.expires_at<now() THEN 1 ELSE request_limits.count+1 END,
          expires_at=CASE WHEN request_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE request_limits.expires_at END RETURNING count`,[key]);
        if (rows[0].count>max) {res.setHeader('Retry-After','900');throw problem(429,'Too many attempts. Please try again in 15 minutes.');}
      };
      let body={};
      if (req.method==='POST') {
        if (req.body!==undefined) body=typeof req.body==='string'?JSON.parse(req.body):req.body;
        else {
          const chunks=[];let size=0;
          for await (const chunk of req) {size+=chunk.length;if(size>1200000)throw problem(413,'Request is too large.');chunks.push(chunk);}
          body=JSON.parse(Buffer.concat(chunks).toString() || '{}');
        }
        if (!body || typeof body!=='object' || JSON.stringify(body).length>1200000) throw problem(413,'Request is too large.');
      }
      let result;
      if (role==='admin' && ['state','mutate'].includes(op) && !identity.admin) throw problem(401,'Admin sign-in is required.');
      if (role==='admin' && op==='mutate' && body.action?.type==='submitOrder') throw problem(403,'Place customer orders on the customer website.');
      if (op==='state' && req.method==='GET') result=await readState(db,identity);
      else if (op==='login' && req.method==='POST') {
        if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH) throw problem(503,'Admin sign-in has not been configured.');
        await rateLimit('login',8);
        const passwordOK=await verifyPassword(body.password,env.ADMIN_PASSWORD_HASH);
        if (typeof body.email!=='string' || body.email.toLowerCase()!==env.ADMIN_EMAIL.toLowerCase() || !passwordOK) throw problem(401,'Incorrect email or password.');
        const token=randomToken();
        await db.query('DELETE FROM admin_sessions WHERE expires_at<now()');
        await db.query("INSERT INTO admin_sessions(token_hash,credential_version,expires_at) VALUES($1,$2,now()+interval '8 hours')",[digest(token),credentialVersion]);
        identity.admin=true;setCookies.push(cookie('gd_admin',token,60*60*8,secure));
        result=await readState(db,identity);
      } else if (op==='logout' && req.method==='POST') {
        if (incoming.gd_admin) await db.query('DELETE FROM admin_sessions WHERE token_hash=$1',[digest(incoming.gd_admin)]);
        setCookies.push(cookie('gd_admin','',0,secure));identity.admin=false;result=await readState(db,identity);
      } else if (op==='mutate' && req.method==='POST') {
        if (body.action?.type==='submitOrder') {
          if (guest!==incoming.gd_guest) throw problem(400,'Cookies are required to place and track an order. Reload the page and try again.');
          await rateLimit('orders',30);
        }
        result=await mutate(db,identity,body);
      } else throw problem(404,'Endpoint not found.');
      if (setCookies.length) res.setHeader('Set-Cookie',setCookies);
      send(200,result);
    } catch (error) {
      const status=error.status || (error instanceof SyntaxError?400:503);
      send(status,{error:error.status?error.message:status===400?'Invalid JSON request.':'The shop is temporarily unavailable. Please try again later.'});
      if (!error.status && !(error instanceof SyntaxError)) console.error('Shop request failed:',error.code || error.name);
    }
  };
}
export default createHandler();
