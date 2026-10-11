export type SharedRound={id:string;startAt:number;closeAt:number;revealAt:number;endAt:number;serverNow:number;serverReceivedAt:number;day:string;balance:number};
export function clockAnchor(round:SharedRound,sent:number,received:number){const latency=Math.max(0,received-sent-Math.max(0,round.serverNow-round.serverReceivedAt));return {server:round.serverNow+latency/2,local:received,uncertainty:latency/2};}
export function serverTime(anchor:{server:number;local:number},local:number){return anchor.server+Math.max(0,local-anchor.local);}
export function sharedPhase(round:SharedRound,now:number){return now<round.closeAt?'bet':now<round.revealAt?'spin':now<round.endAt?'result':'ended';}
