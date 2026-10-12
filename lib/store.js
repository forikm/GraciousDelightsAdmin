import { transition, available } from '../domain.js';
import { digest } from './auth.js';
export const problem = (status, message) => Object.assign(new Error(message), {status});
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const adminActions = new Set(['addProduct','editProduct','produce','removeStock','toggleProduct','addIngredient','receiveIngredient','adjustIngredient']);
export function present(state, identity) {
  const result = structuredClone(state);
  result.admin = identity.admin;
  result.myOrderIds = state.orders.filter(o=>o.owner===identity.owner).map(o=>o.id);
  if (!identity.admin) {
    result.products = state.products.filter(p=>p.active).map(p=>({
      id:p.id,name:p.name,description:p.description,category:p.category,portion:p.portion,
      price:p.price,image:p.image,active:true,stock:available(state,p),publicStock:true
    }));
    result.ingredients=[]; result.activity=[];
    result.orders = result.orders.filter(o=>o.owner===identity.owner);
  }
  result.orders.forEach(o=>delete o.owner);
  return result;
}
export async function readState(db, identity) {
  const {rows} = await db.query('SELECT data FROM shop_state WHERE id=1');
  if (!rows[0]) throw problem(503,'Run the database migration before opening the shop.');
  return present(rows[0].data, identity);
}
export async function mutate(pool, identity, input) {
  const action = structuredClone(input.action);
  if (!action || typeof action.type !== 'string') throw problem(400,'Choose a valid operation.');
  if (!['submitOrder','updateOrder'].includes(action.type) && (!identity.admin || !adminActions.has(action.type))) throw problem(403,'Admin sign-in is required.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Every inventory/order mutation holds this lock until commit: no overselling or partial recipes.
    const {rows} = await client.query('SELECT data FROM shop_state WHERE id=1 FOR UPDATE');
    const current = rows[0]?.data;
    if (!current) throw problem(503,'Run the database migration before opening the shop.');
    if (action.type === 'submitOrder') {
      if (!uuid.test(action.requestId)) throw problem(400,'Invalid request identifier.');
      const existing = current.orders.find(o=>o.id===action.requestId);
      if (existing) {
        if (existing.owner !== identity.owner) throw problem(409,'Request identifier already in use.');
        await client.query('COMMIT');
        return present(current, identity);
      }
      if (current.orders.filter(o=>o.owner===identity.owner && ['pending','accepted','ready'].includes(o.status)).length >= 5) throw problem(429,'You already have five open requests. Please wait for the kitchen to respond.');
      if (!Array.isArray(action.items) || action.items.length > 50) throw problem(400,'An order can contain up to 50 different products.');
    } else if (action.type === 'updateOrder') {
      const order = current.orders.find(o=>o.id===action.id);
      if (!order || (!identity.admin && order.owner!==identity.owner)) throw problem(404,'Order not found.');
      // Never trust a role sent by the browser.
      action.actor = identity.admin ? 'admin' : 'customer';
      if (!identity.admin) action.note = '';
    }
    if (identity.admin && action.type !== 'submitOrder' && input.revision !== current.revision) throw problem(409,'The inventory or orders changed. Close and reopen this form to use the latest data.');
    if (action.product) {
      const p = action.product;
      action.product = Object.fromEntries(['name','category','description','portion','price','stock','image','recipe'].filter(k=>k in p).map(k=>[k,p[k]]));
      if (typeof p.image !== 'string' || p.image.length > 1100000) throw problem(400,'Please use a smaller product photo (up to 800 KB after compression).');
      if (p.image.startsWith('data:')) {
        const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(p.image);
        if (!match) throw problem(400,'Choose a valid JPEG, PNG or WebP image.');
        const bytes = Buffer.from(match[2], 'base64');
        if (bytes.length > 800000) throw problem(400,'Use a photo smaller than 800 KB after compression.');
        const magic = bytes.subarray(0,12);
        if (!(match[1]==='jpeg' && magic[0]===255 && magic[1]===216 || match[1]==='png' && magic.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || match[1]==='webp' && magic.toString('ascii',0,4)==='RIFF' && magic.toString('ascii',8,12)==='WEBP')) throw problem(400,'Invalid image contents.');
        const imageId = digest(bytes);
        await client.query('INSERT INTO product_images(id,mime,bytes) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[imageId,`image/${match[1]}`,bytes]);
        action.product.image = `/api/shop?op=image&id=${imageId}`;
      } else if (p.image.startsWith('/api/')) {
        const imageId = p.image.match(/^\/api\/shop\?op=image&id=([a-f0-9]{64})$/)?.[1];
        if (!imageId || !(await client.query('SELECT id FROM product_images WHERE id=$1',[imageId])).rows.length) throw problem(400,'Product photo not found.');
      }
    }
    if (action.ingredient) {
      const i=action.ingredient;
      action.ingredient={name:i.name,unit:i.unit,quantity:i.quantity,threshold:i.threshold};
    }
    let next;
    try { next = transition(current, action); } catch (error) { throw problem(400,error.message); }
    if (action.type==='submitOrder') next.orders.find(o=>o.id===action.requestId).owner=identity.owner;
    await client.query('UPDATE shop_state SET data=$1::jsonb,updated_at=now() WHERE id=1',[JSON.stringify(next)]);
    await client.query('COMMIT');
    return present(next, identity);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
