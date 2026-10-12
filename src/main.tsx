import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './design/reference.css';

createRoot(document.getElementById('root')!).render(<App />);

if('serviceWorker' in navigator){const register=()=>{void navigator.serviceWorker.register(new URL('sw.js',document.baseURI).href,{scope:new URL('.',document.baseURI).pathname}).catch(()=>{})};if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true});}
