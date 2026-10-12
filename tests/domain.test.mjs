import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, transition, requirements, capacity, available, reserved } from '../domain.js';

const sampleProduct = () => ({ name:'Test banana loaf',category:'Test category',price:100,stock:2,description:'A test loaf',portion:'1 loaf',image:'assets/facebook/a354c03220336924.jpg',recipe:[{ingredientId:'flour',amount:100},{ingredientId:'eggs',amount:1}] });
test('seed has photos, valid recipes, and all product stocks below 20',()=>{
  const s=createSeed();
  assert.equal(s.products.length,6);
  for(const p of s.products){assert.ok(p.stock>=0 && p.stock<20);assert.ok(p.image);requirements(s,p.recipe,0);}
  assert.ok(s.ingredients.every(i=>i.quantity>=0));
  assert.equal(s.ingredients.find(i=>i.id==='flour').quantity,13950);
});
test('production deducts each ingredient once and increases finished stock',()=>{
  const s=createSeed();const p=s.products[0];const before=structuredClone(s);
  const next=transition(s,{type:'produce',id:p.id,quantity:2});
  assert.equal(next.products[0].stock,p.stock+2);
  for(const r of p.recipe)assert.equal(next.ingredients.find(i=>i.id===r.ingredientId).quantity,s.ingredients.find(i=>i.id===r.ingredientId).quantity-2*r.amount);
  assert.deepEqual(s,before);assert.equal(next.revision,1);assert.equal(next.activity[0].type,'production');
});
test('insufficient later ingredient rolls back the entire batch',()=>{
  const s=createSeed();s.ingredients.find(i=>i.id==='chocolate').quantity=0;const before=structuredClone(s);
  assert.throws(()=>transition(s,{type:'produce',id:'banana-loaf',quantity:1}),/Not enough ingredients/);
  assert.deepEqual(s,before);
});
test('initial product stock consumes ingredients atomically',()=>{
  const s=createSeed();const next=transition(s,{type:'addProduct',product:sampleProduct()});
  assert.equal(next.ingredients.find(i=>i.id==='flour').quantity,s.ingredients.find(i=>i.id==='flour').quantity-200);
  assert.equal(next.products.at(-1).stock,2);
});
test('new product cannot be added with insufficient initial ingredients',()=>{
  const s=createSeed();s.ingredients.find(i=>i.id==='eggs').quantity=0;const before=structuredClone(s);
  assert.throws(()=>transition(s,{type:'addProduct',product:sampleProduct()}),/Not enough ingredients/);
  assert.deepEqual(s,before);
});
test('saving a zero stock product deducts nothing',()=>{
  const s=createSeed();const p=sampleProduct();p.stock=0;
  const next=transition(s,{type:'addProduct',product:p});assert.deepEqual(next.ingredients,s.ingredients);
});
test('recipe changes affect future batches only and cannot bypass stock deductions',()=>{
  const s=createSeed();const p=s.products[0];const recipe=[{ingredientId:'flour',amount:300}];
  const edit=transition(s,{type:'editProduct',id:p.id,product:{...p,stock:19,recipe}});
  assert.deepEqual(edit.ingredients,s.ingredients);assert.equal(edit.products[0].stock,p.stock);
  const next=transition(edit,{type:'produce',id:p.id,quantity:1});
  assert.equal(next.ingredients.find(i=>i.id==='flour').quantity,s.ingredients.find(i=>i.id==='flour').quantity-300);
  assert.equal(next.ingredients.find(i=>i.id==='eggs').quantity,s.ingredients.find(i=>i.id==='eggs').quantity);
});
test('stock limit accepts 19 and rejects 20',()=>{
  const s=createSeed();s.products[0].stock=18;
  assert.equal(transition(s,{type:'produce',id:'banana-loaf',quantity:1}).products[0].stock,19);
  assert.throws(()=>transition(s,{type:'produce',id:'banana-loaf',quantity:2}),/Maximum 19/);
  assert.throws(()=>transition(s,{type:'addProduct',product:{...sampleProduct(),stock:20}}),/maximum 19/);
});
test('zero, negative, fractional, NaN, and infinite batch sizes are rejected',()=>{
  const s=createSeed();
  for(const quantity of [0,-1,0.5,NaN,Infinity])assert.throws(()=>transition(s,{type:'produce',id:'banana-loaf',quantity}),/Batch quantity/);
});
test('duplicate recipe ingredients, missing ingredients, and fractions of pieces are rejected',()=>{
  const s=createSeed(),p=sampleProduct();
  assert.throws(()=>transition(s,{type:'addProduct',product:{...p,recipe:[{ingredientId:'flour',amount:1},{ingredientId:'flour',amount:2}]}}),/only once/);
  assert.throws(()=>transition(s,{type:'addProduct',product:{...p,recipe:[{ingredientId:'unknown',amount:1}]}}),/existing ingredient/);
  assert.throws(()=>transition(s,{type:'addProduct',product:{...p,recipe:[{ingredientId:'eggs',amount:0.5}]}}),/whole number/);
  assert.throws(()=>transition(s,{type:'addProduct',product:{...p,recipe:[]}}),/at least one/);
});
test('fractional gram deductions do not drift below zero',()=>{
  const s=createSeed();s.ingredients.find(i=>i.id==='flour').quantity=0.3;
  s.products[0].recipe=[{ingredientId:'flour',amount:0.1}];
  assert.equal(capacity(s,s.products[0]),3);
  const next=transition(s,{type:'produce',id:'banana-loaf',quantity:3});
  assert.equal(next.ingredients.find(i=>i.id==='flour').quantity,0);
});
test('sales and waste deduct only finished stock, never deduct ingredients twice',()=>{
  const s=createSeed();const next=transition(s,{type:'removeStock',id:'banana-loaf',quantity:2,reason:'Sold'});
  assert.deepEqual(next.ingredients,s.ingredients);assert.equal(next.products[0].stock,6);
  assert.throws(()=>transition(s,{type:'removeStock',id:'banana-loaf',quantity:9,reason:'Sold'}),/Cannot remove/);
});
test('receiving ingredients adds only the received quantity and records the change',()=>{
  const s=createSeed();const next=transition(s,{type:'receiveIngredient',id:'flour',quantity:1000});
  assert.equal(next.ingredients[0].quantity,s.ingredients[0].quantity+1000);assert.equal(next.activity[0].changes[0].amount,1000);
  assert.throws(()=>transition(s,{type:'receiveIngredient',id:'eggs',quantity:0.5}),/whole number/);
});
test('inventory corrections reject negative counts and require an audit reason',()=>{
  const s=createSeed();assert.throws(()=>transition(s,{type:'adjustIngredient',id:'flour',quantity:-1,threshold:0,reason:'Count'}),/Corrected quantity/);
  assert.throws(()=>transition(s,{type:'adjustIngredient',id:'flour',quantity:10,threshold:0,reason:''}),/Reason|reason/);
  const next=transition(s,{type:'adjustIngredient',id:'flour',quantity:100,threshold:50,reason:'Physical count'});assert.equal(next.ingredients[0].quantity,100);assert.equal(next.activity[0].type,'adjustment');
});
test('ingredients validate units, duplicates and piece quantities',()=>{
  const s=createSeed();const ingredient={name:'Salt',quantity:100,unit:'g',threshold:20};
  assert.equal(transition(s,{type:'addIngredient',ingredient}).ingredients.at(-1).name,'Salt');
  assert.throws(()=>transition(s,{type:'addIngredient',ingredient:{...ingredient,unit:'kg'}}),/base unit/);
  assert.throws(()=>transition(s,{type:'addIngredient',ingredient:{...ingredient,name:'Sugar'}}),/already exists/);
});
test('invalid price, name collisions, and unsafe images cannot be saved',()=>{
  const s=createSeed();const p=sampleProduct();
  assert.throws(()=>transition(s,{type:'addProduct',product:{...p,price:-1}}),/Price/);
  assert.throws(()=>transition(s,{type:'addProduct',product:{...p,price:1.001}}),/2 decimal/);
  assert.throws(()=>transition(s,{type:'addProduct',product:{...p,name:s.products[0].name}}),/already exists/);
  assert.throws(()=>transition(s,{type:'addProduct',product:{...p,image:'javascript:alert(1)'}}),/product photo/);
});
test('production capacity reflects both ingredients and remaining stock space',()=>{
  const s=createSeed();assert.equal(capacity(s,s.products[0]),11);
  s.ingredients.find(i=>i.id==='eggs').quantity=3;assert.equal(capacity(s,s.products[0]),1);
  s.products[0].stock=19;assert.equal(capacity(s,s.products[0]),0);
});

