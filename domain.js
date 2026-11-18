import { CAKES, COOKIES, productCategory, SAVORY_MEALS, SHOP_CATEGORIES, SIGN_CATALOG, SWEET_BREADS } from './menu-catalog.js';
import { PRODUCT_PHOTOS } from './product-photos.js';

export const MAX_STOCK = 19;
export const stockLimit = product => product.stockLimit ?? MAX_STOCK;
export const round = n => Math.round((n + Number.EPSILON) * 1000) / 1000;
const RESERVED_STATUSES = new Set(['pending','accepted','ready']);
export function reserved(state, productId) {
  return (state.orders || []).filter(o => RESERVED_STATUSES.has(o.status)).reduce((total,o) => total + o.items.filter(i=>i.productId===productId).reduce((sum,i)=>sum+i.quantity,0),0);
}
export function available(state, product) { return product.publicStock ? product.stock : Math.max(0, product.stock - reserved(state, product.id)); }
const id = () => crypto.randomUUID();
const fail = message => { throw new Error(message); };
const numeric = (n, name, min = 0, integer = false) => {
  if (!Number.isFinite(n) || n < min || (integer && !Number.isSafeInteger(n))) fail(`${name} must be ${integer ? 'a whole number' : 'a number'} of at least ${min}.`);
  if (n > 1e9) fail(`${name} is too large.`);
  if (Math.abs(round(n) - n) > 1e-8) fail(`${name} supports up to 3 decimal places.`);
};
const text = (v, name, max = 120) => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) fail(`${name} is required (up to ${max} characters).`);
  return v.trim();
};
export function validateRecipe(state, recipe) {
  if (!Array.isArray(recipe) || !recipe.length) fail('Add at least one ingredient to the recipe.');
  const seen = new Set();
  for (const row of recipe) {
    const ingredient = state.ingredients.find(i => i.id === row.ingredientId);
    if (!ingredient) fail('Choose an existing ingredient for every recipe row.');
    if (seen.has(row.ingredientId)) fail('Each ingredient can appear only once in a recipe.');
    seen.add(row.ingredientId);
    numeric(row.amount, `${ingredient.name} quantity`, 0.001, ingredient.unit === 'pcs');
  }
  return recipe;
}
export function requirements(state, recipe, quantity) {
  validateRecipe(state, recipe);
  numeric(quantity, 'Product quantity', 0, true);
  return recipe.map(row => {
    const i = state.ingredients.find(i => i.id === row.ingredientId);
    const required = round(row.amount * quantity);
    return { ingredientId: i.id, name: i.name, unit: i.unit, available: i.quantity, required, remaining: round(i.quantity - required), enough: round(i.quantity - required) >= 0 };
  });
}
export function capacity(state, product) {
  if (!product.recipe.length) return 0;
  return Math.max(0, Math.min(stockLimit(product) - product.stock, ...product.recipe.map(r => Math.floor(Math.round((state.ingredients.find(i => i.id === r.ingredientId)?.quantity ?? 0) * 1000) / Math.round(r.amount * 1000)))));
}
function log(state, type, title, changes = []) {
  state.activity.unshift({ id: id(), type, title, changes, at: new Date().toISOString() });
}
function consume(state, recipe, quantity, title) {
  const rows = requirements(state, recipe, quantity);
  const insufficient = rows.filter(r => !r.enough);
  if (insufficient.length) fail(`Not enough ingredients: ${insufficient.map(r => `${r.name} needs ${r.required} ${r.unit}, only ${r.available} ${r.unit} available`).join('; ')}. No stock or inventory was changed.`);
  for (const row of rows) state.ingredients.find(i => i.id === row.ingredientId).quantity = row.remaining;
  if (quantity) log(state, 'production', title, rows.map(r => ({ name: r.name, amount: -r.required, unit: r.unit })));
}
function validateProduct(state, product, existingId) {
  if(product.stockLimit!==undefined){numeric(product.stockLimit,'Stock capacity',1,true);if(product.stockLimit>10000)fail('Stock capacity cannot exceed 10,000 units.');if(product.stockLimit<product.stock)fail('Stock capacity cannot be lower than current stock.');}
  product.name = text(product.name, 'Product name');
  product.category = text(product.category, 'Category', 60);
  product.category = productCategory(product);
  if (!SHOP_CATEGORIES.includes(product.category)) fail('Choose a menu category.');
  product.description = text(product.description, 'Description', 1000);
  numeric(product.price, 'Price', 0.01);
  if (Math.abs(product.price * 100 - Math.round(product.price * 100)) > 1e-8) fail('Price supports up to 2 decimal places.');
  if (state.products.some(p => p.id !== existingId && p.name.toLowerCase() === product.name.toLowerCase())) fail('A product with this name already exists.');
  if (typeof product.image !== 'string' || !(/^(assets\/facebook\/[a-f0-9]+\.jpg|assets\/menu-signs\/(crinkles-matcha|ensaymada-cinnamon-flavors|ensaymada-cinnamon-prices|yema-banana)\.png|\/api\/shop\?op=image&id=[a-f0-9]{64})$/.test(product.image) || /^data:image\/(jpeg|png|webp);base64,/.test(product.image))) fail('Choose a product photo or upload a JPEG, PNG, or WebP image.');
  if (product.recipePending && product.stock===0 && Array.isArray(product.recipe) && !product.recipe.length) return;
  validateRecipe(state, product.recipe);
  delete product.recipePending;
}
export function transition(current, action) {
  const state = structuredClone(current);
  state.orders ||= [];
  switch (action.type) {
    case 'addAnnouncement':
    case 'editAnnouncement': {
      if(typeof action.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(action.id))fail('Invalid announcement identifier.');
      state.announcements ||= [];
      const current=state.announcements.find(item=>item.id===action.id);
      if(action.type==='addAnnouncement'&&current)return state;
      if(action.type==='editAnnouncement'&&!current)fail('Announcement no longer exists.');
      const input=action.announcement||{};
      const title=text(input.title,'Announcement title',120),body=text(input.body,'Announcement text',5000);
      if(typeof input.published!=='boolean'||typeof input.pinned!=='boolean')fail('Choose valid announcement visibility and pin settings.');
      const now=new Date().toISOString();
      const entry={id:action.id,title,body,published:input.published,pinned:input.pinned,createdAt:current?.createdAt||now,updatedAt:now,publishedAt:current?.publishedAt||null};
      if(entry.published&&!entry.publishedAt)entry.publishedAt=now;
      if(current)Object.assign(current,entry);else state.announcements.unshift(entry);
      log(state,'announcement',`${entry.published?'Published':'Saved draft'}: ${entry.title}`);
      break;
    }
    case 'toggleAnnouncement': {
      const entry=(state.announcements||[]).find(item=>item.id===action.id);
      if(!entry)fail('Announcement no longer exists.');
      entry.published=!entry.published;entry.updatedAt=new Date().toISOString();
      if(entry.published&&!entry.publishedAt)entry.publishedAt=entry.updatedAt;
      log(state,'announcement',`${entry.published?'Published':'Unpublished'}: ${entry.title}`);
      break;
    }
    case 'applyProductPhotos': {
      let changed=0;
      for(const product of state.products){
        const photo=PRODUCT_PHOTOS[product.id];
        if(photo && product.image.startsWith('assets/menu-signs/')){product.image=photo.image;changed++;}
      }
      if(!changed)return state;
      log(state,'product',`Updated ${changed} products with verified Facebook photographs`);
      break;
    }
    case 'importSignCatalog': {
      let added=0;
      for (const item of SIGN_CATALOG) {
        if (state.products.some(product=>product.id===item.id || product.name.toLowerCase()===item.name.toLowerCase())) continue;
        const product={...item,active:true,stock:0,recipe:[],recipePending:true};
        validateProduct(state,product);
        state.products.push(product);
        added++;
      }
      if (!added) return state;
      log(state,'product',`Added ${added} products from the menu signs with zero stock; recipes need setup`);
      break;
    }
    case 'submitOrder': {
      const requestId = text(action.requestId, 'Request ID', 80);
      if (state.orders.some(o=>o.id===requestId)) return state;
      if (!Array.isArray(action.items) || !action.items.length) fail('Your basket is empty.');
      const seen = new Set();
      const items = action.items.map(row=>{
        const p=state.products.find(p=>p.id===row.productId && p.active);
        if(!p) fail('An item is no longer available. Please update your basket.');
        if(seen.has(p.id)) fail('A product can appear only once in an order.');
        seen.add(p.id);
        numeric(row.quantity, 'Order quantity', 1, true);
        if(row.quantity>available(state,p)) fail(`${p.name} has only ${available(state,p)} units available. Please update your basket.`);
        if(row.unitPrice!==p.price) fail(`The price of ${p.name} changed. Review and refresh your basket prices before submitting.`);
        return {productId:p.id,name:p.name,unitPrice:p.price,quantity:row.quantity,portion:p.portion || 'per product',image:p.image,lineTotal:Math.round(p.price*100)*row.quantity/100};
      });
      const customer=action.customer || {};
      const name=text(customer.name,'Customer name');
      const phone=text(customer.phone,'Phone number',30);
      if(!/^[+\d\s()-]+$/.test(phone) || phone.replace(/\D/g,'').length<7 || phone.replace(/\D/g,'').length>15) fail('Enter a valid contact phone number (7–15 digits).');
      if(!['pickup','delivery'].includes(customer.fulfillment)) fail('Choose pickup or delivery.');
      const address=customer.fulfillment==='delivery'?text(customer.address,'Delivery address',500):'';
      const notes=typeof customer.notes==='string'?customer.notes.trim():'';
      if(notes.length>1000)fail('Order notes support up to 1,000 characters.');
      const sequence=Math.max(0,...state.orders.map(o=>o.sequence))+1;
      const order={id:requestId,sequence,reference:`GD-${String(sequence).padStart(4,'0')}`,status:'pending',items,total:items.reduce((sum,i)=>sum+Math.round(i.lineTotal*100),0)/100,customer:{name,phone,fulfillment:customer.fulfillment,address,notes},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),adminNote:''};
      state.orders.unshift(order);
      log(state,'order',`${order.reference}: new order request — ${items.reduce((sum,i)=>sum+i.quantity,0)} units reserved`);
      break;
    }
    case 'updateOrder': {
      const order=state.orders.find(o=>o.id===action.id);
      if(!order)fail('Order no longer exists.');
      const allowed={pending:['accepted','declined','cancelled'],accepted:['ready','cancelled'],ready:['completed','cancelled']};
      if(!(allowed[order.status]||[]).includes(action.status))fail(`Cannot change a ${order.status} order to ${action.status}.`);
      if(!['admin','customer'].includes(action.actor))fail('Order action role is required.');
      if(action.actor==='customer' && !(order.status==='pending' && action.status==='cancelled'))fail('Only pending requests can be cancelled by the customer.');
      const note=typeof action.note==='string'?action.note.trim():'';
      if(note.length>500)fail('Admin note supports up to 500 characters.');
      if(action.actor==='admin' && ['declined','cancelled'].includes(action.status) && !note)fail('Add a reason for declining or cancelling this order.');
      if(action.status==='completed'){
        for(const item of order.items){
          const p=state.products.find(p=>p.id===item.productId);
          if(!p || p.stock<item.quantity)fail('Finished stock is insufficient to complete this order. No stock was changed.');
          p.stock-=item.quantity;
        }
      }
      order.status=action.status;
      order.updatedAt=new Date().toISOString();
      if(action.actor==='admin')order.adminNote=note;
      log(state,'order',`${order.reference}: ${action.status}${action.status==='completed'?' — finished stock deducted; ingredients unchanged':''}${['declined','cancelled'].includes(action.status)?' — reservation released':''}`);
      break;
    }
    case 'addProduct': {
      const p = { ...action.product, id: id(), active: true };
      validateProduct(state, p);
      numeric(p.stock, 'Initial stock', 0, true);
      if (p.stock > stockLimit(p)) fail(`Product stock exceeds capacity (maximum ${stockLimit(p)}).`);
      consume(state, p.recipe, p.stock, `Made ${p.stock} × ${p.name} (initial stock)`);
      state.products.push(p);
      log(state, 'product', `Added ${p.name}`);
      break;
    }
    case 'editProduct': {
      const p = state.products.find(p => p.id === action.id);
      if (!p) fail('Product no longer exists.');
      const next = { ...p, ...action.product, id: p.id, stock: p.stock, active: p.active };
      validateProduct(state, next, p.id);
      Object.assign(p, next);
      if (!next.recipePending) delete p.recipePending;
      log(state, 'recipe', `Updated ${p.name}; recipe applies to future batches`);
      break;
    }
    case 'produce': {
      const p = state.products.find(p => p.id === action.id);
      if (!p) fail('Product no longer exists.');
      numeric(action.quantity, 'Batch quantity', 1, true);
      if (p.stock + action.quantity > stockLimit(p)) fail(`Maximum ${stockLimit(p)} units for this product. You can add at most ${stockLimit(p) - p.stock}.`);
      consume(state, p.recipe, action.quantity, `Made ${action.quantity} × ${p.name}`);
      p.stock += action.quantity;
      break;
    }
    case 'removeStock': {
      const p = state.products.find(p => p.id === action.id);
      if (!p) fail('Product no longer exists.');
      numeric(action.quantity, 'Removed quantity', 1, true);
      if (action.quantity > available(state,p)) fail('Cannot remove more units than unreserved stock. Reserved units belong to pending or accepted orders.');
      const reason = text(action.reason, 'Reason', 180);
      p.stock -= action.quantity;
      log(state, 'adjustment', `Removed ${action.quantity} × ${p.name}: ${reason}. Ingredients are not returned.`);
      break;
    }
    case 'toggleProduct': {
      const p = state.products.find(p => p.id === action.id);
      if (!p) fail('Product no longer exists.');
      p.active = !p.active;
      log(state, 'product', `${p.active ? 'Published' : 'Hid'} ${p.name}`);
      break;
    }
    case 'addIngredient': {
      const i = { ...action.ingredient, id: id() };
      i.name = text(i.name, 'Ingredient name');
      if (!['g', 'ml', 'pcs'].includes(i.unit)) fail('Choose g, ml, or pcs as the base unit.');
      numeric(i.quantity, 'Opening quantity', 0, i.unit === 'pcs');
      numeric(i.threshold, 'Low stock threshold', 0, i.unit === 'pcs');
      if (state.ingredients.some(x => x.name.toLowerCase() === i.name.toLowerCase())) fail('An ingredient with this name already exists.');
      state.ingredients.push(i);
      log(state, 'ingredient', `Added ${i.name}`, [{ name: i.name, amount: i.quantity, unit: i.unit }]);
      break;
    }
    case 'receiveIngredient': {
      const i = state.ingredients.find(i => i.id === action.id);
      if (!i) fail('Ingredient no longer exists.');
      numeric(action.quantity, 'Received quantity', 0.001, i.unit === 'pcs');
      numeric(i.quantity + action.quantity, 'Total inventory', 0, i.unit === 'pcs');
      i.quantity = round(i.quantity + action.quantity);
      log(state, 'receipt', `Received ${i.name}`, [{ name: i.name, amount: action.quantity, unit: i.unit }]);
      break;
    }
    case 'adjustIngredient': {
      const i = state.ingredients.find(i => i.id === action.id);
      if (!i) fail('Ingredient no longer exists.');
      numeric(action.quantity, 'Corrected quantity', 0, i.unit === 'pcs');
      numeric(action.threshold, 'Low stock threshold', 0, i.unit === 'pcs');
      const reason = text(action.reason, 'Adjustment reason', 180);
      const delta = round(action.quantity - i.quantity);
      i.quantity = action.quantity;
      i.threshold = action.threshold;
      log(state, 'adjustment', `Inventory count: ${i.name} — ${reason}`, [{ name: i.name, amount: delta, unit: i.unit }]);
      break;
    }
    default: fail('Unknown operation.');
  }
  state.revision++;
  return state;
}
export function createSeed() {
  const ingredients = [
    ['flour', 'All-purpose flour', 'g', 18000, 2000],
    ['sugar', 'Sugar', 'g', 12000, 1500],
    ['butter', 'Butter', 'g', 6000, 1000],
    ['eggs', 'Eggs', 'pcs', 120, 20],
    ['banana', 'Ripe bananas', 'g', 10000, 1500],
    ['chocolate', 'Chocolate', 'g', 6500, 1000],
    ['milk', 'Milk', 'ml', 8000, 1000],
    ['ube', 'Ube jam', 'g', 4500, 800],
    ['pork', 'Ground pork', 'g', 6500, 1000],
    ['wrappers', 'Lumpia wrappers', 'pcs', 250, 30],
    ['vegetables', 'Mixed vegetables', 'g', 6000, 1000],
    ['chicken', 'Chicken', 'g', 10000, 1500],
    ['rice', 'Rice', 'g', 14000, 2000]
  ].map(([id, name, unit, quantity, threshold]) => ({ id, name, unit, quantity, threshold }));
  const recipe = (...rows) => rows.map(([ingredientId, amount]) => ({ ingredientId, amount }));
  const products = [
    { id: 'banana-loaf', name: 'Loaded Banana Bread', category: SWEET_BREADS, price: 180, stock: 8, image: 'assets/facebook/a354c03220336924.jpg', description: 'A moist banana loaf topped with chocolate and nuts. A little homemade happiness to share.', portion: '1 loaf', recipe: recipe(['flour',200],['sugar',100],['butter',60],['eggs',2],['banana',250],['chocolate',30]) },
    { id: 'chocolate-cake', name: 'Chocolate Celebration Cake', category: CAKES, price: 650, stock: 3, image: 'assets/facebook/d48aa4ba35954fb9.jpg', description: 'Rich chocolate cake with a generous swirl of cream and chocolate drizzle. Made for sweet celebrations.', portion: '1 whole cake', recipe: recipe(['flour',250],['sugar',200],['butter',100],['eggs',3],['chocolate',200],['milk',150]) },
    { id: 'ube-cake', name: 'Ube Celebration Cake', category: CAKES, price: 600, stock: 2, image: 'assets/facebook/f86ca2cd7d4f8442.jpg', description: 'A beautiful purple celebration cake for bringing everyone together around the table.', portion: '1 whole cake', recipe: recipe(['flour',250],['sugar',180],['butter',100],['eggs',3],['ube',200],['milk',150]) },
    { id: 'cookies', name: 'Chocolate Chip Cookies', category: COOKIES, price: 120, stock: 12, image: 'assets/facebook/b511fbfde20f8301.jpg', description: 'Golden homemade cookies dotted with chocolate. An easy treat for a cozy afternoon.', portion: '1 pack', recipe: recipe(['flour',100],['sugar',60],['butter',50],['eggs',1],['chocolate',50]) },
    { id: 'lumpia', name: 'Crispy Lumpia Platter', category: SAVORY_MEALS, price: 280, stock: 5, image: 'assets/facebook/d63443ed617e749b.jpg', description: 'Golden, crispy rolls arranged for sharing. A savory favorite for snacks and gatherings.', portion: '1 platter · 20 pieces', recipe: recipe(['pork',300],['vegetables',100],['wrappers',20]) },
    { id: 'family-tray', name: 'Family Sharing Tray', category: SAVORY_MEALS, price: 850, stock: 0, image: 'assets/facebook/14989151db935458.jpg', description: 'A generous selection of savory dishes for a family meal. A table full of good food and good company.', portion: '1 family tray', recipe: recipe(['chicken',800],['pork',300],['vegetables',400],['rice',600]) }
  ].map(p => ({ ...p, active: true }));
  const state = { version: 1, revision: 0, ingredients, products, activity: [], orders: [] };
  log(state, 'setup', 'Sample ingredient inventory loaded; opening quantities recorded before sample production.');
  for (const p of products) consume(state, p.recipe, p.stock, `Sample opening batch: ${p.stock} × ${p.name}`);
  return state;
}
