import postgres from "postgres";
import { decrypt, encrypt } from "./security";
export type Provider="gemini"|"groq";
export type AIKey={id:number;provider:Provider;key:string;enabled:boolean};
let sql:ReturnType<typeof postgres>|null=null;
function db(){if(!process.env.POSTGRES_URL)return null;sql??=postgres(process.env.POSTGRES_URL,{ssl:"require"});return sql;}
async function ensureTable(){const conn=db();if(!conn)return;await conn`CREATE TABLE IF NOT EXISTS mc_ai_keys (id SERIAL PRIMARY KEY,provider TEXT NOT NULL CHECK(provider IN ('gemini','groq')),secret TEXT NOT NULL,enabled BOOLEAN NOT NULL DEFAULT TRUE,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;}
export async function getAIKeys():Promise<AIKey[]>{
 const conn=db();if(conn){await ensureTable();const rows=await conn`SELECT id,provider,secret,enabled FROM mc_ai_keys ORDER BY id ASC`;return rows.map(r=>({id:Number(r.id),provider:r.provider as Provider,key:decrypt(r.secret),enabled:Boolean(r.enabled)}));}
 try{const raw=JSON.parse(process.env.AI_KEYS_JSON||"[]") as Array<{provider:Provider;key:string;enabled?:boolean}>;return raw.slice(0,20).map((x,i)=>({id:i+1,provider:x.provider,key:x.key,enabled:x.enabled!==false}));}catch{return [];}
}
export async function saveAIKeys(keys:Array<{id?:number;provider:Provider;key?:string;enabled:boolean}>){
 const conn=db();if(!conn)throw new Error("POSTGRES_URL is required to save keys from the Admin Panel.");
 await ensureTable();
 for(const item of keys.slice(0,20)){
  if(item.id && item.key?.trim()) await conn`UPDATE mc_ai_keys SET provider=${item.provider},secret=${encrypt(item.key.trim())},enabled=${item.enabled},updated_at=NOW() WHERE id=${item.id}`;
  else if(item.id) await conn`UPDATE mc_ai_keys SET provider=${item.provider},enabled=${item.enabled},updated_at=NOW() WHERE id=${item.id}`;
  else if(item.key?.trim()) await conn`INSERT INTO mc_ai_keys(provider,secret,enabled) VALUES(${item.provider},${encrypt(item.key.trim())},${item.enabled})`;
 }
}
export function maskKey(key:string){return key.length<10?"********":`${key.slice(0,5)}...${key.slice(-4)}`;}