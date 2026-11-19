import { dialogControls, focusHeading, rememberFocus } from './interaction.js';
import { renderAnnouncementManager, announcementEditor } from './announcements.js';
import { PRODUCT_PHOTOS, productPhoto } from './product-photos.js';
import { renderPresentationHistory } from './presentation-history.js';
import { requirements, capacity, MAX_STOCK, stockLimit, round, available, reserved } from './domain.js';
import { createOrderingUI } from './orders-ui.js';
import { SHOP_CATEGORIES, SIGN_CATALOG, SIGN_CATEGORIES } from './menu-catalog.js';


const FB = 'https://www.facebook.com/graciousdelightsfoodandbeverage/';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = n => new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 }).format(n);
const money = n => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
const paths = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  leaf:'<path d="M20 4C9 3 3 7 5 14s13 5 15-10ZM4 20 15 9"/>',
  box:'<path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l9 4"/>',
  cake:'<path d="M4 12h16v8H4zM4 15c3 4 5-3 8 0s5 0 8 0M8 12V8m8 4V8M8 5v1m8-1v1M2 20h20"/>',
  book:'<path d="M12 5c-4-3-8-2-9-1v15c4-2 6-1 9 1 3-2 5-3 9-1V4c-3-2-6-1-9 1Zm0 0v15"/>',
  history:'<path d="M4 5v5h5M4 10a9 9 0 1 1 1 8M12 7v5l3 2"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
  'bell-off':'<path d="m3 3 18 18M6 8c0 7-3 7-3 9h14m4 0c0-2-3-2-3-9a6 6 0 0 0-9-5m1 17a2 2 0 0 0 4 0"/>',
  external:'<path d="M14 3h7v7m0-7-9 9m7 1v7H4V5h7"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  phone:'<path d="m7 3 3 5-3 3c2 3 3 4 6 6l3-3 5 3c0 6-7 5-12 0S0 3 7 3Z"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  check:'<path d="m5 12 4 4 10-10"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6"/>',
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-4-4L5 15l-1 5Z"/>',
  heart:'<path d="M12 20S2 14 2 8a5 5 0 0 1 10-1A5 5 0 0 1 22 8c0 6-10 12-10 12Z"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`;
