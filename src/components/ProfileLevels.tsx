import React from 'react';
import {giftLevel} from '../lib/giftLevel';
export function ProfileLevels({user,compact=false}:{user:any;compact?:boolean}){
 const sending=giftLevel(user?.giftSentCoins).level,receiving=giftLevel(user?.giftReceivedCoins).level;
 return <span className={'profile-level-badges '+(compact?'compact':'')} aria-label={`Sending level ${sending}, Receiving level ${receiving}`}><span className="profile-sending-level" title="গিফট পাঠানোর লেভেল">⬆ {compact?'S':'Sending'} Lv.{sending}</span><span className="profile-receiving-level" title="গিফট পাওয়ার লেভেল">⬇ {compact?'R':'Receiving'} Lv.{receiving}</span></span>;
}
