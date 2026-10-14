export function roomFlag(room:any){return String(room.flag||room.country||'').match(/\p{Regional_Indicator}{2}/u)?.[0]||'🌐';}
export function visibleRooms(rooms:any[],flag:string){return rooms.filter(room=>flag==='all'||roomFlag(room)===flag).sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned)));}
