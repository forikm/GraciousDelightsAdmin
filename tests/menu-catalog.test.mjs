import test from 'node:test';
import assert from 'node:assert/strict';
import { CAKES, COOKIES, SAVORY_MEALS, SIGN_CATALOG, SIGN_CATEGORIES, SWEET_BREADS } from '../menu-catalog.js';
import { PRODUCT_PHOTOS } from '../product-photos.js';
import { createSeed, transition } from '../domain.js';
import { present } from '../lib/store.js';

test('the signs contain 31 selling options in three categories with the listed prices',()=>{
  assert.equal(SIGN_CATALOG.length,31);
  assert.equal(new Set(SIGN_CATALOG.map(p=>p.id)).size,31);
  assert.deepEqual(SIGN_CATEGORIES,[SWEET_BREADS,COOKIES,CAKES]);
  assert.deepEqual(new Set(SIGN_CATALOG.map(p=>p.category)),new Set(SIGN_CATEGORIES));
  const price=id=>SIGN_CATALOG.find(p=>p.id===`sign-${id}`).price;
  assert.equal(price('chocolate-crinkles-piece'),12);
  assert.equal(price('ube-crinkles-tub'),125);
  assert.equal(price('matcha-cookie'),75);
  assert.equal(price('ensaymada-yema'),55);
  assert.equal(price('ensaymada-pack-3'),165);
  assert.equal(price('ensaymada-pack-4'),220);
  assert.equal(price('ensaymada-pack-6'),330);
  assert.equal(price('cinnamon-classic-piece'),65);
  assert.equal(price('cinnamon-classic-pan'),130);
  assert.equal(price('yema-cake-ube'),99);
  assert.equal(price('banana-loaf'),180);
  assert.equal(price('banana-square'),28);
  assert.equal(price('banana-squares-pack-6'),165);
});

test('updates only verified sign photos and preserves shop records',()=>{
  const original=transition(createSeed(),{type:'importSignCatalog'});
  for(const product of original.products.filter(p=>PRODUCT_PHOTOS[p.id]))product.image='assets/menu-signs/ensaymada-cinnamon-flavors.png';
  const custom=original.products.find(p=>p.id==='sign-ensaymada-oreo');
  custom.image='/api/shop?op=image&id='+'a'.repeat(64);
  const updated=transition(original,{type:'applyProductPhotos'});
  assert.equal(Object.keys(PRODUCT_PHOTOS).length,17);
  assert.deepEqual(updated.orders,original.orders);
  assert.deepEqual(updated.ingredients,original.ingredients);
  for(const product of updated.products){
    const before=original.products.find(p=>p.id===product.id);
    assert.deepEqual({...product,image:before.image},before);
    if(PRODUCT_PHOTOS[product.id]&&product.id!==custom.id)assert.equal(product.image,PRODUCT_PHOTOS[product.id].image);
  }
  assert.equal(updated.products.find(p=>p.id===custom.id).image,custom.image);
  assert.deepEqual(transition(updated,{type:'applyProductPhotos'}),updated);
});
test('imports zero-stock menu products without changing inventory and safely retries',()=>{
  const original=createSeed();
  const imported=transition(original,{type:'importSignCatalog'});
  assert.equal(imported.products.length,original.products.length+31);
  assert.deepEqual(imported.ingredients,original.ingredients);
  assert.deepEqual(imported.orders,original.orders);
  assert.deepEqual(imported.products.slice(0,original.products.length),original.products);
  const product=imported.products.find(p=>p.id==='sign-matcha-cookie');
  assert.equal(product.stock,0);
  assert.equal(product.recipePending,true);
  assert.deepEqual(product.recipe,[]);
  assert.throws(()=>transition(imported,{type:'produce',id:product.id,quantity:1}),/ingredient/);
  assert.deepEqual(transition(imported,{type:'importSignCatalog'}),imported);
  const saved=transition(imported,{type:'editProduct',id:product.id,product:{...product,description:'Kitchen description'}});
  assert.equal(saved.products.find(p=>p.id===product.id).description,'Kitchen description');
  const ready=transition(saved,{type:'editProduct',id:product.id,product:{...product,recipe:[{ingredientId:'flour',amount:10}]}});
  assert.equal(ready.products.find(p=>p.id===product.id).recipePending,undefined);
  assert.equal(transition(ready,{type:'produce',id:product.id,quantity:1}).products.find(p=>p.id===product.id).stock,1);
});

test('existing product categories are updated in both catalog views without rewriting saved products',()=>{
  const original=createSeed();
  const rows=[
    ['Breads & pastries',SWEET_BREADS],['Cakes & sweets',CAKES],['Cakes & sweets',CAKES],
    ['Cakes & sweets',COOKIES],['Snacks',SAVORY_MEALS],['Family trays',SAVORY_MEALS]
  ];
  for (const [index,[legacy]] of rows.entries()) original.products[index].category=legacy;
  const saved=structuredClone(original);
  for (const admin of [true,false]) {
    const viewed=present(original,{admin,owner:'test'});
    assert.deepEqual(viewed.products.map(p=>p.category),rows.map(([,category])=>category));
    assert.deepEqual(viewed.products.map(({id,price,stock})=>({id,price,stock})),
      original.products.map(({id,price,stock})=>({id,price,stock})));
  }
  assert.deepEqual(original,saved);
  const product=original.products[0];
  assert.throws(()=>transition(original,{type:'editProduct',id:product.id,product:{...product,category:'Unlisted'}}),/Choose a menu category/);
  const edited=transition(original,{type:'editProduct',id:product.id,product});
  assert.equal(edited.products[0].category,SWEET_BREADS);
});