let state, storageError = '', mode = 'shop', section = 'products', category = 'All delights', query = '', sort = 'featured', availableOnly = false;
let deferredInstall, toastTimer, installDismissed = false;
let soundEnabled=false,orderAudio;
// Audio requires a user gesture; enable again after opening or reloading the workspace.
function orderSound(){
  if(!soundEnabled||!orderAudio||orderAudio.state!=='running')return;
  const tone=orderAudio.createOscillator(),volume=orderAudio.createGain();tone.type='sine';tone.frequency.value=740;volume.gain.setValueAtTime(.12,orderAudio.currentTime);volume.gain.exponentialRampToValueAtTime(.001,orderAudio.currentTime+.55);tone.connect(volume);volume.connect(orderAudio.destination);tone.start();tone.stop(orderAudio.currentTime+.55);
}
async function toggleOrderSound(){
  soundEnabled=!soundEnabled;
  if(soundEnabled){
    try{orderAudio ||= new (window.AudioContext||window.webkitAudioContext)();await orderAudio.resume();orderSound();}
    catch{soundEnabled=false;header();toast('Sound is unavailable in this browser.');return;}
  }
  header();toast(soundEnabled?'Order sound on while the kitchen is open.':'Order sound off.');
}
const standalone = window.matchMedia('(display-mode: standalone)');
const isInstalled = () => standalone.matches || navigator.standalone === true;
function installPromotion() {
  const panel = $('#install-promotion');
  panel.hidden = isInstalled() || installDismissed;
  panel.innerHTML = `<div><strong>Kitchen admin on your phone</strong><span>Open the kitchen inbox from your home screen.</span></div><button class="button primary" data-action="install">${icon('download')} ${deferredInstall ? 'Install app' : 'Get the app'}</button><button class="icon-button" data-action="dismiss-install" aria-label="Dismiss installation suggestion">${icon('close')}</button>`;
  document.querySelectorAll('.install-button, [data-mobile-install]').forEach(button => { button.hidden = isInstalled(); });
}
state = {version:1,revision:0,products:[],ingredients:[],activity:[],orders:[],admin:false,myOrderIds:[]};
let loading = true, refreshing = false, requestEpoch = 0;
async function api(op, body) {
  let response;
  try { response = await fetch('/api/shop?op='+op, {method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout?.(30000)}); }
  catch (error) {
    if (error.name === 'TimeoutError') throw new Error('The kitchen did not respond in time. Check the request status or try again.');
    throw new Error('Unable to reach the kitchen. Check your connection and try again.');
  }
  const data = await response.json().catch(()=>({error:'The server returned an unexpected response.'}));
  if (response.status===401 && op==='state') return {version:1,revision:0,products:[],ingredients:[],activity:[],orders:[],admin:false,myOrderIds:[]};
  if (!response.ok) throw new Error(data.error || 'Unable to complete this request.');
  return data;
}
async function refreshState() {
  if (refreshing || (document.hidden&&!soundEnabled)) return;
  refreshing=true;
  const epoch=requestEpoch;
  try {
    const next=await api('state');
    if(epoch!==requestEpoch)return;
    const changed=JSON.stringify(next)!==JSON.stringify(state);
    const newOrder=state.admin && next.admin && next.orders.some(o=>o.status==='pending' && !state.orders.some(old=>old.id===o.id));
    const recovered=!!storageError || loading;
    if(state.admin && !next.admin)$('#modal').close();
    state=next;storageError='';loading=false;
    if(changed || recovered){render();ordering.refresh();if(newOrder){orderSound();toast('New order request. Review it in Orders.');}}
  } catch(error) {if(epoch===requestEpoch){storageError=error.message;loading=false;render();}}
  finally {refreshing=false;}
}
const dialogs = dialogControls($('#modal'), {
  escape: esc, checkIcon: icon('check'), closeIcon: icon('close'),
  fallback: () => $('#order-filter') || $('.admin-heading h1') || $('#main')
});
const {openModal, bindForm, formFooter} = dialogs;
const ordering=createOrderingUI({getState:()=>state,commit,openModal,bindForm,formFooter,toast,header,money,esc,icon});
function toast(message) {
  if ($('#modal').open && !dialogs.isBusy()) {
    $('#modal .dialog-status').textContent = message;
    return;
  }
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000);
}
async function commit(action, expectedRevision) {
  requestEpoch++;
  try { state=await api('mutate',{action,revision:expectedRevision});storageError='';render(); }
  catch(error) { await refreshState(); throw error; }
}
function renderLogin() {
  $('#main').innerHTML = '<section class="login-panel"><p class="eyebrow">THE KITCHEN</p><h1>Admin sign in</h1><p>Manage orders, products, and ingredients.</p><form id="login-form"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><p id="login-error" tabindex="-1" role="alert" class="form-error"></p><button class="button primary" type="submit">Sign in</button></form></section>';
  const form = $('#login-form');
  const button = form.querySelector('button[type="submit"]');
  const feedback = $('#login-error');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.getAttribute('aria-disabled') === 'true') return;
    button.setAttribute('aria-disabled', 'true');
    button.textContent = 'Signing in…';
    feedback.textContent = '';
    const data = new FormData(form);
    try {
      requestEpoch++;
      state = await api('login', {email:data.get('email'), password:data.get('password')});
      storageError = '';
      render();
      focusHeading($('.admin-heading h1'));
    } catch (error) {
      feedback.textContent = error.message;
      feedback.focus();
    } finally {
      button.removeAttribute('aria-disabled');
      button.textContent = 'Sign in';
    }
  });
}
function stockBadge(p) {
  const qty=available(state,p);
  return `<span class="stock ${qty === 0 ? 'sold-out' : qty <= 3 ? 'low' : ''}"><span class="dot"></span>${qty === 0 ? 'Sold out' : `${qty} available`}</span>`;
}
function header() {
  const headerElement = $('#header');
  const restoreFocus = rememberFocus(headerElement);
  headerElement.classList.toggle('is-signed-in', state.admin);
  document.title=state.admin?`${state.orders.filter(o=>o.status==='pending').length?'('+state.orders.filter(o=>o.status==='pending').length+') ':''}Gracious Delights · Kitchen`:'Gracious Delights · Kitchen sign in';
  headerElement.innerHTML = `<div class="header-inner">
    <a class="brand" href="#admin/orders" aria-label="Gracious Delights kitchen home"><img src="assets/facebook/a00aff175be206dd.jpg" alt=""><span>Gracious Delights<small>Kitchen admin</small></span></a>
    <div class="header-actions">
      ${state.admin ? `<button class="button secondary kitchen-shortcut order-sound" data-action="order-sound" aria-label="Order sound" aria-pressed="${soundEnabled}">${icon(soundEnabled?'bell':'bell-off')}<span class="shortcut-desktop">Order sound</span><span class="shortcut-mobile">Sound</span></button>` : ''}
      <button class="install-button" data-action="install" aria-label="Install kitchen app" ${isInstalled()?'hidden':''}>${icon('download')}<span>Get the app</span></button>
      <a class="button secondary kitchen-shortcut" href="https://gracious-delights-chi.vercel.app/" aria-label="Customer menu on the storefront" target="_blank" rel="noopener noreferrer">${icon('external')}<span class="shortcut-desktop">Customer menu</span><span class="shortcut-mobile">Storefront</span></a>
    </div>
  </div>`;
  restoreFocus();
}
function footer() {
  $('#footer').innerHTML = `<div class="footer-inner"><span>Gracious Delights <span class="subtle">· Homemade in Binmaley</span></span><span class="footer-links"><a href="${FB}" target="_blank" rel="noopener noreferrer">Find us on Facebook ↗</a><span id="connection" class="connection">${navigator.onLine ? 'Online' : 'Offline'}</span></span></div><p class="demo-note">Homemade in Binmaley · Orders are confirmed by our kitchen.</p>`;
}
function render() {
  const restoreFocus = rememberFocus(document);
  header(); footer();
  installPromotion();
  $('#main').className = mode === 'admin' ? 'admin-main' : 'shop-main';
  if (loading) $('#main').innerHTML='<div class="empty-state"><h2>Opening the kitchen…</h2></div>'; else if (mode === 'admin') { if(state.admin)renderAdmin();else if (!$('#login-form')) renderLogin(); } else if (!$('#login-form')) renderLogin();
  $('#main .storage-warning')?.remove();
  if (storageError) $('#main').insertAdjacentHTML('afterbegin', `<p class="storage-warning" role="alert">${esc(storageError)} <button data-action="retry" class="text-button">Retry</button></p>`);
  restoreFocus();
}
function renderAdmin() {
  const labels = { orders:['Orders','Review new requests and follow orders through fulfillment.'], announcements:['Announcements'], presentation:['Presentation history','Completed and cancelled orders for your walkthrough.'], products:['Products'], inventory:['Ingredient inventory','Keep your kitchen ready for the next batch.'], recipes:['Recipes','The ingredients behind every delight.'], activity:['Activity log','A clear record of every kitchen update.'], settings:['Backups','Keep a copy of your shop records.'] };
  const tabs = [['orders','book','Orders'],['products','box','Products'],['inventory','leaf','Ingredients'],['recipes','book','Recipes'],['announcements','book','Announcements'],['activity','history','Activity log'],['presentation','history','Presentation history'],['settings','download','Backups']];
  const lowIngredients = state.ingredients.filter(i => i.quantity <= i.threshold);
  const pending = ordering.pendingCount();
  const quickPages = ['orders', 'products', 'announcements'];
  const moreOpen = $('#admin-more')?.open;
  const navLink = ([key, glyph, label]) => {
    const active = section === key;
    const count = key === 'orders' ? pending : key === 'inventory' ? lowIngredients.length : 0;
    return `<a href="#admin/${key}" class="${active?'active':''}" ${active?'aria-current="page"':''}>${icon(glyph)}<span>${label}</span>${count?`<span class="nav-count">${count}</span>`:''}</a>`;
  };
  const headingActions = {
    products: ['add-product', 'Add product'],
    inventory: ['add-ingredient', 'Add ingredient'],
    announcements: ['add-announcement', 'Write announcement']
  };
  const headingAction = headingActions[section];
  $('#main').innerHTML = `<div class="admin-layout">
    <aside class="admin-sidebar">
      <p class="eyebrow">THE KITCHEN</p><h2>Admin workspace</h2>
      <nav aria-label="Admin navigation">${tabs.map(navLink).join('')}</nav>
      <div class="sidebar-note">${icon('shield')}<strong>Kitchen admin</strong><p>Orders and inventory sync with the database.</p><a href="https://gracious-delights-chi.vercel.app/" target="_blank" rel="noopener noreferrer">View customer menu ↗</a></div>
      <button class="button secondary sign-out" data-action="logout">Sign out</button>
    </aside>
    <nav class="mobile-admin-nav" aria-label="Kitchen navigation">
      <div class="mobile-admin-links">${tabs.filter(([key])=>quickPages.includes(key)).map(navLink).join('')}</div>
      <details id="admin-more" class="${quickPages.includes(section)?'':'has-current'}" ${moreOpen?'open':''}>
        <summary>More ${icon('chevron')}</summary>
        <div class="mobile-admin-panel">
          ${tabs.filter(([key])=>!quickPages.includes(key)).map(navLink).join('')}
          <button class="mobile-more-item" data-action="install" data-mobile-install ${isInstalled()?'hidden':''}>${icon('download')} Install app</button>
          <button class="mobile-more-item mobile-sign-out" data-action="logout">Sign out</button>
        </div>
      </details>
    </nav>
    <section class="admin-content">
      <div class="admin-topline"><span class="local-pill"><span class="dot"></span>${storageError ? 'Connection issue' : 'Connected to kitchen'}</span></div>
      <div class="admin-heading ${section==='announcements'?'announcement-heading':''}">
        <div><h1>${labels[section][0]}</h1>${labels[section][1]?`<p>${labels[section][1]}</p>`:''}</div>
        ${headingAction?`<button class="button primary" data-action="${headingAction[0]}">${icon('plus')} ${headingAction[1]}</button>`:''}
      </div>
      <div id="admin-body"></div>
    </section>
  </div>`;
  const body = $('#admin-body');
  if (section === 'orders') {
    body.innerHTML=ordering.adminOrders();ordering.wireAdmin();
  } else if (section === 'announcements') {
    renderAnnouncementManager(body,state.announcements);
  } else if (section === 'presentation') {
    renderPresentationHistory(body,state.products);
  } else if (section === 'products') {
    body.innerHTML = `${state.products.some(p=>PRODUCT_PHOTOS[p.id] && p.image.startsWith('assets/menu-signs/'))?'<p><button class="button secondary" data-action="apply-product-photos">Use verified Facebook photos</button></p>':''}${SIGN_CATALOG.some(item=>!state.products.some(p=>p.id===item.id || p.name.toLowerCase()===item.name.toLowerCase()))?`<p><button class="button secondary" data-action="import-sign-menu">Add products from menu signs</button></p>`:''}<div class="stats-grid"><div class="stat"><span>Products on the menu</span><strong>${state.products.filter(p => p.active).length}<small>published delights</small></strong>${icon('box')}</div><div class="stat"><span>Ready to enjoy</span><strong>${state.products.reduce((n,p)=>n+p.stock,0)}<small>units in stock</small></strong>${icon('cake')}</div><div class="stat"><span>Running low</span><strong>${state.products.filter(p=>p.stock<=3).length}<small>products · 3 units or fewer</small></strong>${icon('history')}</div></div><div class="info-banner">${icon('leaf')}<span><strong>Inventory that follows your recipes.</strong> Producing stock deducts ingredients automatically. Set each product’s stock capacity in its product settings.</span></div><div class="table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Can make</th><th>Actions</th></tr></thead><tbody>${state.products.map(p=>`<tr><td><div class="table-product">${productPhoto(p)}<div><strong>${esc(p.name)}</strong><small>${esc(p.category)}${p.active?'':' · Hidden'}</small></div></div></td><td>${money(p.price)}</td><td>${stockBadge(p)}<small class="reserved-stock">${p.stock} on hand${reserved(state,p.id)?` · ${reserved(state,p.id)} reserved`:''}</small></td><td><span class="make-capacity">${p.recipePending?'Recipe needed':capacity(state,p)+' units'}</span></td><td><div class="table-actions"><button class="small-button" data-action="produce" data-id="${p.id}" ${capacity(state,p)===0?'disabled':''}>${icon('plus')} Stock</button><button class="icon-button" data-action="edit-product" data-id="${p.id}" aria-label="Edit ${esc(p.name)}">${icon('edit')}</button></div></td></tr>`).join('')}</tbody></table></div>`;
  } else if (section === 'inventory') {
    body.innerHTML = `${SIGN_CATALOG.some(item=>!state.products.some(p=>p.id===item.id || p.name.toLowerCase()===item.name.toLowerCase()))?`<p><button class="button secondary" data-action="import-sign-menu">Add products from menu signs</button></p>`:''}<div class="stats-grid"><div class="stat"><span>Kitchen essentials</span><strong>${state.ingredients.length}<small>tracked ingredients</small></strong>${icon('leaf')}</div><div class="stat"><span>Need replenishing</span><strong>${lowIngredients.length}<small>at or below their threshold</small></strong>${icon('history')}</div><div class="stat"><span>Base units</span><strong class="units-stat">g / ml / pcs<small>used in all recipes</small></strong>${icon('book')}</div></div>${lowIngredients.length?`<div class="info-banner warning">${icon('history')}<span><strong>Time for a kitchen restock.</strong> ${lowIngredients.map(i=>esc(i.name)).join(', ')} ${lowIngredients.length===1?'is':'are'} running low.</span></div>`:''}<div class="table-wrap"><table><thead><tr><th>Ingredient</th><th>On hand</th><th>Low stock at</th><th>Status</th><th>Actions</th></tr></thead><tbody>${state.ingredients.map(i=>`<tr><td><strong>${esc(i.name)}</strong></td><td><strong>${number(i.quantity)}</strong> <span class="subtle">${i.unit}</span></td><td>${number(i.threshold)} ${i.unit}</td><td><span class="stock ${i.quantity<=i.threshold?'low':''}"><span class="dot"></span>${i.quantity<=i.threshold?'Low stock':'Healthy'}</span></td><td><div class="table-actions"><button class="small-button" data-action="receive" data-id="${i.id}">${icon('plus')} Receive</button><button class="icon-button" data-action="adjust-ingredient" data-id="${i.id}" aria-label="Adjust ${esc(i.name)}">${icon('edit')}</button></div></td></tr>`).join('')}</tbody></table></div><p class="help-note">Enter weights in grams and liquids in milliliters. Example: 1 kg = 1,000 g. Piece quantities must be whole numbers.</p>`;
  } else if (section === 'recipes') {
    body.innerHTML = `<div class="info-banner">${icon('book')}<span><strong>One recipe = one sellable unit.</strong> For a platter or pack, include ingredients for the whole platter or pack. Changes apply to future production.</span></div><div class="recipe-grid">${state.products.map(p=>`<article class="recipe-card"><div class="recipe-card-header">${productPhoto(p)}<div><h3>${esc(p.name)}</h3><p>${esc(p.portion || '1 sellable unit')}</p></div></div><dl>${p.recipe.map(r=>{const i=state.ingredients.find(i=>i.id===r.ingredientId);return `<div><dt>${esc(i.name)}</dt><dd>${number(r.amount)} ${i.unit}</dd></div>`;}).join('')}</dl><button class="button secondary" data-action="edit-recipe" data-id="${p.id}">${icon('edit')} Edit recipe</button></article>`).join('')}</div>`;
  } else if (section === 'activity') {
    body.innerHTML = `<div class="activity-list">${state.activity.map(a=>`<article class="activity-item"><span class="activity-icon">${icon(a.type==='production'?'cake':a.type==='receipt'?'plus':a.type==='recipe'?'book':'history')}</span><div><h3>${esc(a.title)}</h3><time datetime="${a.at}">${new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short'}).format(new Date(a.at))}</time>${a.changes.length?`<div class="change-list">${a.changes.map(c=>`<span class="change ${c.amount<0?'negative':''}">${c.amount>0?'+':''}${number(c.amount)} ${c.unit} ${esc(c.name)}</span>`).join('')}</div>`:''}</div></article>`).join('')}</div>`;
  } else {
    body.innerHTML = '<div class="settings-card"><span class="eyebrow">SHOP RECORDS</span><h2>A little peace of mind.</h2><p>Orders, recipes, inventory, and product photos are stored in your shared database. This export contains current records; image files are held separately. Use Neon backups for complete recovery.</p><button class="button primary" data-action="export">Download JSON records</button></div><div class="settings-card"><h3>Kitchen setup</h3><p>Add ingredients with your actual quantities, then add products with verified prices and recipes. Stock production automatically deducts ingredients. New customer requests appear in Orders while this workspace is open.</p></div>';

  }
}
function applyProductPhotos(){
  const revision=state.revision;
  const candidates=state.products.filter(p=>PRODUCT_PHOTOS[p.id] && p.image.startsWith('assets/menu-signs/'));
  openModal('Use verified Facebook photos',`<form><p class="modal-description">Replace the menu sign artwork for ${candidates.length} matching ensaymada and cinnamon roll options. The owner's original photos are framed around the matching flavor. Products without a verified photo keep their current artwork.</p><div class="photo-update-preview">${candidates.map(p=>{const photo={...p,image:PRODUCT_PHOTOS[p.id].image};return `<div>${productPhoto(photo,'photo-update-thumb')}<strong>${esc(p.name)}</strong></div>`;}).join('')}</div>${formFooter('Update product photos')}</form>`);
  bindForm(async()=>{await commit({type:'applyProductPhotos'},revision);toast('Verified Facebook product photos saved.');});
}
function importSignMenu() {
  const revision=state.revision;
  const missing=SIGN_CATALOG.filter(item=>!state.products.some(p=>p.id===item.id || p.name.toLowerCase()===item.name.toLowerCase()));
  openModal('Add products from the menu signs',`<form><p class="modal-description">Add ${missing.length} products across ${SIGN_CATEGORIES.map(esc).join(', ')}. Each new product starts with zero stock and needs a kitchen recipe before production.</p><div class="table-wrap"><table><thead><tr><th>Product</th><th>Selling unit</th><th>Price</th></tr></thead><tbody>${missing.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.portion)}</td><td>${money(p.price)}</td></tr>`).join('')}</tbody></table></div>${formFooter('Add menu products')}</form>`);
  bindForm(async()=>{await commit({type:'importSignCatalog'},revision);toast('Menu products added with zero stock. Set up recipes in the kitchen.');});
}
function recipeRows(recipe) {
  return recipe.map(r=>recipeRow(r)).join('');
}
function recipeRow(r = {}) {
  return `<div class="recipe-row"><label>Ingredient<select class="recipe-ingredient" required><option value="">Choose ingredient</option>${state.ingredients.map(i=>`<option value="${i.id}" ${r.ingredientId===i.id?'selected':''}>${esc(i.name)} (${i.unit})</option>`).join('')}</select></label><label>Quantity per unit<input class="recipe-amount" type="number" step="0.001" min="0.001" max="1000000000" value="${r.amount ?? ''}" placeholder="0" required></label><button class="icon-button remove-recipe" type="button" aria-label="Remove recipe ingredient">${icon('close')}</button></div>`;
}
function readRecipe() {
  return [...$('#modal').querySelectorAll('.recipe-row')].map(row=>({ingredientId:row.querySelector('select').value,amount:Number(row.querySelector('input').value)}));
}
function wireRecipe() {
  document.querySelectorAll('#recipe-rows .recipe-row').forEach(row=>{
    const ingredient=state.ingredients.find(i=>i.id===row.querySelector('select').value);
    if(ingredient?.unit==='pcs'){row.querySelector('input').step='1';row.querySelector('input').min='1';}
  });
  $('#add-recipe-row').addEventListener('click',()=> { $('#recipe-rows').insertAdjacentHTML('beforeend',recipeRow()); $('#recipe-rows').lastElementChild.querySelector('select').focus(); });
  $('#recipe-rows').addEventListener('click', e=> { const button=e.target.closest('.remove-recipe'); if(button) button.closest('.recipe-row').remove(); });
  $('#recipe-rows').addEventListener('change', e=>{ if(e.target.matches('select')){const i=state.ingredients.find(i=>i.id===e.target.value);const input=e.target.closest('.recipe-row').querySelector('input');input.step=i?.unit==='pcs'?'1':'0.001';input.min=i?.unit==='pcs'?'1':'0.001';} });
}
function recipeSection(recipe) {
  return `<section class="recipe-editor"><div class="form-section-heading"><h3>Recipe per sellable unit</h3><button class="text-button" type="button" id="add-recipe-row">${icon('plus')} Ingredient</button></div><p class="help-note">Amounts for one loaf, cake, pack, or platter. Use each ingredient’s base unit.</p><div id="recipe-rows">${recipeRows(recipe)}</div></section>`;
}
const PHOTO_LIBRARY = [
  ['a354c03220336924','Banana bread'],['d48aa4ba35954fb9','Chocolate cake'],['f86ca2cd7d4f8442','Ube cake'],['b511fbfde20f8301','Cookies'],['d63443ed617e749b','Lumpia'],['14989151db935458','Family tray']
];
function productForm(id, recipeOnly = false) {
  const p = state.products.find(p=>p.id===id), revision=state.revision;
  let selectedImage = p?.image || '';
  if(recipeOnly){
    openModal(`Recipe · ${p.name}`,`<form><div class="info-banner">${icon('book')}<span>Editing a recipe does not change existing stock or return ingredients. The new recipe is used for the next batch.</span></div>${recipeSection(p.recipe)}${formFooter('Save recipe')}</form>`);
    wireRecipe();
    bindForm(async()=>{await commit({type:'editProduct',id,product:{...p,recipe:readRecipe()}},revision);toast('Recipe saved for future batches.');});
    return;
  }
  openModal(p ? 'Edit product' : 'Add product', `<form><div class="form-grid"><label class="full">Product name<input name="name" value="${esc(p?.name||'')}" maxlength="120" required placeholder="e.g. Loaded Banana Bread"></label><label>Category<select name="category" required><option value="">Choose a category</option>${SHOP_CATEGORIES.map(category => `<option value="${esc(category)}" ${p?.category === category ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select></label><label>Price (₱)<input type="number" name="price" value="${p?.price||''}" min="0.01" max="1000000000" step="0.01" required placeholder="180.00"></label><label>Selling unit<input name="portion" value="${esc(p?.portion||'')}" maxlength="100" placeholder="e.g. 1 loaf"></label>${!p?`<label>Initial stock<input type="number" name="stock" min="0" max="10000" step="1" value="0" required></label>`:`<div class="stock-field"><span>Current stock</span><strong>${p.stock} units</strong><small>Add batches with the + Stock button.</small></div>`}<label>Stock capacity<input name="stockLimit" type="number" min="${Math.max(1,p?.stock||0)}" max="10000" step="1" value="${p?stockLimit(p):MAX_STOCK}" required><small>Maximum sellable units on hand.</small></label><label class="full">Description<textarea name="description" maxlength="1000" rows="3" required placeholder="Tell customers what makes it special…">${esc(p?.description||'')}</textarea></label></div><section class="photo-editor"><h3>Product photo</h3><div class="photo-input"><img id="photo-preview" src="${esc(selectedImage || 'assets/placeholder.svg')}" alt="Product photo preview"><label class="upload-label">${icon('plus')} Upload your photo<input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp"><small>JPEG, PNG, or WebP · up to 8 MB</small></label></div><p class="help-note">Or use a photo from the Facebook page:</p><div class="photo-library">${PHOTO_LIBRARY.map(([file,label])=>`<button type="button" class="library-photo ${selectedImage.includes(file)?'active':''}" data-photo="assets/facebook/${file}.jpg" aria-label="Use ${label} photo" aria-pressed="${selectedImage.includes(file)}"><img src="assets/facebook/${file}.jpg" alt="${label}"></button>`).join('')}</div><p id="upload-error" class="form-error" role="status"></p></section>${recipeSection(p?.recipe || [{ingredientId:'',amount:''}])}<div class="info-banner">${icon('leaf')}<span>${p?'Recipe changes apply to future batches.':'Initial stock will consume ingredients from the recipe above. Insufficient ingredients will block saving.'}</span></div>${p?`<div class="edit-actions"><button type="button" class="text-button" data-action="toggle-product" data-id="${p.id}">${p.active?'Hide from customer menu':'Publish on customer menu'}</button><button type="button" class="text-button danger-text" data-action="remove-stock" data-id="${p.id}" ${available(state,p)===0?'disabled':''}>Record sale / waste</button></div>`:''}${formFooter(p?'Save product':'Add product')}</form>`);
  wireRecipe();
  let uploadPending = false;
  $('.photo-library').addEventListener('click', e=>{
    const btn=e.target.closest('[data-photo]');if(!btn)return;
    selectedImage=btn.dataset.photo;$('#photo-preview').src=selectedImage;$('#upload-error').textContent='';
    document.querySelectorAll('.library-photo').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-pressed',String(b===btn));});
  });
  $('#photo-upload').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    uploadPending=true;$('#upload-error').textContent='Preparing photo…';
    try{ selectedImage=await photoData(file);$('#photo-preview').src=selectedImage;$('#upload-error').textContent='Photo ready. Saved with this product.';document.querySelectorAll('.library-photo').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');}); }
    catch(err){$('#upload-error').textContent=err.message;}
    finally{uploadPending=false;}
  });
  bindForm(async data=>{
    if(uploadPending)throw new Error('Please wait for the photo to finish processing.');
    const product={name:data.get('name'),category:data.get('category'),price:Number(data.get('price')),portion:String(data.get('portion')).trim(),description:data.get('description'),image:selectedImage,recipe:readRecipe(),stock:p?p.stock:Number(data.get('stock')),stockLimit:Number(data.get('stockLimit'))};
    await commit(p?{type:'editProduct',id,product}:{type:'addProduct',product},revision);
    toast(p?'Product saved.':'Product added; ingredients deducted for initial stock.');
  });
}
async function photoData(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG, or WebP photo.');
  if(file.size>8*1024*1024)throw new Error('Choose a photo smaller than 8 MB.');
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('This photo could not be read. Choose another image.');});
  const ratio=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  return canvas.toDataURL('image/jpeg',0.82);
}
function produceForm(id) {
  const p=state.products.find(p=>p.id===id),revision=state.revision;
  openModal(`Produce · ${p.name}`,`<form><p class="modal-description">Add a batch to the menu. Ingredients are deducted only when you confirm production.</p><div class="production-product">${productPhoto(p)}<div>${stockBadge(p)}<strong>Room for ${stockLimit(p)-p.stock} more units</strong><small>Ingredients available for ${capacity(state,p)} units</small></div></div><label>Units to produce<input id="batch-quantity" name="quantity" type="number" min="1" max="${stockLimit(p)-p.stock}" step="1" value="1" required></label><h3 class="preview-heading">Ingredient deduction preview</h3><div id="deduction-preview"></div>${formFooter('Produce & add stock')}</form>`);
  function preview(){
    try{const quantity=Number($('#batch-quantity').value);const rows=requirements(state,p.recipe,quantity);$('#deduction-preview').innerHTML=`<div class="table-wrap preview-table"><table><thead><tr><th>Ingredient</th><th>Needed</th><th>After batch</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.enough?'':'insufficient'}"><td>${esc(r.name)}</td><td>${number(r.required)} ${r.unit}</td><td>${number(r.remaining)} ${r.unit}${!r.enough?' · shortage':''}</td></tr>`).join('')}</tbody></table></div>`;}
    catch(e){$('#deduction-preview').textContent=e.message;}
  }
  preview();$('#batch-quantity').addEventListener('input',preview);
  bindForm(async data=>{await commit({type:'produce',id,quantity:Number(data.get('quantity'))},revision);toast('Batch produced. Product stock and ingredient inventory updated.');});
}
function ingredientForm(id, kind='add') {
  const i=state.ingredients.find(i=>i.id===id),revision=state.revision;
  const title=kind==='receive'?`Receive · ${i.name}`:kind==='adjust'?`Count · ${i.name}`:'Add ingredient';
  let fields;
  if(kind==='receive')fields=`<div class="info-banner">${icon('leaf')}<span>Currently on hand: <strong>${number(i.quantity)} ${i.unit}</strong>. Received inventory is added to this amount.</span></div><label>Quantity received (${i.unit})<input name="quantity" type="number" min="${i.unit==='pcs'?1:0.001}" step="${i.unit==='pcs'?1:0.001}" required autofocus placeholder="e.g. ${i.unit==='pcs'?24:1000}"></label>`;
  else if(kind==='adjust')fields=`<p class="modal-description">Use a physical count to correct inventory. This adjustment will be recorded in the activity log.</p><div class="form-grid"><label>Corrected quantity (${i.unit})<input name="quantity" type="number" min="0" step="${i.unit==='pcs'?1:0.001}" value="${i.quantity}" required></label><label>Low stock threshold (${i.unit})<input name="threshold" type="number" min="0" step="${i.unit==='pcs'?1:0.001}" value="${i.threshold}" required></label><label class="full">Reason<input name="reason" maxlength="180" required placeholder="e.g. Physical count / spoilage"></label></div>`;
  else fields=`<div class="form-grid"><label class="full">Ingredient name<input name="name" maxlength="120" required placeholder="e.g. All-purpose flour"></label><label>Base unit<select name="unit" id="ingredient-unit"><option value="g">Grams (g)</option><option value="ml">Milliliters (ml)</option><option value="pcs">Pieces (pcs)</option></select></label><label>Opening quantity<input name="quantity" type="number" min="0" step="0.001" required placeholder="1000"></label><label class="full">Low stock threshold<input name="threshold" type="number" min="0" step="0.001" value="0" required></label></div><p class="help-note">Use one base unit consistently. 1 kg = 1,000 g; 1 liter = 1,000 ml. Units are fixed after creation to keep recipes consistent.</p>`;
  openModal(title,`<form>${fields}${formFooter(kind==='add'?'Add ingredient':kind==='receive'?'Receive inventory':'Save adjustment')}</form>`);
  if(kind==='add')$('#ingredient-unit').addEventListener('change',e=>{document.querySelectorAll('#modal input[type="number"]').forEach(el=>el.step=e.target.value==='pcs'?'1':'0.001');});
  bindForm(async data=>{
    const action=kind==='add'?{type:'addIngredient',ingredient:{name:data.get('name'),unit:data.get('unit'),quantity:Number(data.get('quantity')),threshold:Number(data.get('threshold'))}}:kind==='receive'?{type:'receiveIngredient',id,quantity:Number(data.get('quantity'))}:{type:'adjustIngredient',id,quantity:Number(data.get('quantity')),threshold:Number(data.get('threshold')),reason:data.get('reason')};
    await commit(action,revision);toast(kind==='add'?'Ingredient added.':'Ingredient inventory updated.');
  });
}
function removeStockForm(id){
  const p=state.products.find(p=>p.id===id),revision=state.revision;
  openModal(`Record sale / waste · ${p.name}`,`<form><div class="info-banner"><span>${available(state,p)} unreserved units (${p.stock} total on hand). Ingredients have already been used; removing finished stock does not add them back.</span></div><div class="form-grid"><label>Units to remove<input name="quantity" type="number" min="1" max="${available(state,p)}" step="1" value="1" required></label><label>Reason<input name="reason" maxlength="180" required placeholder="e.g. Sold in store / expired"></label></div>${formFooter('Record stock change')}</form>`);
  bindForm(async data=>{await commit({type:'removeStock',id,quantity:Number(data.get('quantity')),reason:data.get('reason')},revision);toast('Finished stock updated. Ingredients were not changed.');});
}
function downloadBackup(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`gracious-delights-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Backup downloaded.');
}
async function install(){
  if(isInstalled()){toast('Gracious Delights is already open as an app.');return;}
  if(deferredInstall){
    const prompt = deferredInstall;deferredInstall=null;installPromotion();
    try {await prompt.prompt();await prompt.userChoice;return;} catch { /* Browser declined the prompt; show its manual installation path. */ }
  }
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const embedded = /FBAN|FBAV|Instagram|Messenger|; wv\)/.test(navigator.userAgent);
  const steps = embedded
    ? '<li>Open the browser menu and choose <strong>Open in browser</strong>, or copy this website address into Chrome or Safari.</li><li>On Android, use the browser menu → <strong>Install app</strong> or <strong>Add to Home screen</strong>. On iPhone, use Share → <strong>Add to Home Screen</strong>.</li>'
    : apple
      ? '<li>Open this website in <strong>Safari</strong>.</li><li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Confirm by tapping <strong>Add</strong>.</li>'
      : '<li>Open this website in <strong>Chrome, Edge, or Samsung Internet</strong>.</li><li>Open the browser menu (⋮) and choose <strong>Install app</strong>, <strong>Install and create shortcut</strong>, or <strong>Add to Home screen</strong>.</li><li>Confirm the installation. If no option appears, keep the page open briefly and try again after reloading.</li>';
  openModal('Install Gracious Delights Admin',`<div class="install-content">${icon('download')}<p>Open the kitchen inbox from your home screen.</p><ol>${steps}</ol><p class="help-note">Go online to review orders and update stock.</p><button class="button secondary" data-action="close">Got it</button></div>`);
}
document.addEventListener('click',async e=>{
  const more = $('#admin-more');
  if (more?.open && !more.contains(e.target)) more.open = false;
  const currentLink = e.target.closest('#admin-more [aria-current="page"]');
  if (currentLink && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    more.open = false;
    focusHeading($('.admin-heading h1'));
  }
  const el=e.target.closest('[data-action]');if(!el)return;
  if (el.getAttribute('aria-disabled') === 'true') return;
  const action=el.dataset.action,id=el.dataset.id;
  await ordering.handleAction(action,id,el);
  if(action==='close')dialogs.close();


  if(action==='install')await install();
  if(action==='order-sound')await toggleOrderSound();
  if(action==='dismiss-install'){installDismissed=true;installPromotion();}

  if(action==='add-announcement'||action==='edit-announcement'){
    const item=action==='edit-announcement'?(state.announcements||[]).find(item=>item.id===id):null;
    if(action==='add-announcement'||item)announcementEditor(item,{openModal,formFooter,bindForm,commit,revision:state.revision,toast});
  }
  if(action==='toggle-announcement'){
    try{await commit({type:'toggleAnnouncement',id},state.revision);toast('Announcement visibility updated.');}catch(error){toast(error.message);}
  }
  if(action==='add-product')productForm();
  if(action==='import-sign-menu')importSignMenu();
  if(action==='apply-product-photos')applyProductPhotos();
  if(action==='edit-product')productForm(id);
  if(action==='edit-recipe')productForm(id,true);
  if(action==='produce')produceForm(id);
  if(action==='add-ingredient')ingredientForm();
  if(action==='receive')ingredientForm(id,'receive');
  if(action==='adjust-ingredient')ingredientForm(id,'adjust');
  if(action==='remove-stock')removeStockForm(id);
  if(action==='toggle-product'){try{await commit({type:'toggleProduct',id},state.revision);$('#modal').close();toast('Product visibility updated.');}catch(err){$('#form-error').textContent=err.message;}}
  if(action==='export')downloadBackup();
  if(action==='logout'){try{requestEpoch++;state=await api('logout',{});$('#modal').close();render();focusHeading($('#main h1'));}catch(error){toast(error.message);}}
  if(action==='retry')await refreshState();
});
document.addEventListener('keydown', event => {
  const more = $('#admin-more');
  if (event.key !== 'Escape' || $('#modal').open || !more?.open) return;
  event.preventDefault();
  more.open = false;
  more.querySelector('summary').focus();
});
document.addEventListener('focusin', event => {
  const more = $('#admin-more');
  if (more?.open && !$('#modal').open && !more.contains(event.target)) more.open = false;
});
function route(moveFocus = false){
  $('#admin-more')?.removeAttribute('open');
  const hash=location.hash;
  mode='admin';const next=hash.split('/')[1];section=['orders','announcements','presentation','products','inventory','recipes','activity','settings'].includes(next)?next:'orders';
  if($('#modal').open)$('#modal').close();
  render();
  window.scrollTo(0, 0);
  if (moveFocus) focusHeading($('#main h1'), true);
}
$('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  if (state.admin) focusHeading($('.admin-heading h1'));
  else $('#main').focus();
});
window.addEventListener('hashchange', () => route(true));
setInterval(refreshState,15000);
window.addEventListener('focus',refreshState);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;installPromotion();});
window.addEventListener('appinstalled',()=>{deferredInstall=null;installDismissed=true;installPromotion();toast('Gracious Delights installed.');});
standalone.addEventListener('change',installPromotion);
for(const event of ['online','offline'])window.addEventListener(event,()=>{if(navigator.onLine)refreshState();footer();toast(navigator.onLine?'You’re back online.':'You are offline. Reconnect to place orders or update the kitchen.');});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('App installation setup was unavailable. Please reload while online.'));
route();

refreshState();
