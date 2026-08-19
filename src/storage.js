const KEY="modren_bank_v2";
export const uid=(p="id")=>`${p}_${crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)}`;
export const initialState=()=>({version:2,settings:{language:"en",theme:"dark",bankName:"Modren Bank",updateUrl:""},users:[],games:[{id:"game_modren_empire",name:"Modren Empire",code:"MODREN-EMPIRE",version:"1.0.0",status:"active"}],currencies:[{id:"currency_mod",name:"MOD",symbol:"MOD",gameId:"game_modren_empire",decimals:0,status:"active"}],accounts:[],transactions:[],debts:[],cards:[],permissions:[],session:null});
export function loadState(){try{return {...initialState(),...JSON.parse(localStorage.getItem(KEY)||"null")}}catch{return initialState()}}
export function saveState(s){localStorage.setItem(KEY,JSON.stringify(s))}
export function exportState(s){const b=new Blob([JSON.stringify(s,null,2)],{type:"application/json"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download="modren-bank-backup.json";a.click();URL.revokeObjectURL(u)}
export async function hashPassword(v){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("")}
