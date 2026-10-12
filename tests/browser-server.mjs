// Isolated, memory-only UI verification server. Never part of the Vercel build.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHandler } from '../api/shop.js';
import { testDatabase } from './database-helper.mjs';
import { createSeed } from '../domain.js';
import { hashPassword } from '../lib/auth.js';
const db=await testDatabase();
await db.query('UPDATE shop_state SET data=$1::jsonb WHERE id=1',[JSON.stringify(createSeed())]);
const handler=createHandler(()=>db,{APP_ORIGIN:'http://localhost:4180',ADMIN_EMAIL:'test@example.test',ADMIN_PASSWORD_HASH:await hashPassword('Browser-test-only-123!')});
const allowed=new Set(['index.html','app.js','domain.js','orders-ui.js','styles.css','orders.css','sw.js','manifest.webmanifest']);
http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/api/shop')return handler(req,res);
  const file=path==='/'?'index.html':path.slice(1);
  if((!allowed.has(file)&&!/^assets\/[a-zA-Z0-9/_.-]+$/.test(file))||file.includes('..')){res.writeHead(404);res.end();return;}
  try{const bytes=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.webmanifest')?'application/manifest+json':'image/svg+xml');res.end(bytes);}catch{res.writeHead(404);res.end();}
}).listen(4180,'127.0.0.1',()=>console.log('Isolated UI test server: http://localhost:4180'));
