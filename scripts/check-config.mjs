import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
import {metaConfiguration} from '../server/src/meta-config.js';
dotenv.config({path:fileURLToPath(new URL('../server/.env',import.meta.url)),quiet:true});
const result=metaConfiguration();
console.log('MongoDB URI: '+(process.env.MONGODB_URI?'present':'missing'));
for(const c of result.checks)console.log(`${c.ready?'OK':'MISSING OR INVALID'}: ${c.key}`);
console.log('Configuration checks do not contact Meta or verify app approval.');
process.exitCode=result.configured&&process.env.MONGODB_URI?0:1;
