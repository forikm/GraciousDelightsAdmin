import { PRODUCT_PHOTOS } from './product-photos.js';

export const SWEET_BREADS = 'Sweet Breads & Pastries';
export const COOKIES = 'Cookies & Quick Breads';
export const SAVORY_MEALS = 'Savory Meals';
export const CAKES = 'Cakes';
export const SHOP_CATEGORIES = [SWEET_BREADS, COOKIES, SAVORY_MEALS, CAKES];

const legacyCategories = new Map([
  ['Breads & pastries', SWEET_BREADS],
  ['Ensaymada', SWEET_BREADS],
  ['Cinnamon Rolls', SWEET_BREADS],
  ['Banana Bread', SWEET_BREADS],
  ['Crinkles', COOKIES],
  ['Cookies', COOKIES],
  ['Snacks', SAVORY_MEALS],
  ['Family trays', SAVORY_MEALS],
  ['Yema Cake', CAKES],
  ['Cakes & sweets', CAKES]
]);

export function productCategory(product) {
  // The original sweets category included both celebration cakes and cookies.
  if (product.category === 'Cakes & sweets' && /\b(?:cookies?|crinkles?)\b/i.test(product.name)) return COOKIES;
  return legacyCategories.get(product.category) ?? product.category;
}

// Prices, selling units, and flavors transcribed from the owner's November 2026 signs.
const products = [];
function add(id, name, category, price, portion, description, image) {
  products.push({id:`sign-${id}`,name,category,price,portion,description,image:`assets/menu-signs/${image}.png`});
}

for (const flavor of ['Chocolate','Ube']) {
  const slug=flavor.toLowerCase();
  add(`${slug}-crinkles-piece`,`${flavor} Crinkles — Piece`,COOKIES,12,'1 piece',`${flavor} crinkles, sold individually.`,'crinkles-matcha');
  add(`${slug}-crinkles-tub`,`${flavor} Crinkles — Tub`,COOKIES,125,'1 tub',`A tub of ${flavor.toLowerCase()} crinkles.`,'crinkles-matcha');
}
add('matcha-cookie','Matcha Cookie',COOKIES,75,'1 piece · 100 g','A 100 g matcha cookie.','crinkles-matcha');

for (const flavor of ['Yema','Classic Cheese','Chocolate','Sliced Almonds','Ube','Oreo']) {
  add(`ensaymada-${flavor.toLowerCase().replaceAll(' ','-')}`,`${flavor} Ensaymada`,SWEET_BREADS,55,'1 piece',`${flavor} ensaymada with buttercream.`,'ensaymada-cinnamon-flavors');
}
for (const [count,price] of [[3,165],[4,220],[6,330]]) {
  add(`ensaymada-pack-${count}`,`Assorted Ensaymada — Pack of ${count}`,SWEET_BREADS,price,`${count} pieces`,`Assorted ensaymada with buttercream. Flavors include yema, classic cheese, chocolate, sliced almonds, ube, and Oreo. Add your preferred mix in the order notes.`,'ensaymada-cinnamon-prices');
}
for (const flavor of ['Apple Caramel Sauce','Classic','Choco Fudge','Sliced Almonds','Cheese','Oreo']) {
  for (const [unit,price] of [['Piece',65],['Pan',130]]) {
    add(`cinnamon-${flavor.toLowerCase().replaceAll(' ','-')}-${unit.toLowerCase()}`,`${flavor} Cinnamon Roll — ${unit}`,SWEET_BREADS,price,`1 ${unit.toLowerCase()}`,`Cinnamon roll with cream cheese and ${flavor.toLowerCase()} flavor, sold per ${unit.toLowerCase()}.`,'ensaymada-cinnamon-flavors');
  }
}
for (const flavor of ['Classic','Ube']) {
  add(`yema-cake-${flavor.toLowerCase()}`,`${flavor} Yema Cake`,CAKES,99,'1 tub',`${flavor} yema cake, sold per tub.`,'yema-banana');
}
add('banana-loaf','Banana Loaf',SWEET_BREADS,180,'1 pan','Banana bread loaf, sold per pan.','yema-banana');
add('banana-square','Banana Square',SWEET_BREADS,28,'1 piece','Banana bread square, sold individually.','yema-banana');
add('banana-squares-pack-6','Banana Squares — Pack of 6',SWEET_BREADS,165,'6 pieces','A pack of six banana bread squares.','yema-banana');

for(const product of products){if(PRODUCT_PHOTOS[product.id])product.image=PRODUCT_PHOTOS[product.id].image;}
export const SIGN_CATALOG = products;
export const SIGN_CATEGORIES = SHOP_CATEGORIES.filter(category => products.some(product => product.category === category));
