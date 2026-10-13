export const ANNOUNCEMENT_MS=15000,ANNOUNCEMENT_FRESH_MS=60000;
export function announcementTime(value:any):number{return Number(value?.toMillis?.()??value);}
export function isFreshAnnouncement(event:any,now:number){const time=announcementTime(event.createdAt);return ['gift','win'].includes(event.type)&&Number.isSafeInteger(event.amount)&&event.amount>0&&Number.isFinite(time)&&time<=now+5000&&now-time<ANNOUNCEMENT_FRESH_MS;}
export function nextAnnouncement(current:any,queue:any[],now:number){if(current&&now-current.shownAt<ANNOUNCEMENT_MS)return current;while(queue.length){const event=queue.shift();if(isFreshAnnouncement(event,now))return {...event,shownAt:now};}return null;}
