const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Intl.DateTimeFormat('en-PH',{dateStyle:'long',timeZone:'Asia/Manila'}).format(new Date(value));
export const sortedAnnouncements=items=>[...(items||[])].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||new Date(b.publishedAt||b.createdAt)-new Date(a.publishedAt||a.createdAt));

export function renderAnnouncements(container,items){
 const published=sortedAnnouncements((items||[]).filter(item=>item.published));
 container.innerHTML=`<section class="announcements-page" aria-labelledby="announcements-title"><div class="announcements-intro"><h1 id="announcements-title">Announcements</h1><a class="text-button" href="#menu">Browse the menu →</a></div><div class="announcements-list">${published.length?published.map(item=>`<article class="announcement-card" aria-labelledby="announcement-${esc(item.id)}"><div class="announcement-meta">${item.pinned?'<span class="announcement-pin">Pinned update</span>':''}<time datetime="${esc(item.publishedAt||item.createdAt)}">${date(item.publishedAt||item.createdAt)}</time></div><h2 id="announcement-${esc(item.id)}">${esc(item.title)}</h2><p class="announcement-body">${esc(item.body)}</p></article>`).join(''):'<div class="announcements-empty"><h2>No announcements yet</h2></div>'}</div></section>`;
}

export function renderAnnouncementManager(container,items){
 const sorted=sortedAnnouncements(items);
 container.innerHTML=`<div class="announcement-admin-top"><p>Drafts are private. Published updates appear on the storefront. Pinned updates appear first.</p><button class="button primary" data-action="add-announcement">Write announcement</button></div><div class="announcements-list">${sorted.length?sorted.map(item=>`<article class="announcement-card"><div class="announcement-meta"><span class="announcement-state ${item.published?'is-published':''}">${item.published?'Published':'Draft'}</span>${item.pinned?'<span class="announcement-pin">Pinned</span>':''}<time datetime="${esc(item.updatedAt)}">Updated ${date(item.updatedAt)}</time></div><h2>${esc(item.title)}</h2><p class="announcement-body">${esc(item.body)}</p><div class="announcement-actions"><button class="button secondary" data-action="edit-announcement" data-id="${esc(item.id)}" aria-label="Edit ${esc(item.title)}">Edit</button><button class="button secondary" data-action="toggle-announcement" data-id="${esc(item.id)}" aria-label="${item.published?'Unpublish':'Publish'} ${esc(item.title)}">${item.published?'Unpublish':'Publish'}</button></div></article>`).join(''):'<div class="announcements-empty"><h2>Your updates start here</h2><p>Write your first announcement, then publish it when it is ready for customers.</p></div>'}</div>`;
}

export function announcementEditor(item,{openModal,formFooter,bindForm,commit,revision,toast}){
 const id=item?.id||crypto.randomUUID();
 openModal(item?'Edit announcement':'Write announcement',`<form class="announcement-form"><label>Title<input name="title" maxlength="120" required value="${esc(item?.title)}" placeholder="Give your update a clear title"></label><label>Announcement<textarea name="body" maxlength="5000" rows="9" required placeholder="Write your update for customers…">${esc(item?.body)}</textarea></label><label class="announcement-check"><input name="pinned" type="checkbox" ${item?.pinned?'checked':''}> Pin this update at the top</label><label class="announcement-check"><input name="published" type="checkbox" ${item?.published?'checked':''}> Publish on the customer website</label><p class="help-note">Leave Publish unchecked to keep a private draft. Published updates are visible to everyone.</p>${formFooter(item?'Save changes':'Save announcement')}</form>`);
 bindForm(async data=>{
   await commit({type:item?'editAnnouncement':'addAnnouncement',id,announcement:{title:String(data.get('title')),body:String(data.get('body')),pinned:data.get('pinned')==='on',published:data.get('published')==='on'}},revision);
   toast(data.get('published')==='on'?'Announcement published.':'Announcement saved as a draft.');
 });
}
