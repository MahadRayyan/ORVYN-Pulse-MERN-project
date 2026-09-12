import test from 'node:test';import request from 'supertest';import app from '../server/src/app.js';
test('HTTP layer rejects unauthenticated workspace access without contacting MongoDB',async()=>{await request(app).get('/api/workspaces').expect(401);});
test('HTTP layer rejects invalid registration data before persistence',async()=>{await request(app).post('/api/auth/register').send({name:'A',email:'bad',password:'x'}).expect(400);});
test('HTTP layer requires JSON for mutations',async()=>{await request(app).post('/api/auth/login').type('form').send('email=a').expect(415);});
test('HTTP layer blocks cross-origin writes',async()=>{await request(app).post('/api/auth/login').set('Origin','https://evil.example').send({}).expect(403);});
test('Production frontend is served by Express',async()=>{await request(app).get('/').expect(200).expect('Content-Type',/html/);});
