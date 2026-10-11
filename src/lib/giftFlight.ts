type Rectangle={left:number;top:number;width:number;height:number};
export function giftFlightOffset(start:Rectangle,end:Rectangle){return {x:end.left+end.width/2-start.left-start.width/2,y:end.top+end.height/2-start.top-start.height/2}}
