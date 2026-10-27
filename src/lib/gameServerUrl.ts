const approvedDoHosts = new Set(['api.earnbd.work', 'shakilm-api.soverixnet.online']);

export function gameServerUrl(value:string){
 const u=new URL(value.trim());
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/'||!(u.hostname.endsWith('.onrender.com')||approvedDoHosts.has(u.hostname)))
  throw Error('Render-এর HTTPS লিংক বা অনুমোদিত DigitalOcean API HTTPS লিংক দিন। শেষে /api বা /health লাগবে না।');
 return u.origin;
}
