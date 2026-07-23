import type { SessionUser, Locale } from '../../../../packages/contracts/index.js';
import { sanitizeDisplayName, validatePin, normalizeUsername, ValidationError } from '../../../../packages/validation/index.js';
import { randomToken, hashPin, verifyPin, sha256 } from '../security/crypto.js';
import type { Env } from '../env.js';
import { D1Repository, type AuthenticatedSession } from '../repositories/d1.js';

export const SESSION_COOKIE = 'my_session';
export const CSRF_COOKIE = 'my_csrf';
const DUMMY_SALT = '000102030405060708090a0b0c0d0e0f';

function cookieValue(request:Request,name:string):string|null{
  const raw=request.headers.get('cookie')??'';
  for(const part of raw.split(';')){const [key,...rest]=part.trim().split('=');if(key===name)return decodeURIComponent(rest.join('='));}
  return null;
}

export interface AuthResult { session:AuthenticatedSession; setCookies?:string[]; rawCsrf?:string; }

export class AuthService {
  readonly repo:D1Repository;
  constructor(private env:Env){this.repo=new D1Repository(env.DB,env);}

  async current(request:Request):Promise<AuthenticatedSession|null>{const token=cookieValue(request,SESSION_COOKIE);return token?await this.repo.session(token,Date.now()):null;}

  async require(request:Request):Promise<AuthenticatedSession>{const session=await this.current(request);if(!session)throw new ValidationError('AUTH_REQUIRED','Sign in required.',401);return session;}

  async requireCsrf(request:Request,session:AuthenticatedSession):Promise<void>{
    const header=request.headers.get('x-csrf-token');const cookie=cookieValue(request,CSRF_COOKIE);
    if(!header||!cookie||header!==cookie||await sha256(header)!==session.csrfDigest)throw new ValidationError('CSRF_INVALID','Security token expired. Reload and try again.',403);
  }

  async register(request:Request,input:any):Promise<AuthResult>{
    const now=Date.now();
    const key=`register:${request.headers.get('cf-connecting-ip')??'local'}`;
    const rate=await this.repo.rateLimit(key,5,15*60_000,now);if(!rate.allowed)throw new ValidationError('RATE_LIMITED','Too many registration attempts.',429);
    const username=normalizeUsername(input?.username);const pin=validatePin(input?.pin);const displayName=sanitizeDisplayName(input?.displayName);
    if(await this.repo.accountByUsername(username))throw new ValidationError('USERNAME_TAKEN','That username is not available.',409);
    const accountId=crypto.randomUUID();const {hash,salt,version,parameters}=await hashPin(pin,this.env.PIN_PEPPER);
    await this.repo.createAccount({id:accountId,username,pinHash:hash,pinSalt:salt,pinVersion:version,pinParameters:parameters,recoveryEmail:typeof input?.recoveryEmail==='string'?input.recoveryEmail.trim().toLowerCase()||null:null,displayName,avatar:typeof input?.avatar==='string'?input.avatar:'moon',locale:input?.locale==='en'?'en':'ur-Roman',now});
    await this.repo.audit(accountId,'account_registered','success',{},now);
    return await this.newSession(request,{accountId,username,displayName,avatar:typeof input?.avatar==='string'?input.avatar:'moon',locale:input?.locale==='en'?'en':'ur-Roman'});
  }

  private async dummyVerify(pin:string):Promise<void>{const hash=(await hashPin('000000',this.env.PIN_PEPPER,DUMMY_SALT)).hash;await verifyPin(pin,this.env.PIN_PEPPER,DUMMY_SALT,hash);}

  async login(request:Request,input:any):Promise<AuthResult>{
    const now=Date.now();const username=normalizeUsername(input?.username);const pin=validatePin(input?.pin);
    const ip=request.headers.get('cf-connecting-ip')??'local';const rate=await this.repo.rateLimit(`login:${ip}:${username}`,8,15*60_000,now);if(!rate.allowed)throw new ValidationError('RATE_LIMITED','Too many login attempts. Try again later.',429);
    const account=await this.repo.accountByUsername(username);
    if(!account){await this.dummyVerify(pin);throw new ValidationError('INVALID_CREDENTIALS','Username or PIN is incorrect.',401);}
    if(account.locked_until&&account.locked_until>now){await this.dummyVerify(pin);throw new ValidationError('ACCOUNT_LOCKED','Try again later.',429);}
    const ok=await verifyPin(pin,this.env.PIN_PEPPER,account.pin_salt,account.pin_hash);
    if(!ok){const count=account.failed_attempt_count+1;const lock=count>=8?now+15*60_000:null;await this.repo.setLoginFailure(account.id,count,lock,now);throw new ValidationError('INVALID_CREDENTIALS','Username or PIN is incorrect.',401);}
    await this.repo.resetLoginFailures(account.id,now);const profile=await this.repo.profile(account.id);if(!profile)throw new Error('PROFILE_MISSING');
    const result=await this.newSession(request,{accountId:account.id,username:account.username,displayName:profile.display_name,avatar:profile.avatar,locale:profile.locale});
    await this.repo.invalidateAccountSessions(account.id,now,result.session.session.id);
    await this.repo.audit(account.id,'login','success',{},now);return result;
  }

  private async newSession(request:Request,user:SessionUser):Promise<AuthResult>{const now=Date.now(),rawToken=randomToken(32),rawCsrf=randomToken(24),ttlMs=Number(this.env.SESSION_TTL_HOURS)*3_600_000;await this.repo.createSession(user.accountId,rawToken,rawCsrf,request,now,ttlMs);const session=await this.repo.session(rawToken,now);if(!session)throw new Error('SESSION_CREATE_FAILED');const secure=this.env.APP_ENV==='local'||this.env.APP_ENV==='test'?'':'; Secure';return{session,setCookies:[`${SESSION_COOKIE}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${Math.floor(ttlMs/1000)}`,`${CSRF_COOKIE}=${encodeURIComponent(rawCsrf)}; Path=/${secure}; SameSite=Lax; Max-Age=${Math.floor(ttlMs/1000)}`],rawCsrf};}

  async logout(request:Request):Promise<string[]>{const session=await this.current(request);if(session)await this.repo.invalidateSession(session.session.id,Date.now());const secure=this.env.APP_ENV==='local'||this.env.APP_ENV==='test'?'':'; Secure';return[`${SESSION_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`,`${CSRF_COOKIE}=; Path=/${secure}; SameSite=Lax; Max-Age=0`];}
}
