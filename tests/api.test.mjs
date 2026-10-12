import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createHandler } from '../api/shop.js';
import { hashPassword } from '../lib/auth.js';
import { createSeed, available } from '../domain.js';
import { testDatabase } from './database-helper.mjs';

test('database-backed customer/admin flow, access control, atomic inventory and retry safety',async t=>{
  const db=await testDatabase();
  const env={ADMIN_EMAIL:'owner@example.test',ADMIN_PASSWORD_HASH:await hashPassword('Testing-only-password-123!')};
  const server=http.createServer(createHandler(()=>db,env,'customer'));
  const adminEnv={...env};
  const adminServer=http.createServer(createHandler(()=>db,adminEnv,'admin'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  await new Promise(resolve=>adminServer.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;env.APP_ORIGIN=origin;
  const adminOrigin=`http://127.0.0.1:${adminServer.address().port}`;adminEnv.APP_ORIGIN=adminOrigin;
  t.after(async()=>{await Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>adminServer.close(resolve))]);await db.close();});
  const client=(site=origin)=>{
    const jar=new Map();
    return async(op,body,options={})=>{
      const response=await fetch(`${site}/api/shop?op=${op}`,{method:body?'POST':'GET',headers:{Cookie:options.cookie||[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...(body?{'Content-Type':'application/json',Origin:options.origin||site}:{})},body:body?JSON.stringify(body):undefined});
      for(const c of response.headers.getSetCookie()){const [name,value]=c.split(';')[0].split('=');jar.set(name,value);}
      return {status:response.status,data:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.arrayBuffer(),headers:response.headers};
    };
  };
  const customer=client(),stranger=client(),admin=client(adminOrigin),signedOutAdmin=client(adminOrigin);
  const empty=await customer('state');assert.equal(empty.status,200);assert.deepEqual(empty.data.products,[]);
  assert.match(empty.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  assert.equal((await customer('mutate',{action:{type:'addIngredient',ingredient:{name:'x'}},revision:0})).status,403);
  assert.equal((await customer('login',{email:env.ADMIN_EMAIL,password:'Testing-only-password-123!'})).status,404);
  assert.equal((await signedOutAdmin('state')).status,401);
  assert.equal((await signedOutAdmin('login',{email:env.ADMIN_EMAIL,password:'wrong'})).status,401);
  assert.equal((await admin('login',{email:env.ADMIN_EMAIL,password:'Testing-only-password-123!'},{origin:'https://attacker.example'})).status,403);
  let result=await admin('login',{email:env.ADMIN_EMAIL,password:'Testing-only-password-123!'});assert.equal(result.status,200);assert.equal(result.data.admin,true);
  const adminCookie=result.headers.getSetCookie().find(c=>c.startsWith('gd_admin=')).split(';')[0];
  assert.equal((await stranger('state',undefined,{cookie:adminCookie})).data.admin,false);
  assert.equal((await stranger('mutate',{action:{type:'addIngredient'},revision:0},{cookie:adminCookie})).status,403);
  // Fixtures exist only inside this isolated test database.
  const seed=createSeed();await db.query('UPDATE shop_state SET data=$1::jsonb WHERE id=1',[JSON.stringify(seed)]);
  const stock=seed.products[0].stock,flour=seed.ingredients[0].quantity;
  const requestId=randomUUID();
  const action={type:'submitOrder',requestId,items:[{productId:'banana-loaf',quantity:2,unitPrice:180}],customer:{name:'Test Buyer',phone:'09060000000',fulfillment:'pickup'}};
  assert.equal((await admin('mutate',{action})).status,403);
  assert.equal((await admin('mutate',{action},{origin})).status,403);
  result=await customer('mutate',{action});assert.equal(result.status,200);assert.equal(result.data.orders.length,1);assert.equal(result.data.orders[0].total,360);
  assert.equal(result.data.products[0].stock,stock-2);assert.equal(available(result.data,result.data.products[0]),stock-2);
  assert.equal(result.data.ingredients.length,0);assert.equal(result.data.activity.length,0);assert.equal(result.data.products[0].recipe,undefined);assert.equal(result.data.orders[0].owner,undefined);
  assert.deepEqual(result.data.myOrderIds,[requestId]);
  assert.equal((await customer('mutate',{action})).data.orders.length,1);
  assert.equal((await stranger('state')).data.orders.length,0);
  assert.equal((await stranger('mutate',{action})).status,409);
  assert.equal((await stranger('mutate',{action:{type:'updateOrder',id:requestId,status:'cancelled',actor:'admin'}})).status,404);
  assert.equal((await customer('mutate',{action:{type:'updateOrder',id:requestId,status:'accepted',actor:'admin'}})).status,400);
  let snapshot=(await admin('state')).data;
  assert.equal(snapshot.orders.length,1);assert.equal(snapshot.products[0].stock,stock);assert.equal(snapshot.ingredients[0].quantity,flour);
  assert.equal((await admin('mutate',{action:{type:'produce',id:'banana-loaf',quantity:1},revision:-1})).status,409);
  assert.equal((await admin('mutate',{action:{type:'produce',id:'banana-loaf',quantity:19},revision:snapshot.revision})).status,400);
  assert.equal((await admin('state')).data.revision,snapshot.revision);
  for(const status of ['accepted','ready','completed']){
    result=await admin('mutate',{action:{type:'updateOrder',id:requestId,status,actor:'customer'},revision:snapshot.revision});assert.equal(result.status,200);snapshot=result.data;
  }
  assert.equal(snapshot.products[0].stock,stock-2);assert.equal(snapshot.ingredients[0].quantity,flour);
  assert.equal((await customer('state')).data.orders[0].status,'completed');
  result=await admin('mutate',{action:{type:'updateOrder',id:requestId,status:'completed'},revision:snapshot.revision});assert.equal(result.status,400);
  result=await admin('mutate',{action:{type:'produce',id:'banana-loaf',quantity:1},revision:snapshot.revision});assert.equal(result.status,200);snapshot=result.data;
  assert.equal(snapshot.ingredients[0].quantity,flour-200);
  // Two clients race for the same remaining stock: one wins and the other is rejected.
  const remaining=available(snapshot,snapshot.products[0]);
  const order=q=>({...action,requestId:randomUUID(),items:[{productId:'banana-loaf',quantity:q,unitPrice:180}]});
  const race=await Promise.all([customer('mutate',{action:order(remaining)}),stranger('mutate',{action:order(remaining)})]);
  assert.deepEqual(race.map(r=>r.status).sort(),[200,400]);
  const winner=race.find(r=>r.status===200).data.orders.find(o=>o.status==='pending');
  snapshot=(await admin('state')).data;
  result=await admin('mutate',{action:{type:'updateOrder',id:winner.id,status:'declined',note:'Test cancellation'},revision:snapshot.revision});assert.equal(result.status,200);
  assert.equal(available(result.data,result.data.products[0]),remaining);
  // Uploaded photos are stored separately and served through an immutable image endpoint.
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  snapshot=result.data;
  result=await admin('mutate',{action:{type:'editProduct',id:'banana-loaf',product:{...snapshot.products[0],image}},revision:snapshot.revision});assert.equal(result.status,200);
  const imageUrl=result.data.products[0].image;assert.match(imageUrl,/^\/api\/shop\?op=image/);
  const img=await fetch(origin+imageUrl);assert.equal(img.status,200);assert.equal(img.headers.get('content-type'),'image/png');
  await admin('logout',{});assert.equal((await admin('state')).status,401);
  assert.equal((await admin('mutate',{action:{type:'produce',id:'banana-loaf',quantity:1},revision:result.data.revision})).status,401);
  for(let i=0;i<10;i++)result=await signedOutAdmin('login',{email:'bad',password:'bad'});
  assert.equal(result.status,429);
});

test('unconfigured application fails closed instead of falling back to browser demo data',async()=>{
  const handler=createHandler(()=>{throw Object.assign(new Error('Database is not configured.'),{status:503});},{});
  const headers={};let body;
  const res={setHeader(k,v){headers[k]=v;},end(value){body=JSON.parse(value);}};
  await handler({url:'/api/shop',method:'GET',headers:{}},res);
  assert.equal(res.statusCode,503);assert.match(body.error,/not configured/);assert.equal(headers['Cache-Control'],'no-store');
});
