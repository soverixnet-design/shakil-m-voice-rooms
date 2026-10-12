import config from '../../game-server-config.json';
import {callSharedGame} from './gameTransport';
export async function accountBootstrap(){
  return (await callSharedGame<{id:string;name:string;photoURL:string;coins:number;role:string}>(config.url,'account',{})).data;
}
