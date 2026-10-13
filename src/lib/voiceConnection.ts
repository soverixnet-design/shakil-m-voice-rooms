export function retryableVoiceConnection(connect:()=>Promise<void>){
 let pending:Promise<void>|undefined;
 return {reset(){pending=undefined;},start(){if(!pending){const job=Promise.resolve().then(connect).catch(error=>{if(pending===job)pending=undefined;throw error;});pending=job;}return pending;}};
}
