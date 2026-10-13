export function activeRankingAward(user:any,now=Date.now()){
 return (Array.isArray(user?.rankingAwards)?user.rankingAwards:[]).filter((award:any)=>Number.isFinite(award.expiresAt)&&award.expiresAt>now).sort((a:any,b:any)=>b.grantedAt-a.grantedAt)[0];
}
