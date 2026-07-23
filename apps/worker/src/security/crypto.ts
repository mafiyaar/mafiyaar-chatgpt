import { randomBytes, randomInt, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const encoder = new TextEncoder();
export const base64url = (bytes: Uint8Array): string => {
  let binary=''; for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
export const randomToken = (bytes=32): string => randomBytes(bytes).toString('base64url');
export const randomId = (): string => randomUUID();
export const secureRandomInt = (maxExclusive:number):number => randomInt(0,maxExclusive);
export async function sha256(value:string):Promise<string>{
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(value));return base64url(new Uint8Array(digest));
}
export async function hmacSha256(value:string,secret:string):Promise<string>{
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,encoder.encode(value));return base64url(new Uint8Array(sig));
}
export function safeEqual(a:string,b:string):boolean{
  const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);
}
export interface PinHash { hash:string; salt:string; version:'scrypt-v1'; parameters:string; }
export async function hashPin(pin:string,pepper:string,salt=randomToken(16)):Promise<PinHash>{
  const parameters=JSON.stringify({N:16384,r:8,p:1,keylen:32});
  const value=await scrypt(`${pin}:${pepper}`,salt,32,{N:16384,r:8,p:1,maxmem:32*1024*1024}) as Buffer;
  return {hash:value.toString('base64url'),salt,version:'scrypt-v1',parameters};
}
export async function verifyPin(pin:string,pepper:string,salt:string,expected:string):Promise<boolean>{
  const actual=await hashPin(pin,pepper,salt);return safeEqual(actual.hash,expected);
}
export function generateRoomCode():string{
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code='';for(let i=0;i<5;i++)code+=alphabet[secureRandomInt(alphabet.length)];return code;
}
