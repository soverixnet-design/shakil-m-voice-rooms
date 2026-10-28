/**
 * Game/wallet/social API base URL. Akira's API keeps its existing root routes;
 * only /earnbd is proxied to the isolated EarnBD service on the same host.
 */
export function gameServerUrl(value:string){
  const u=new URL(value.trim());
  const basicSafe=u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash;
  const renderHost=u.hostname.endsWith('.onrender.com')&&u.hostname!=='onrender.com'&&u.pathname==='/';
  const legacyHost=u.hostname==='api.earnbd.work'&&u.pathname==='/';
  const akiraSidecar=u.hostname==='api.soverixnet.online'&&(u.pathname==='/earnbd'||u.pathname==='/earnbd/');
  if(!basicSafe||!(renderHost||legacyHost||akiraSidecar)){
    throw Error('Use an approved EarnBD API HTTPS address without /api or /health.');
  }
  return akiraSidecar?u.origin+'/earnbd':u.origin;
}
