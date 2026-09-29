import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const enc = new TextEncoder();
function secret(name:string){const value=process.env[name];if(!value)throw new Error(`Missing ${name}`);return enc.encode(value);}
function encryptionKey(){const raw=process.env.ENCRYPTION_KEY||"";if(/^[0-9a-fA-F]{64}$/.test(raw))return Buffer.from(raw,"hex");const b=Buffer.from(raw,"utf8");if(b.length!==32)throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes).");return b;}

export async function setAdminSession(){
 const token=await new SignJWT({role:"admin"}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(secret("AUTH_SECRET"));
 (await cookies()).set("mc_admin",token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:604800});
}
export async function requireAdmin(){
 const token=(await cookies()).get("mc_admin")?.value;if(!token)return false;
 try{return (await jwtVerify(token,secret("AUTH_SECRET"))).payload.role==="admin";}catch{return false;}
}
export function encrypt(value:string){
 const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv("aes-256-gcm",encryptionKey(),iv);
 const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
 return [iv.toString("hex"),cipher.getAuthTag().toString("hex"),encrypted.toString("hex")].join(".");
}
export function decrypt(value:string){
 const [ivHex,tagHex,dataHex]=value.split(".");
 const decipher=crypto.createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(ivHex,"hex"));
 decipher.setAuthTag(Buffer.from(tagHex,"hex"));
 return Buffer.concat([decipher.update(Buffer.from(dataHex,"hex")),decipher.final()]).toString("utf8");
}