const request = (requestId='test-request',quantity=2) => ({type:'submitOrder',requestId,items:[{productId:'banana-loaf',quantity,unitPrice:180}],customer:{name:'Demo Customer',phone:'09061234567',fulfillment:'pickup',notes:'Pickup at 3 PM'}});
const orderStatus = (state,status,note='') => transition(state,{type:'updateOrder',id:'test-request',status,actor:'admin',note});
test('order submission creates an admin request and reserves stock without consuming ingredients',()=>{
  const s=createSeed(),next=transition(s,request());
  assert.equal(next.orders[0].status,'pending');assert.equal(next.orders[0].reference,'GD-0001');assert.equal(next.orders[0].total,360);
  assert.equal(next.products[0].stock,8);assert.equal(reserved(next,'banana-loaf'),2);assert.equal(available(next,next.products[0]),6);
  assert.deepEqual(next.ingredients,s.ingredients);assert.equal(next.activity[0].type,'order');
});
test('a repeated checkout request cannot create duplicate orders or reservations',()=>{
  const s=transition(createSeed(),request());const next=transition(s,request());
  assert.equal(next.orders.length,1);assert.equal(reserved(next,'banana-loaf'),2);assert.equal(next.revision,s.revision);
});
test('a second customer cannot order stock reserved by the first',()=>{
  const s=transition(createSeed(),request('test-request',7)),before=structuredClone(s);
  assert.throws(()=>transition(s,request('another-request',2)),/only 1 units available/);
  assert.deepEqual(s,before);
});
test('a multi-item order fails atomically when any product is unavailable',()=>{
  const s=createSeed(),action=request();action.items.push({productId:'family-tray',quantity:1,unitPrice:850});
  assert.throws(()=>transition(s,action),/only 0 units available/);assert.equal(s.orders.length,0);assert.equal(reserved(s,'banana-loaf'),0);
});
test('accepted and ready orders keep reservations; fulfillment deducts finished stock once',()=>{
  const seed=createSeed(),pending=transition(seed,request()),accepted=orderStatus(pending,'accepted','Pickup confirmed');
  assert.equal(available(accepted,accepted.products[0]),6);
  const ready=orderStatus(accepted,'ready','Ready for pickup');assert.equal(ready.products[0].stock,8);
  const completed=orderStatus(ready,'completed','Thank you');
  assert.equal(completed.products[0].stock,6);assert.equal(reserved(completed,'banana-loaf'),0);assert.equal(available(completed,completed.products[0]),6);
  assert.deepEqual(completed.ingredients,seed.ingredients);assert.throws(()=>orderStatus(completed,'completed'),/Cannot change/);
});
test('declining requests requires a reason and releases stock without refunding ingredients',()=>{
  const s=transition(createSeed(),request());assert.throws(()=>orderStatus(s,'declined'),/reason/);
  const next=orderStatus(s,'declined','Pickup unavailable');assert.equal(available(next,next.products[0]),8);assert.equal(next.products[0].stock,8);assert.deepEqual(next.ingredients,s.ingredients);
});
test('customer cancellation works only before admin acceptance',()=>{
  const s=transition(createSeed(),request());const action={type:'updateOrder',id:'test-request',actor:'customer',status:'cancelled'};
  const next=transition(s,action);assert.equal(available(next,next.products[0]),8);
  assert.throws(()=>transition(orderStatus(s,'accepted'),action),/Only pending/);
});
test('admin cancellation of a ready order releases the reservation',()=>{
  const s=orderStatus(orderStatus(transition(createSeed(),request()),'accepted'),'ready');
  const next=orderStatus(s,'cancelled','Customer changed pickup plans');assert.equal(available(next,next.products[0]),8);assert.equal(next.orders[0].status,'cancelled');
});
test('manual sales and waste cannot remove reserved stock',()=>{
  const s=transition(createSeed(),request('test-request',7));
  assert.throws(()=>transition(s,{type:'removeStock',id:'banana-loaf',quantity:2,reason:'Walk-in sale'}),/unreserved/);
  const next=transition(s,{type:'removeStock',id:'banana-loaf',quantity:1,reason:'Walk-in sale'});assert.equal(next.products[0].stock,7);assert.equal(available(next,next.products[0]),0);
});
test('price changes require customer review and existing orders retain original prices',()=>{
  const s=createSeed(),action=request();s.products[0].price=200;
  assert.throws(()=>transition(s,action),/price.*changed/);
  action.items[0].unitPrice=200;const next=transition(s,action);next.products[0].price=300;
  assert.equal(next.orders[0].items[0].unitPrice,200);assert.equal(next.orders[0].total,400);
});
test('checkout validates contact details, delivery addresses, and item quantities',()=>{
  const s=createSeed(),action=request();
  assert.throws(()=>transition(s,{...action,customer:{...action.customer,name:''}}),/Customer name/);
  assert.throws(()=>transition(s,{...action,customer:{...action.customer,phone:'abc123'}}),/valid contact/);
  assert.throws(()=>transition(s,{...action,customer:{...action.customer,fulfillment:'delivery',address:''}}),/Delivery address/);
  assert.throws(()=>transition(s,{...action,items:[]}),/basket is empty/);
  assert.throws(()=>transition(s,{...action,items:[{...action.items[0],quantity:1.5}]}),/whole number/);
  assert.throws(()=>transition(s,{...action,items:[action.items[0],action.items[0]]}),/only once/);
  const next=transition(s,{...action,customer:{...action.customer,fulfillment:'delivery',address:'Demo street, Binmaley'}});assert.equal(next.orders[0].customer.address,'Demo street, Binmaley');
});
test('hidden products cannot be ordered, and production still caps physical stock at 19',()=>{
  const s=createSeed();s.products[0].active=false;assert.throws(()=>transition(s,request()),/no longer available/);
  s.products[0].active=true;const next=transition(s,request('test-request',7));
  assert.equal(capacity(next,next.products[0]),11);assert.throws(()=>transition(next,{type:'produce',id:'banana-loaf',quantity:12}),/Maximum 19/);
});
test('older saved data without an orders array remains usable',()=>{
  const s=createSeed();delete s.orders;const next=transition(s,request());assert.equal(next.orders.length,1);assert.equal(available(s,s.products[0]),8);
});
