const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Intl.DateTimeFormat('en-PH',{dateStyle:'long',timeZone:'Asia/Manila'}).format(new Date(value));
// Original Facebook dates and photos matched to the imported announcement IDs.
const facebookPosts = new Map([
 ['1c5abd31-b984-44a4-96dd-672fcf497f20', {postedAt:'2026-10-30T17:53:00+08:00', photos:[
   {src:'assets/announcements/banana-bread-1926094079523620.jpg', alt:'Banana bread loaves in foil pans', width:964, height:1280},
   {src:'assets/announcements/banana-bread-1926094129523615.jpg', alt:'Packs of hopiang baboy in blue wrappers', width:960, height:1280},
   {src:'assets/announcements/banana-bread-1926094202856941.jpg', alt:'A hand holding a pack of hopiang baboy', width:960, height:1280},
   {src:'assets/announcements/banana-bread-1926094246190270.jpg', alt:'Stacks of wrapped hopiang baboy', width:960, height:1280},
   {src:'assets/announcements/banana-bread-1926094276190267.jpg', alt:'Assorted cinnamon rolls in foil trays', width:1280, height:964},
   {src:'assets/announcements/banana-bread-1926094322856929.jpg', alt:'A second view of the assorted cinnamon rolls', width:1280, height:964},
 ]}],
 ['5b19bb7c-73c3-42f7-9956-c7204390a218', {postedAt:'2026-11-13T14:10:00+08:00', photos:[
   {src:'assets/facebook/956932590e81fb31.jpg', alt:'Rows of assorted ensaymada on a red tray', width:1542, height:2047},
   {src:'assets/facebook/9d66c6b0e97996c2.jpg', alt:'Cheese-topped and assorted ensaymada', width:1542, height:2047},
   {src:'assets/facebook/28b43450fed7ba55.jpg', alt:'Ensaymada and cinnamon rolls ready for the Baywalk pop-up', width:1542, height:2047},
   {src:'assets/announcements/baywalk-return-1945383197594708.jpg', alt:'Cinnamon rolls in individual foil pans', width:964, height:1280},
 ]}],
 ['0ca8dfae-8ef9-456a-9df7-2b94d99fb1da', {postedAt:'2026-11-15T19:07:00+08:00', photos:[
   {src:'assets/announcements/baywalk-thank-you-1948504333949261.jpg', alt:'Customers at the pastry stall in daylight', width:720, height:1280},
   {src:'assets/announcements/baywalk-thank-you-1948504530615908.jpg', alt:'Customers beside the Baywalk stall at sunset', width:720, height:1280},
   {src:'assets/announcements/baywalk-thank-you-1948504517282576.jpg', alt:'Shoppers browsing the pastry trays in daylight', width:720, height:1280},
   {src:'assets/announcements/baywalk-thank-you-1948504627282565.jpg', alt:'The kitchen team serving shoppers at the Baywalk table', width:1280, height:720},
   {src:'assets/announcements/baywalk-thank-you-1948504437282584.jpg', alt:'Customers lined up at the Baywalk pop-up after dark', width:720, height:1280},
   {src:'assets/announcements/baywalk-thank-you-1948504417282586.jpg', alt:'Customers at the stall under the Baywalk lights', width:720, height:1280},
   {src:'assets/announcements/baywalk-thank-you-1948504340615927.jpg', alt:'Shoppers gathered around the pastry table at night', width:720, height:1280},
   {src:'assets/announcements/baywalk-thank-you-1948504693949225.jpg', alt:'A customer choosing treats at the evening pop-up', width:720, height:1280},
   {src:'assets/announcements/baywalk-thank-you-1948506440615717.jpg', alt:'The Gracious Delights team behind the pastry table', width:1280, height:720},
   {src:'assets/announcements/baywalk-thank-you-1948504737282554.jpg', alt:'A group of shoppers choosing pastries at the Baywalk', width:1280, height:720},
 ]}],
 ['ec6c9e31-3ee8-4540-a321-5a7b7c5cf64a', {postedAt:'2026-11-15T19:18:00+08:00', photos:[
   {src:'assets/announcements/baywalk-flyer-1948523487280679.jpg', alt:'Gracious Delights flyer for the Friday and Saturday Lingayen Baywalk pop-up', width:1254, height:1254},
 ]}],
]);
const previewsPerAnnouncement = 4;
const announcementDate = item => facebookPosts.get(item.id)?.postedAt || item.publishedAt || item.createdAt;

export const sortedAnnouncements = items => [...(items || [])].sort((a,b) =>
  Number(!!b.pinned) - Number(!!a.pinned) || Date.parse(announcementDate(b)) - Date.parse(announcementDate(a))
);

