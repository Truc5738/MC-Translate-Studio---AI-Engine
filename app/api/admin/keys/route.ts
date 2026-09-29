import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security";
import { getAIKeys, maskKey, saveAIKeys } from "@/lib/keys";

export async function GET(){
  if(!(await requireAdmin())) return NextResponse.json({error:"Unauthorized"},{status:401});
  const keys=await getAIKeys();
  return NextResponse.json({keys:keys.map(k=>({id:k.id,provider:k.provider,key:maskKey(k.key),enabled:k.enabled}))});
}

export async function POST(req:NextRequest){
  if(!(await requireAdmin())) return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await req.json().catch(()=>({}));
  const keys=Array.isArray(body.keys)?body.keys:[];
  if(keys.length>20) return NextResponse.json({error:"Maximum 20 API slots."},{status:400});
  for(const k of keys) if(!["gemini","groq"].includes(k.provider)) return NextResponse.json({error:"Only Gemini and Groq are supported."},{status:400});
  await saveAIKeys(keys);
  return NextResponse.json({ok:true,count:keys.filter((k:any)=>k.key?.trim()).length});
}