export const defaultScopes = 'pages_show_list,pages_read_engagement,read_insights,instagram_basic,instagram_manage_insights,instagram_manage_comments';
export function metaConfiguration(env = process.env) {
  const checks = [
    {name:'Meta app ID', key:'META_APP_ID', ready:/^\d+$/.test(env.META_APP_ID || '')},
    {name:'Meta app secret', key:'META_APP_SECRET', ready:!!env.META_APP_SECRET?.trim()},
    {name:'Token encryption key', key:'TOKEN_ENCRYPTION_KEY', ready:/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY || '')},
    {name:'Graph API version', key:'META_API_VERSION', ready:/^v\d+\.0$/.test(env.META_API_VERSION || 'v25.0')},
  ];
  let callback, app;
  try { callback = new URL(env.META_REDIRECT_URI); } catch {}
  try { app = new URL(env.APP_URL); } catch {}
  const validUrl = u => u && !u.username && !u.password && (u.protocol === 'https:' || (env.NODE_ENV !== 'production' && u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname)));
  checks.push({name:'Application URL', key:'APP_URL', ready:!!validUrl(app)});
  checks.push({name:'Meta callback URL', key:'META_REDIRECT_URI', ready:!!(validUrl(callback) && validUrl(app) && callback.pathname === '/api/meta/callback' && !callback.search && !callback.hash && callback.hostname === app.hostname && callback.protocol === app.protocol)});
  if(env.META_LOGIN_CONFIG_ID)checks.push({name:'Business login configuration',key:'META_LOGIN_CONFIG_ID',ready:/^\d+$/.test(env.META_LOGIN_CONFIG_ID)});
  const scopes = (env.META_SCOPES || defaultScopes).split(',').map(s=>s.trim()).filter(Boolean);
  checks.push({name:'Page discovery permissions',key:'META_SCOPES',ready:['pages_show_list','pages_read_engagement'].every(s=>scopes.includes(s))});
  return {configured:checks.every(c=>c.ready),checks,version:env.META_API_VERSION || 'v25.0',redirectUri:checks.find(c=>c.key==='META_REDIRECT_URI').ready?String(callback):null,scopes};
}
