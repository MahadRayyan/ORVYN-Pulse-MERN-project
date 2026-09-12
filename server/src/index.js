import dotenv from 'dotenv';import {fileURLToPath} from 'node:url';dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url))});
import mongoose from 'mongoose';import app from './app.js';import {startScheduler} from './meta.js';
if(!process.env.MONGODB_URI)throw new Error('Set MONGODB_URI in server/.env. See README.md.');
await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});console.log('MongoDB connected');const server=app.listen(Number(process.env.PORT)||4000,()=>console.log('ORVYN Pulse API listening on port '+(process.env.PORT||4000)));const stop=startScheduler();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stop();server.close(async()=>{await mongoose.disconnect();process.exit(0);});});
