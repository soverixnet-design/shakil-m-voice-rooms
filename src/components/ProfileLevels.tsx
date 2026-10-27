import React from 'react';
import {giftLevel} from '../lib/giftLevel';
import {useLanguage} from '../i18n/LanguagePicker';
export function ProfileLevels({user,compact=false}:{user:any;compact?:boolean}){
 const {language,t}=useLanguage();
 const sending=giftLevel(user?.giftSentCoins).level,receiving=giftLevel(user?.giftReceivedCoins).level;
 const number=(n:number)=>n.toLocaleString(language==='bn'?'bn-BD':'en-US');
 return <span data-no-translate="true" className={'profile-level-badges '+(compact?'compact':'')} aria-label={t(`Sending level ${sending}, Receiving level ${receiving}`,`পাঠানোর লেভেল ${number(sending)}, পাওয়ার লেভেল ${number(receiving)}`)}><span className="profile-sending-level" title={t('Gift sending level','Gift sending level')}>⬆ {compact?t('S','পা'):t('Sending','Sending')} {t('Lv.','লেভেল ')}{number(sending)}</span><span className="profile-receiving-level" title={t('Gift receiving level','Gift receiving level')}>⬇ {compact?t('R','প্রা'):t('Receiving','Receiving')} {t('Lv.','লেভেল ')}{number(receiving)}</span></span>;
}
