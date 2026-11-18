import { SIGN_CATALOG } from './menu-catalog.js';
import { productPhoto } from './product-photos.js';

// Fictional walkthrough data. This module never writes to the shop database.
const entries=[
 ['2026-11-16T10:35:00+08:00','Mara Santos','completed',[['ensaymada-pack-3',1],['matcha-cookie',2]],'Collected at the shop.'],
 ['2026-11-16T09:20:00+08:00','Paolo Mendoza','cancelled',[['cinnamon-apple-caramel-sauce-pan',2]],'Customer requested cancellation before preparation.'],
 ['2026-11-15T16:40:00+08:00','Andrea Cruz','completed',[['banana-loaf',2],['yema-cake-ube',1]],'Pickup completed at 4:40 PM.'],
 ['2026-11-15T14:05:00+08:00','Luis Garcia','completed',[['ensaymada-pack-6',1]],'Assorted box collected.'],
 ['2026-11-15T11:10:00+08:00','Trisha Ramos','cancelled',[['chocolate-crinkles-tub',2],['ube-crinkles-tub',1]],'Duplicate request cancelled; customer kept the other order.'],
 ['2026-11-14T17:15:00+08:00','Carlo Reyes','completed',[['cinnamon-choco-fudge-piece',3],['cinnamon-cheese-piece',3]],'Collected for an afternoon gathering.'],
 ['2026-11-14T13:45:00+08:00','Nina Flores','completed',[['yema-cake-classic',2],['banana-squares-pack-6',1]],'Customer confirmed receipt at pickup.'],
 ['2026-11-13T16:30:00+08:00','Jessa Aquino','completed',[['ensaymada-yema',3],['ensaymada-ube',3]],'Pickup completed.'],
 ['2026-11-13T12:25:00+08:00','Miguel Navarro','cancelled',[['ensaymada-pack-4',2]],'Customer could not make the pickup time.'],
 ['2026-11-12T15:50:00+08:00','Bea Castillo','completed',[['matcha-cookie',4],['banana-square',4]],'Collected at the shop.'],
 ['2026-11-11T14:10:00+08:00','Rafael Torres','completed',[['cinnamon-sliced-almonds-pan',1],['cinnamon-apple-caramel-sauce-pan',1]],'Both pans collected.'],
 ['2026-11-10T10:15:00+08:00','Ella Dela Cruz','cancelled',[['yema-cake-ube',2],['banana-loaf',1]],'Plans changed; cancelled before preparation.']
];
export const PRESENTATION_ORDERS=entries.map(([at,name,status,items,note],index)=>({
 id:`presentation-${index+1}`,reference:`GD-${String(148-index).padStart(4,'0')}`,at,name,status,note,
 items:items.map(([slug,quantity])=>({productId:`sign-${slug}`,quantity}))
}));
export function renderPresentationHistory(container,products,filter='all'){
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=value=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(value);
 const catalog=new Map(SIGN_CATALOG.map(p=>[p.id,p]));
 for(const product of products)catalog.set(product.id,product);
 const total=order=>order.items.reduce((sum,item)=>sum+catalog.get(item.productId).price*item.quantity,0);
 const complete=PRESENTATION_ORDERS.filter(o=>o.status==='completed');
 const shown=PRESENTATION_ORDERS.filter(o=>filter==='all'||o.status===filter);
 container.innerHTML=`<div class="info-banner"><span><strong>Presentation workspace.</strong> Sample order history for walkthroughs, separate from live orders, sales, and inventory.</span></div>
 <div class="stats-grid"><div class="stat"><span>Completed</span><strong>${complete.length}<small>orders fulfilled</small></strong></div><div class="stat"><span>Cancelled</span><strong>${PRESENTATION_ORDERS.length-complete.length}<small>requests cancelled</small></strong></div><div class="stat"><span>Completed order value</span><strong class="presentation-value">${money(complete.reduce((sum,o)=>sum+total(o),0))}<small>presentation records only</small></strong></div></div>
 <div class="orders-toolbar"><h2>Order history</h2><label>Show <select id="presentation-filter"><option value="all" ${filter==='all'?'selected':''}>All records</option><option value="completed" ${filter==='completed'?'selected':''}>Completed</option><option value="cancelled" ${filter==='cancelled'?'selected':''}>Cancelled</option></select></label></div>
 <div>${shown.map(order=>`<article class="admin-order-card"><div class="order-heading"><div><strong>${order.reference}</strong><small>${new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Manila'}).format(new Date(order.at))}</small></div><span class="order-status status-${order.status}">${order.status==='completed'?'Completed':'Cancelled'}</span></div><div class="admin-order-columns"><div class="order-customer"><h3>${esc(order.name)}</h3><p><strong>Shop pickup</strong></p></div><div class="presentation-items">${order.items.map(item=>{const p=catalog.get(item.productId);return `<div class="presentation-item">${productPhoto(p,'presentation-photo',true)}<div><strong>${item.quantity} × ${esc(p.name)}</strong><small>${esc(p.portion)} · ${money(p.price)} each</small></div><span>${money(p.price*item.quantity)}</span></div>`;}).join('')}<p class="presentation-total">Order total <strong>${money(total(order))}</strong></p></div></div><p class="admin-order-note"><strong>Kitchen note:</strong> ${esc(order.note)}</p></article>`).join('')}</div>`;
 container.querySelector('#presentation-filter').addEventListener('change',event=>renderPresentationHistory(container,products,event.target.value));
}
