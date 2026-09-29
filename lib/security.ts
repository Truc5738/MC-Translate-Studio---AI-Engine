import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const enc = new TextEncoder();

function secret(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return enc.encode(value);
}

export async function setAdminSession() {
  const token = await new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret("AUTH_SECRET"));
  const jar = await cookies();
  jar.set("mc_admin", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function requireAdmin() {
  const token = (await cookies()).get("mc_admin")?.value;
  if (!token) return false;
  try {
    const result = await jwtVerify(token, secret("AUTH_SECRET"));
    return result.payload.role === "admin";
  } catch { return false; }
}

export function encrypt(value: string) {
  const key = Buffer.from(secret("ENCRYPTION_KEY"));
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must decode to 32 bytes; use 64 hex characters.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(".");
}

export function decrypt(value: string) {
  const [ivHex, tagHex, dataHex] = value.split(".");
  const key = Buffer.from(secret("ENCRYPTION_KEY"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}