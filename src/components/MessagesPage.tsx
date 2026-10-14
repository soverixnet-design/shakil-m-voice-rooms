import {enableMessageNotifications} from '../lib/messageNotifications';
import React,{useState} from 'react';
import {Headphones,Megaphone,Coins,Search} from 'lucide-react';
import {ActivityRooms} from './ActivityRooms';
import {DirectMessages} from './DirectMessages';
export function MessagesPage({rooms,seller,onAction}:{rooms:any[];seller:boolean;onAction:(action:string,value?:string)=>void}){
 const [status,setStatus]=useState('');
 return <div className="messages-page"><button className="dm-global-search" onClick={()=>onAction('users')}><Search size={18}/>ইউজার ID বা রুম খুঁজুন…</button><div className="dm-services">{[{Icon:Headphones,title:'অফিশিয়াল সাপোর্ট',page:'support_chat',color:'peach'},{Icon:Megaphone,title:'অফিশিয়াল নোটিশ',page:'notices',color:'gold'},{Icon:Coins,title:seller?'সেলার ওয়ালেট':'রিচার্জ সহায়তা',page:seller?'seller':'support_chat',color:'blue'}].map(({Icon,title,page,color})=><button key={page+color} className={color} onClick={()=>onAction('page',page)}><span><Icon size={20}/></span><b>{title}</b></button>)}</div><ActivityRooms rooms={rooms} onJoin={r=>onAction('room',String(r.id))}/><button className="dm-notification-enable" onClick={()=>void enableMessageNotifications().then(setStatus)}>♧ মেসেজ নোটিফিকেশন চালু করুন</button>{status&&<p className="dm-status" role="status">{status}</p>}<DirectMessages/></div>
}
