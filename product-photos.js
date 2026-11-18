// Original owner photographs from https://www.facebook.com/share/p/1A45GYzgbj/.
// Coordinates select a visible topping in the original photograph; no pixels are altered.
const ensaymada='assets/facebook/956932590e81fb31.jpg';
const cheese='assets/facebook/9d66c6b0e97996c2.jpg';
const display='assets/facebook/28b43450fed7ba55.jpg';
export const PRODUCT_PHOTOS={};
const assign=(id,image,crop=null)=>{PRODUCT_PHOTOS[`sign-${id}`]={image,crop};};
assign('ensaymada-oreo',ensaymada,[.21,.095,.40,.15]);
assign('ensaymada-chocolate',ensaymada,[.21,.232,.40,.15]);
assign('ensaymada-sliced-almonds',ensaymada,[.21,.365,.40,.15]);
assign('ensaymada-ube',ensaymada,[.21,.51,.40,.16]);
assign('ensaymada-yema',ensaymada,[.21,.79,.40,.16]); // Flavor confirmed by owner.
assign('ensaymada-classic-cheese',cheese,[.21,.40,.40,.15]);
for(const count of [3,4,6])assign(`ensaymada-pack-${count}`,ensaymada);
for(const [flavor,crop] of [
  ['apple-caramel-sauce',[.30,.465,.125,.09]],
  ['sliced-almonds',[.025,.075,.12,.09]],
  ['cheese',[.025,.165,.12,.085]],
  ['choco-fudge',[.025,.34,.12,.095]]
])for(const unit of ['piece','pan'])assign(`cinnamon-${flavor}-${unit}`,display,crop);

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function productPhoto(product,className='',lazy=false){
  const photo=PRODUCT_PHOTOS[product.id];
  const label=escape(product.name);
  const src=escape(product.image);
  const load=lazy?' loading="lazy"':'';
  if(!photo?.crop || product.image!==photo.image)return `<img class="${className}" src="${src}" alt="${label}"${load}>`;
  const [x,y,w,h]=photo.crop;
  const viewBox=[x*1542,y*2047,w*1542,h*2047].join(' ');
  return `<svg class="photo-window ${className}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}"><image href="${src}" width="1542" height="2047"/></svg>`;
}
