import { NextRequest, NextResponse } from "next/server";
import { setAdminSession } from "@/lib/security";

export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>({}));
  if(!process.env.ADMIN_PASSWORD || body.password!==process.env.ADMIN_PASSWORD) return NextResponse.json({error:"Invalid password"},{status:401});
  await setAdminSession();
  return NextResponse.json({ok:true});
}