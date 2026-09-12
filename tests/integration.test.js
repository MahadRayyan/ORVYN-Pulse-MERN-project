import test from 'node:test';import assert from 'node:assert/strict';import request from 'supertest';import mongoose from 'mongoose';import {MongoMemoryServer} from 'mongodb-memory-server';
import app from '../server/src/app.js';import {Account,Post,Report} from '../server/src/models.js';
// Fixtures exist exclusively inside a temporary test database, never in the application.
test('MERN database integration with live-only account filtering',async t=>{
 const mongo=process.env.TEST_MONGODB_URI?null:await MongoMemoryServer.create();
 process.env.APP_URL='http://localhost:5173';process.env.TOKEN_ENCRYPTION_KEY='ab'.repeat(32);
 await mongoose.connect(process.env.TEST_MONGODB_URI||mongo.getUri(),{dbName:'pulse_test_'+Date.now()});
 const a=request.agent(app),b=request.agent(app),c=request.agent(app);
 try{
  await t.test('Register independent users',async()=>{for(const [agent,name] of [[a,'Owner'],[b,'Other'],[c,'Viewer']])await agent.post('/api/auth/register').send({name,email:name.toLowerCase()+'@example.com',password:'secure-test-password'}).expect(201);});
  const wid=(await a.get('/api/workspaces')).body[0]._id;
  const account=await Account.create({workspaceId:wid,platform:'facebook',remoteId:'test-page',source:'live',name:'Test fixture',token:'ENCRYPTED_FIXTURE'});
  await Post.create({workspaceId:wid,accountId:account._id,remoteId:'test-post',platform:'facebook',source:'live',caption:'Contract fixture',publishedAt:new Date(),likes:20,commentsCount:2,shares:1,saves:0,reach:100,format:'POST'});
  const legacyId=new mongoose.Types.ObjectId();
  await Account.collection.insertOne({_id:legacyId,workspaceId:new mongoose.Types.ObjectId(wid),source:'demo',remoteId:'legacy',platform:'facebook'});
  await Post.collection.insertOne({workspaceId:new mongoose.Types.ObjectId(wid),accountId:legacyId,source:'demo',publishedAt:new Date(),likes:99999});
  const oldReport=await Report.create({workspaceId:wid,title:'Legacy',filters:{source:'demo'},data:{}});
  await t.test('Tenant isolation and viewer write rejection',async()=>{
   await b.get(`/api/workspaces/${wid}/analytics`).expect(403);
   await a.post(`/api/workspaces/${wid}/members`).send({email:'viewer@example.com',role:'viewer'}).expect(200);
   await c.get(`/api/workspaces/${wid}/analytics`).expect(200);
   await c.post(`/api/workspaces/${wid}/reports`).send({title:'Forbidden'}).expect(403);
   await c.post(`/api/workspaces/${wid}/meta/connect`).send({}).expect(403);
  });
  await t.test('Legacy data is inaccessible through analytics, accounts, reports, and seeding',async()=>{
   const analytics=await a.get(`/api/workspaces/${wid}/analytics`).expect(200);assert.equal(analytics.body.summary.posts,1);assert.equal(analytics.body.summary.interactions,23);assert.equal(analytics.body.filters.source,'live');
   const rows=await a.get(`/api/workspaces/${wid}/accounts`).expect(200);assert.equal(rows.body.length,1);assert.ok(!('token' in rows.body[0]));
   await a.get(`/api/workspaces/${wid}/analytics?source=demo`).expect(400);
   await a.post(`/api/workspaces/${wid}/demo`).send({}).expect(404);
   await a.get(`/api/workspaces/${wid}/reports/${oldReport.id}`).expect(404);
  });
  let reportId;
  await t.test('Live reports preserve snapshots',async()=>{
   const report=await a.post(`/api/workspaces/${wid}/reports`).send({title:'Snapshot'}).expect(201);reportId=report.body._id;
   await Post.updateOne({accountId:account._id},{$set:{likes:100}});
   const saved=await a.get(`/api/workspaces/${wid}/reports/${reportId}`).expect(200);assert.equal(saved.body.data.summary.interactions,23);
   const list=await a.get(`/api/workspaces/${wid}/reports`).expect(200);assert.equal(list.body.length,1);
  });
  await t.test('Disconnect removes working content but retains saved live reports',async()=>{
   await b.delete(`/api/workspaces/${wid}/accounts/${account.id}`).send({}).expect(403);
   await a.delete(`/api/workspaces/${wid}/accounts/${account.id}`).send({}).expect(200);
   assert.equal(await Post.countDocuments({accountId:account._id}),0);
   await a.get(`/api/workspaces/${wid}/reports/${reportId}`).expect(200);
  });
  await t.test('Logout revokes access',async()=>{await a.post('/api/auth/logout').send({}).expect(200);await a.get('/api/workspaces').expect(401);});
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();if(mongo)await mongo.stop();}
});