function renderPhotos(item) {
 const photos = facebookPosts.get(item.id)?.photos;
 if (!photos?.length) return '';
 const grid = items => `<ul class="announcement-photo-grid${photos.length === 1 ? ' single-photo' : ''}">${items.map(({src, alt, width, height}) => `
   <li><a href="${esc(src)}" aria-label="View full-size photo of ${esc(alt.toLowerCase())}">
     <img src="${esc(src)}" alt="${esc(alt)}" width="${width}" height="${height}" loading="lazy" decoding="async">
   </a></li>`).join('')}</ul>`;
 const remaining = photos.slice(previewsPerAnnouncement);
 return `<div class="announcement-photos" role="group" aria-label="Photos for ${esc(item.title)}">
   ${grid(photos.slice(0, previewsPerAnnouncement))}
   ${remaining.length ? `<details><summary>Show ${remaining.length} more ${remaining.length === 1 ? 'photo' : 'photos'}</summary>${grid(remaining)}</details>` : ''}
 </div>`;
}

export function renderAnnouncements(container,items){
 const published=sortedAnnouncements((items||[]).filter(item=>item.published));
 container.innerHTML=`<section class="announcements-page" aria-labelledby="announcements-title"><div class="announcements-intro"><h1 id="announcements-title">Announcements</h1><a class="text-button" href="#menu">Browse the menu →</a></div><div class="announcements-list">${published.length?published.map(item=>`<article class="announcement-card" aria-labelledby="announcement-${esc(item.id)}"><div class="announcement-meta">${item.pinned?'<span class="announcement-pin">Pinned update</span>':''}<time datetime="${esc(announcementDate(item))}">${date(announcementDate(item))}</time></div><h2 id="announcement-${esc(item.id)}">${esc(item.title)}</h2><p class="announcement-body">${esc(item.body)}</p>${renderPhotos(item)}</article>`).join(''):'<div class="announcements-empty"><h2>No announcements yet</h2></div>'}</div></section>`;
}

export function renderAnnouncementManager(container,items){
 const sorted=sortedAnnouncements(items);
 container.innerHTML=`<div class="announcement-admin-top"><p>Drafts are private. Published updates appear on the storefront. Pinned updates appear first.</p><button class="button primary" data-action="add-announcement">Write announcement</button></div><div class="announcements-list">${sorted.length?sorted.map(item=>`<article class="announcement-card"><div class="announcement-meta"><span class="announcement-state ${item.published?'is-published':''}">${item.published?'Published':'Draft'}</span>${item.pinned?'<span class="announcement-pin">Pinned</span>':''}${facebookPosts.has(item.id) ? `<time datetime="${esc(announcementDate(item))}">Facebook post · ${date(announcementDate(item))}</time>` : `<time datetime="${esc(item.updatedAt)}">Updated ${date(item.updatedAt)}</time>`}</div><h2>${esc(item.title)}</h2><p class="announcement-body">${esc(item.body)}</p>${renderPhotos(item)}<div class="announcement-actions"><button class="button secondary" data-action="edit-announcement" data-id="${esc(item.id)}" aria-label="Edit ${esc(item.title)}">Edit</button><button class="button secondary" data-action="toggle-announcement" data-id="${esc(item.id)}" aria-label="${item.published?'Unpublish':'Publish'} ${esc(item.title)}">${item.published?'Unpublish':'Publish'}</button></div></article>`).join(''):'<div class="announcements-empty"><h2>Your updates start here</h2><p>Write your first announcement, then publish it when it is ready for customers.</p></div>'}</div>`;
}

export function announcementEditor(item,{openModal,formFooter,bindForm,commit,revision,toast}){
 const id=item?.id||crypto.randomUUID();
 openModal(item?'Edit announcement':'Write announcement',`<form class="announcement-form"><label>Title<input name="title" maxlength="120" required value="${esc(item?.title)}" placeholder="Give your update a clear title"></label><label>Announcement<textarea name="body" maxlength="5000" rows="9" required placeholder="Write your update for customers…">${esc(item?.body)}</textarea></label><label class="announcement-check"><input name="pinned" type="checkbox" ${item?.pinned?'checked':''}> Pin this update at the top</label><label class="announcement-check"><input name="published" type="checkbox" ${item?.published?'checked':''}> Publish on the customer website</label><p class="help-note">Leave Publish unchecked to keep a private draft. Published updates are visible to everyone.</p>${formFooter(item?'Save changes':'Save announcement')}</form>`);
 bindForm(async data=>{
   await commit({type:item?'editAnnouncement':'addAnnouncement',id,announcement:{title:String(data.get('title')),body:String(data.get('body')),pinned:data.get('pinned')==='on',published:data.get('published')==='on'}},revision);
   toast(data.get('published')==='on'?'Announcement published.':'Announcement saved as a draft.');
 });
}
