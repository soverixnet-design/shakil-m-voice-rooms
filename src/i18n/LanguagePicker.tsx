import React from 'react';

// English-only release: no Bangla toggle and no mixed-language labels.
// Keep the helper's original signature for all callers of useLanguage().
declare global{interface Window{EarnBDLanguage?:{get:()=>string;set:(language:string)=>void;translate:(text:string,language?:string)=>string}}}
export function LanguagePicker(){return <span className="language-picker" aria-label="Application language: English" data-no-translate="true">🌐 English</span>}
export function useLanguage(){return {language:'en',t:(english:string,_bangla:string)=>english}}
