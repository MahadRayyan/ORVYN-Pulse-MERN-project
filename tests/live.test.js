import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server/src/app.js';
import {metaConfiguration} from '../server/src/meta-config.js';
import {graph,discoverAccounts,syncAccount} from '../server/src/meta.js';
import {encrypt} from '../server/src/security.js';
import {User,Session,Workspace,Account,Post,Comment,Report,OAuthState} from '../server/src/models.js';
const wid='a'.repeat(24),uid='b'.repeat(24),aid='c'.repeat(24);
const config={META_APP_ID:'123456',META_APP_SECRET:'private-app-secret',TOKEN_ENCRYPTION_KEY:'ab'.repeat(32),APP_URL:'http://localhost:5173',META_REDIRECT_URI:'http://localhost:4000/api/meta/callback',NODE_ENV:'development'};
const response=body=>({ok:true,json:async()=>body});
function chain(value){return {lean:async()=>value,select:async()=>value,limit(){return this;},sort(){return this;}};}
function auth(t,role='owner'){
 t.mock.method(Session,'findOne',async()=>({userId:uid}));
 t.mock.method(User,'findById',async()=>({_id:uid,id:uid,name:'Owner',email:'owner@example.com'}));
 t.mock.method(Workspace,'findOne',async()=>({_id:wid,id:wid,owner:uid,timezone:'Asia/Karachi',members:[{userId:uid,role}]}));
 return request(app);
}
test('Meta setup requires credentials, matching callback host, and HTTPS in production',()=>{
 assert.equal(metaConfiguration(config).configured,true);
 assert.equal(metaConfiguration({...config,META_LOGIN_CONFIG_ID:'12345'}).configured,true);
 assert.equal(metaConfiguration({...config,META_LOGIN_CONFIG_ID:'invalid'}).configured,false);
 assert.equal(metaConfiguration({...config,META_APP_ID:''}).configured,false);
 assert.equal(metaConfiguration({...config,META_REDIRECT_URI:'https://elsewhere.example/api/meta/callback'}).configured,false);
 assert.equal(metaConfiguration({...config,NODE_ENV:'production'}).configured,false);
 assert.ok(!JSON.stringify(metaConfiguration(config)).includes(config.META_APP_SECRET));
});
test('Account discovery handles Facebook and a linked Instagram account',async()=>{
 const fetcher=async url=>{const p=new URL(url).pathname;
  if(p.endsWith('/me/permissions'))return response({data:['pages_show_list','pages_read_engagement','instagram_basic','read_insights','instagram_manage_insights','instagram_manage_comments'].map(permission=>({permission,status:'granted'}))});
  if(p.endsWith('/me/accounts'))return response({data:[{id:'page1',name:'Brand',access_token:'page-token'}]});
  assert.ok(p.endsWith('/page1'));return response({instagram_business_account:{id:'ig1',username:'brand'}});
 };
 const r=await discoverAccounts('user-token',fetcher);assert.deepEqual(r.accounts.map(a=>a.platform),['facebook','instagram']);assert.equal(r.accounts[1].token,'page-token');
});
test('Missing Instagram permission still allows Facebook discovery with a warning',async()=>{
 const fetcher=async url=>response(new URL(url).pathname.endsWith('/permissions')?{data:['pages_show_list','pages_read_engagement'].map(permission=>({permission,status:'granted'}))}:{data:[{id:'page1',name:'Brand',access_token:'token'}]});
 const r=await discoverAccounts('user-token',fetcher);assert.equal(r.accounts.length,1);assert.equal(r.accounts[0].platform,'facebook');assert.ok(r.warnings.some(w=>w.includes('instagram_basic')));
});
test('Declined Page permission prevents account discovery',async()=>{
 await assert.rejects(()=>discoverAccounts('user-token',async()=>response({data:[]})),/Grant pages_show_list/);
});
test('Provider errors are actionable and cannot echo provider secrets',async()=>{
 await assert.rejects(()=>graph('me','secret-token',{},async()=>({ok:false,json:async()=>({error:{code:190,message:'secret-token leaked'}})})),e=>e.metaCode===190&&/Reconnect/.test(e.message)&&!e.message.includes('secret-token'));
});
test('Analytics defaults to live records and constrains posts to connected accounts',async t=>{
 const client=auth(t);let postFilter,commentFilter,accountFilter;
 t.mock.method(Account,'find',f=>{accountFilter=f;return chain([{_id:aid}]);});
 t.mock.method(Post,'find',f=>{postFilter=f;return chain([]);});
 t.mock.method(Comment,'find',f=>{commentFilter=f;return chain([]);});
 const r=await client.get(`/api/workspaces/${wid}/analytics`).set('Cookie','pulse_session=test').expect(200);
 assert.equal(r.body.filters.source,'live');for(const f of [postFilter,commentFilter,accountFilter]){assert.equal(f.source,'live');assert.equal(f.workspaceId,wid);}
 assert.deepEqual(postFilter.accountId,{$in:[aid]});
});
test('Legacy sample selection is rejected and the seeding endpoint is removed',async t=>{
 const client=auth(t);
 await client.get(`/api/workspaces/${wid}/analytics?source=demo`).set('Cookie','pulse_session=test').expect(400);
 await client.post(`/api/workspaces/${wid}/demo`).set('Cookie','pulse_session=test').send({}).expect(404);
});
test('Account lists and saved report lists enforce live filtering',async t=>{
 const client=auth(t);let af,rf;
 t.mock.method(Account,'find',f=>{af=f;return chain([]);});t.mock.method(Report,'find',f=>{rf=f;return {select(){return chain([]);}};});
 await client.get(`/api/workspaces/${wid}/accounts`).set('Cookie','pulse_session=test').expect(200);
 await client.get(`/api/workspaces/${wid}/reports`).set('Cookie','pulse_session=test').expect(200);
 assert.equal(af.source,'live');assert.equal(rf['filters.source'],'live');
});
test('Legacy report IDs cannot bypass the live-only report filter',async t=>{
 const client=auth(t);let filter;t.mock.method(Report,'findOne',f=>{filter=f;return chain(null);});
 await client.get(`/api/workspaces/${wid}/reports/${aid}`).set('Cookie','pulse_session=test').expect(404);
 assert.equal(filter['filters.source'],'live');assert.equal(filter.workspaceId,wid);
});
test('Empty imported analytics cannot create a misleading report',async t=>{
 const client=auth(t);for(const m of [Account,Post,Comment])t.mock.method(m,'find',()=>chain([]));
 await client.post(`/api/workspaces/${wid}/reports`).set('Cookie','pulse_session=test').send({title:'Empty'}).expect(400);
});
test('Callback with an invalid state returns to the application with an error',async t=>{
 auth(t);t.mock.method(OAuthState,'findOneAndDelete',async()=>null);
 const r=await request(app).get('/api/meta/callback?state='+'a'.repeat(64)).set('Cookie','pulse_session=test').expect(302);
 const target=new URL(r.headers.location);assert.equal(target.searchParams.get('connection'),'error');assert.match(target.searchParams.get('message'),/expired/);
});
test('Instagram synchronization maps real provider response fields into live records',async t=>{
 const oldKey=process.env.TOKEN_ENCRYPTION_KEY;process.env.TOKEN_ENCRYPTION_KEY=config.TOKEN_ENCRYPTION_KEY;t.after(()=>{if(oldKey===undefined)delete process.env.TOKEN_ENCRYPTION_KEY;else process.env.TOKEN_ENCRYPTION_KEY=oldKey;});
 const updates=[],posts=[],comments=[];
 t.mock.method(Account,'findOneAndUpdate',()=>({select:async()=>({_id:aid,workspaceId:wid,platform:'instagram',remoteId:'ig1',token:encrypt('provider-token')})}));
 t.mock.method(Account,'updateOne',async(f,u)=>{updates.push(u);return {matchedCount:1};});t.mock.method(Account,'exists',async()=>({_id:aid}));
 t.mock.method(Post,'findOneAndUpdate',async(f,u)=>{posts.push(u.$set);return {_id:'postid'};});t.mock.method(Comment,'bulkWrite',async rows=>{comments.push(...rows);});
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer provider-token');const u=new URL(url),path=u.pathname;
  if(path.endsWith('/ig1'))return response({followers_count:120});
  if(path.endsWith('/ig1/media'))return response({data:[{id:'media1',caption:'Account content',media_type:'VIDEO',media_product_type:'REELS',timestamp:'2026-09-01T12:00:00Z',like_count:12,comments_count:1}]});
  if(path.endsWith('/media1/insights'))return response({data:[{values:[{value:{reach:100,saved:4,shares:3}[u.searchParams.get('metric')]}]}]});
  if(path.endsWith('/media1/comments'))return response({data:[{id:'comment1',text:'Great',timestamp:'2026-09-01T13:00:00Z'}]});
  throw new Error('Unexpected provider request');
 });
 const result=await syncAccount(aid);assert.equal(result.imported,1);assert.equal(posts[0].source,'live');assert.equal(posts[0].reach,100);assert.equal(posts[0].saves,4);assert.equal(posts[0].shares,3);assert.equal(posts[0].format,'REEL');assert.equal(comments[0].updateOne.update.$set.source,'live');assert.ok(updates.some(u=>u.$set?.status==='connected'&&u.$set?.followers===120));
});
test('Facebook imports interactions and comments even without a reach metric',async t=>{
 const priorKey=process.env.TOKEN_ENCRYPTION_KEY,priorMetric=process.env.META_FB_REACH_METRIC;process.env.TOKEN_ENCRYPTION_KEY=config.TOKEN_ENCRYPTION_KEY;delete process.env.META_FB_REACH_METRIC;
 t.after(()=>{for(const [key,value] of [['TOKEN_ENCRYPTION_KEY',priorKey],['META_FB_REACH_METRIC',priorMetric]])if(value===undefined)delete process.env[key];else process.env[key]=value;});
 let post;
 t.mock.method(Account,'findOneAndUpdate',()=>({select:async()=>({_id:aid,workspaceId:wid,platform:'facebook',remoteId:'page1',token:encrypt('page-token')})}));
 t.mock.method(Account,'updateOne',async()=>({matchedCount:1}));t.mock.method(Account,'exists',async()=>({_id:aid}));
 t.mock.method(Post,'findOneAndUpdate',async(f,u)=>{post=u.$set;return {_id:'postid'};});t.mock.method(Comment,'bulkWrite',async()=>{});
 t.mock.method(globalThis,'fetch',async url=>{
  const p=new URL(url).pathname;
  if(p.endsWith('/page1'))return response({followers_count:200});
  if(p.endsWith('/page1/posts'))return response({data:[{id:'post1',message:'Page content',created_time:'2026-09-01T12:00:00Z'}]});
  if(p.endsWith('/post1'))return response({shares:{count:5},reactions:{summary:{total_count:20}},comments:{summary:{total_count:3}}});
  if(p.endsWith('/post1/comments'))return response({data:[]});
  throw new Error('Unexpected request');
 });
 const result=await syncAccount(aid);assert.equal(post.reach,null);assert.equal(post.likes,20);assert.equal(post.shares,5);assert.equal(post.commentsCount,3);assert.ok(result.warnings.some(w=>w.includes('reach is unavailable')));
});
test('Revoked credentials on an optional request require reconnection instead of success',async t=>{
 const prior=process.env.TOKEN_ENCRYPTION_KEY;process.env.TOKEN_ENCRYPTION_KEY=config.TOKEN_ENCRYPTION_KEY;t.after(()=>{if(prior===undefined)delete process.env.TOKEN_ENCRYPTION_KEY;else process.env.TOKEN_ENCRYPTION_KEY=prior;});
 const updates=[];
 t.mock.method(Account,'findOneAndUpdate',()=>({select:async()=>({_id:aid,workspaceId:wid,platform:'facebook',remoteId:'page1',token:encrypt('expired-token')})}));
 t.mock.method(Account,'updateOne',async(f,u)=>{updates.push(u);return {matchedCount:1};});t.mock.method(Account,'exists',async()=>({_id:aid}));
 t.mock.method(globalThis,'fetch',async()=>({ok:false,json:async()=>({error:{code:190}})}));
 await assert.rejects(()=>syncAccount(aid),/Reconnect/);assert.ok(updates.some(u=>u.$set?.status==='reconnect_required'));assert.ok(!updates.some(u=>u.$set?.status==='connected'));
});
