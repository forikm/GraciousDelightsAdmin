import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {transition,createSeed} from '../domain.js';
import {mutate,readState,present} from '../lib/store.js';
import {testDatabase} from './database-helper.mjs';

test('announcement drafts, publication, edits, pinning, and retries preserve inventory',()=>{
 const seed=createSeed(),id=randomUUID();
 const action={type:'addAnnouncement',id,announcement:{title:'New batch update',body:'First line\nSecond line',published:false,pinned:false}};
 const draft=transition(seed,action);
 assert.equal(draft.announcements[0].publishedAt,null);
 assert.deepEqual(draft.products,seed.products);assert.deepEqual(draft.ingredients,seed.ingredients);assert.deepEqual(draft.orders,seed.orders);
 assert.deepEqual(transition(draft,action),draft);
 const published=transition(draft,{type:'toggleAnnouncement',id});assert.equal(published.announcements[0].published,true);assert.ok(published.announcements[0].publishedAt);
 const edited=transition(published,{type:'editAnnouncement',id,announcement:{...action.announcement,title:'Corrected batch update',published:true,pinned:true}});
 assert.equal(edited.announcements[0].pinned,true);assert.equal(edited.announcements[0].publishedAt,published.announcements[0].publishedAt);
 const hidden=transition(edited,{type:'toggleAnnouncement',id});assert.equal(hidden.announcements[0].published,false);
 assert.deepEqual(present(hidden,{admin:false,owner:'guest'}).announcements,[]);
 assert.equal(present(hidden,{admin:true,owner:'owner'}).announcements.length,1);
 assert.throws(()=>transition(seed,{...action,announcement:{...action.announcement,title:' '}}),/title/);
 assert.throws(()=>transition(seed,{...action,announcement:{...action.announcement,body:'x'.repeat(5001)}}),/5,000|5000/);
 assert.throws(()=>transition(seed,{...action,announcement:{...action.announcement,published:'true'}}),/visibility/);
 assert.throws(()=>transition(seed,{type:'editAnnouncement',id,announcement:action.announcement}),/no longer exists/);
});

test('shared database hides drafts, rejects customer writes, and publishes to customer state',async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 const admin={admin:true,owner:'admin'},guest={admin:false,owner:'guest'},id=randomUUID();
 assert.deepEqual((await readState(db,guest)).announcements,[]);
 const action={type:'addAnnouncement',id,announcement:{title:'Kitchen update',body:'Customer-visible text',published:false,pinned:true}};
 await assert.rejects(mutate(db,guest,{action,revision:0}),{status:403});
 const draft=await mutate(db,admin,{action,revision:0});
 assert.equal(draft.announcements.length,1);assert.equal((await readState(db,guest)).announcements.length,0);
 await assert.rejects(mutate(db,guest,{action:{type:'toggleAnnouncement',id},revision:draft.revision}),{status:403});
 await assert.rejects(mutate(db,admin,{action:{type:'toggleAnnouncement',id},revision:0}),{status:409});
 const published=await mutate(db,admin,{action:{type:'toggleAnnouncement',id},revision:draft.revision});
 assert.equal((await readState(db,guest)).announcements[0].title,'Kitchen update');
 await mutate(db,admin,{action:{type:'toggleAnnouncement',id},revision:published.revision});
 assert.equal((await readState(db,guest)).announcements.length,0);
});
