import {describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {hashPin,verifyPin} from '../../apps/worker/src/security/crypto.js';
import {register,request,cookies} from '../helpers/http.js';

describe('Workers-runtime authentication',()=>{
  it('executes scrypt registration and verification in the Workers runtime',async()=>{const started=Date.now();const value=await hashPin('864209',env.PIN_PEPPER);expect(value.hash).not.toContain('864209');expect(await verifyPin('864209',env.PIN_PEPPER,value.salt,value.hash)).toBe(true);expect(await verifyPin('864208',env.PIN_PEPPER,value.salt,value.hash)).toBe(false);expect(Date.now()-started).toBeLessThan(10_000);});
  it('registers a six-digit PIN account and stores only a hash',async()=>{const s=await register(crypto.randomUUID().slice(0,8));const account=await env.DB.prepare('SELECT pin_hash,pin_salt FROM accounts WHERE id=?').bind(s.user.accountId).first<any>();expect(account.pin_hash).not.toContain('864209');expect(account.pin_salt).toBeTruthy();});
  it('rejects four-digit and weak PINs',async()=>{for(const pin of ['1234','123456']){const r=await request('/api/auth/register',{method:'POST',body:JSON.stringify({username:`bad_${crypto.randomUUID().slice(0,7)}`,displayName:'Bad PIN',pin})});expect(r.status).toBe(400);}});
  it('rotates sessions after login and invalidates the former device',async()=>{const suffix=crypto.randomUUID().slice(0,8),first=await register(suffix);const login=await request('/api/auth/login',{method:'POST',body:JSON.stringify({username:`player_${suffix}`,pin:'864209'})});expect(login.status).toBe(200);const old=await request('/api/auth/session',{headers:{cookie:first.cookie}});expect(old.status).toBe(401);const current=await request('/api/auth/session',{headers:{cookie:cookies(login)}});expect(current.status).toBe(200);});
});
