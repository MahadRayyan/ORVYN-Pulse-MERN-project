import {createHmac} from 'node:crypto';
import {Account,Post,Comment} from './models.js';
import {decrypt,randomToken} from './security.js';

export const apiVersion=()=>{
 const v=process.env.META_API_VERSION||'v25.0';
 if(!/^v\d+\.0$/.test(v))throw new Error('Invalid META_API_VERSION');
 return v;
};
export function providerError(code){
 if(code===190)return 'Meta access expired or was revoked. Reconnect this account.';
 if([10,200,294].includes(code))return 'Meta denied a permission. Check Page access, app permissions, and app mode, then reconnect.';
 if([4,17,32,613].includes(code))return 'Meta rate limit reached. Wait before synchronizing again.';
 if(code===100)return 'Meta rejected a field or metric. Check the configured API version and account eligibility.';
 return 'Meta could not complete the request. Check app configuration and retry.';
}
export async function graph(path,token,params={},fetcher=fetch){
 const url=new URL(`https://graph.facebook.com/${apiVersion()}/${path.replace(/^\//,'')}`);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
 if(token&&process.env.META_APP_SECRET)url.searchParams.set('appsecret_proof',createHmac('sha256',process.env.META_APP_SECRET).update(token).digest('hex'));
 let res,body;
 try{res=await fetcher(url,{headers:token?{Authorization:`Bearer ${token}`}:{},redirect:'error',signal:AbortSignal.timeout(20000)});body=await res.json();}
 catch{throw Object.assign(new Error('Could not reach Meta. Check your internet connection and retry.'),{metaCode:0});}
 if(!res.ok||body.error){const code=body.error?.code||0;throw Object.assign(new Error(providerError(code)),{metaCode:code});}
 return body;
}
export async function paged(path,token,params={},limit=100,fetcher=fetch){
 const out=[];let after;
 for(let i=0;i<10&&out.length<limit;i++){
  const body=await graph(path,token,{...params,limit:Math.min(50,limit-out.length),...(after?{after}:{})},fetcher);
  out.push(...(body.data||[]));
  if(!body.paging?.next||!body.paging?.cursors?.after)break;
  after=body.paging.cursors.after;
 }
 return out.slice(0,limit);
}
async function optional(fn,warnings,label){
 try{return await fn();}catch(e){if(e.metaCode===190)throw e;warnings.add(label+': '+e.message);return null;}
}
export async function discoverAccounts(token,fetcher=fetch){
 const permissions=await paged('me/permissions',token,{},100,fetcher);
 const granted=new Set(permissions.filter(p=>p.status==='granted').map(p=>p.permission));
 const required=['pages_show_list','pages_read_engagement'];
 if(!required.every(p=>granted.has(p)))throw Object.assign(new Error('Grant pages_show_list and pages_read_engagement to connect your Facebook Pages.'),{metaCode:200});
 // Discover Pages first so a missing Instagram permission cannot block Facebook.
 const pages=await paged('me/accounts',token,{fields:'id,name,access_token'},100,fetcher);
 const warnings=new Set(),accounts=[];
 for(const permission of ['read_insights','instagram_basic','instagram_manage_insights','instagram_manage_comments'])if(!granted.has(permission))warnings.add(`Permission not granted: ${permission}. Related metrics or Instagram content may be unavailable.`);
 for(const page of pages){
  if(!page.access_token){warnings.add('A Page did not provide an access token. Check your access to that Page.');continue;}
  accounts.push({remoteId:page.id,name:page.name,platform:'facebook',token:page.access_token});
  if(!granted.has('instagram_basic'))continue;
  const linked=await optional(()=>graph(page.id,page.access_token,{fields:'instagram_business_account{id,username,name}'},fetcher),warnings,'Instagram discovery');
  const ig=linked?.instagram_business_account;
  if(ig)accounts.push({remoteId:ig.id,name:ig.name||ig.username,username:ig.username,platform:'instagram',token:page.access_token});
 }
 if(!accounts.some(a=>a.platform==='instagram'))warnings.add('No linked Instagram professional account was found. Link your Business or Creator account to a selected Facebook Page and grant Instagram permissions.');
 return {accounts:[...new Map(accounts.map(a=>[a.platform+':'+a.remoteId,a])).values()],warnings:[...warnings]};
}
export async function syncAccount(accountId){
 const tokenId=randomToken();
 const account=await Account.findOneAndUpdate({_id:accountId,source:'live',$or:[{syncLockUntil:{$lt:new Date()}},{syncLockUntil:null}]},{$set:{status:'syncing',lastSyncAttempt:new Date(),lastError:null,syncLockUntil:new Date(Date.now()+180000),syncLock:tokenId}},{new:true}).select('+token');
 if(!account)return {skipped:true};
 const warnings=new Set();let imported=0;
 try{
  const token=decrypt(account.token),ig=account.platform==='instagram';
  const profile=await optional(()=>graph(account.remoteId,token,{fields:ig?'followers_count':'followers_count'}),warnings,'Followers');
  const media=await paged(`${account.remoteId}/${ig?'media':'posts'}`,token,{fields:ig?'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count':'id,message,created_time,permalink_url'},60);
  for(const item of media){
   const lease=await Account.updateOne({_id:account._id,syncLock:tokenId},{$set:{syncLockUntil:new Date(Date.now()+180000)}});
   if(!lease.matchedCount)throw new Error('Account was disconnected or synchronization ownership changed.');
   let reach=null,saves=0,shares=0,likes=item.like_count??0,commentsCount=item.comments_count??0;
   if(ig){
    for(const metric of ['reach','saved','shares']){
     const r=await optional(()=>graph(`${item.id}/insights`,token,{metric}),warnings,metric);
     const value=r?.data?.[0]?.values?.[0]?.value??r?.data?.[0]?.total_value?.value;
     if(typeof value==='number'){if(metric==='reach')reach=value;else if(metric==='saved')saves=value;else shares=value;}
    }
   }else{
    // Counter permissions can fail without preventing metadata import.
    const counters=await optional(()=>graph(item.id,token,{fields:'shares,reactions.limit(0).summary(true),comments.limit(0).summary(true)'}),warnings,'Post interactions');
    shares=counters?.shares?.count??0;likes=counters?.reactions?.summary?.total_count??0;commentsCount=counters?.comments?.summary?.total_count??0;
    const metric=process.env.META_FB_REACH_METRIC?.trim();
    if(metric){const r=await optional(()=>graph(`${item.id}/insights`,token,{metric}),warnings,'Facebook reach');const value=r?.data?.[0]?.values?.[0]?.value??r?.data?.[0]?.total_value?.value;if(typeof value==='number')reach=value;}
    else warnings.add('Facebook reach is unavailable. Configure a supported reach metric for your Graph version; views are not reach.');
   }
   const post=await Post.findOneAndUpdate({accountId:account._id,remoteId:item.id},{$set:{workspaceId:account.workspaceId,accountId:account._id,remoteId:item.id,platform:account.platform,source:'live',caption:item.caption||item.message||'',format:ig?(item.media_product_type==='REELS'?'REEL':item.media_type==='CAROUSEL_ALBUM'?'CAROUSEL':item.media_type):'POST',permalink:item.permalink||item.permalink_url,publishedAt:new Date(item.timestamp||item.created_time),likes,commentsCount,shares,saves,reach,metricsUpdatedAt:new Date()}},{upsert:true,new:true});
   imported++;
   const comments=await optional(()=>paged(`${item.id}/comments`,token,{fields:ig?'id,text,timestamp':'id,message,created_time'},50),warnings,'Comments');
   if(comments?.length)await Comment.bulkWrite(comments.map(c=>({updateOne:{filter:{accountId:account._id,remoteId:c.id},update:{$set:{workspaceId:account.workspaceId,accountId:account._id,postId:post._id,remoteId:c.id,text:c.text||c.message||'',publishedAt:new Date(c.timestamp||c.created_time),source:'live'}},upsert:true}})));
  }
  await Account.updateOne({_id:account._id,syncLock:tokenId},{$set:{lastSync:new Date(),lastError:null,importedPosts:imported,followers:typeof profile?.followers_count==='number'?profile.followers_count:null,warnings:[...warnings].slice(0,10),status:'connected'}});
  return {imported,warnings:[...warnings]};
 }catch(e){await Account.updateOne({_id:account._id,syncLock:tokenId},{$set:{status:e.metaCode===190?'reconnect_required':'sync_error',lastError:e.message,warnings:[...warnings].slice(0,10)}});throw e;}
 finally{
  await Account.updateOne({_id:account._id,syncLock:tokenId},{$unset:{syncLock:1,syncLockUntil:1}});
  // A concurrent disconnect may occur during an external request.
  if(!await Account.exists({_id:account._id}))await Promise.all([Post.deleteMany({accountId:account._id}),Comment.deleteMany({accountId:account._id})]);
 }
}
export function startScheduler(){
 let running=false;const interval=Math.max(5,Number(process.env.SYNC_INTERVAL_MINUTES)||60)*60000;
 const tick=async()=>{
  if(running)return;running=true;
  try{const accounts=await Account.find({source:'live',status:{$ne:'reconnect_required'},$or:[{lastSyncAttempt:{$lt:new Date(Date.now()-interval)}},{lastSyncAttempt:null}]}).select('_id');
   for(const a of accounts)try{await syncAccount(a._id);}catch{console.error('Scheduled account sync failed',String(a._id));}
  }catch{console.error('Synchronization scheduler unavailable');}finally{running=false;}
 };
 const timer=setInterval(tick,60000);timer.unref();return()=>clearInterval(timer);
}
