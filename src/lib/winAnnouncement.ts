export const WIN_DISPLAY_MS=15000;
export function advanceWinAnnouncement(current:any,queue:any[],now:number){if(current&&now-current.shownAt<WIN_DISPLAY_MS)return current;const next=queue.shift();return next?{...next,shownAt:now}:null;}
