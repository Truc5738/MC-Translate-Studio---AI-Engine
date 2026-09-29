import { NextRequest, NextResponse } from "next/server";
import { translateZip } from "@/lib/pack";
import { generateTranslation } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req:NextRequest){
  try{
    const form=await req.formData();
    const file=form.get("file");
    const target=String(form.get("target")||"Vietnamese");
    if(!(file instanceof File)) return NextResponse.json({error:"Missing file"}, {status:400});
    const max=Number(process.env.MAX_FILE_MB||50)*1024*1024;
    if(file.size>max) return NextResponse.json({error:`File exceeds ${max/1024/1024} MB limit`},{status:413});
    const original=Buffer.from(await file.arrayBuffer());
    const result=await translateZip(original,target,(s,p)=>generateTranslation(s,target,p));
    return new NextResponse(new Uint8Array(result.buffer),{
      headers:{
        "Content-Type":"application/zip",
        "Content-Disposition":`attachment; filename="translated-${file.name.replace(/[\r\n"]/g,"_")}.zip"`,
        "X-Translated-Files":String(result.translated)
      }
    });
  }catch(e:any){
    return NextResponse.json({error:e?.message||"Translation failed"},{status:500});
  }
}