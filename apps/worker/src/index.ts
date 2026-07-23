import type { MatchSettings } from '../../../packages/contracts/index.js';
import { CLIENT_MINIMUM_VERSION, PROTOCOL_VERSION } from '../../../packages/contracts/index.js';
import { validateRoomCode, ValidationError, sanitizeDisplayName, validateLocale } from '../../../packages/validation/index.js';
import { AuthService } from './auth/service.js';
import { config } from './env.js';
import { generateRoomCode, hmacSha256, randomToken, safeEqual, sha256, hashPin } from './security/crypto.js';
import { bodyObject, errorResponse, json, securityHeaders, validateOrigin } from './security/http.js';
import { qrSvg } from './routes/qr.js';
import { MafiYaarRoom } from './durable/MafiYaarRoom.js';

export { MafiYaarRoom };

const getPath=(request:Request)=>new URL(request.url).pathname;
const addCookies=(response:Response,cookies:string[]=[]):Response=>{const headers=new Headers(response.headers);for(const cookie of cookies)headers.append('set-cookie',cookie);return new Response(response.body,{status:response.status,statusText:response.statusText,headers});};
const safeError=(error:unknown):Response=>{if(error instanceof ValidationError)return errorResponse(error.code,error.message,error.status,error.status<500);if(error&&typeof error==='object'&&'status'in error&&'code'in error){const status=Number((error as any).status),code=String((error as any).code);return errorResponse(code,error instanceof Error?error.message:'Request rejected.',Number.isInteger(status)?status:400,status<500)}console.error(JSON.stringify({level:'error',category:'request_failed',message:error instanceof Error?error.name:'unknown'}));return errorResponse('INTERNAL_ERROR','Something went wrong.',500,false);};
const isMutation=(request:Request)=>!['GET','HEAD','OPTIONS'].includes(request.method);
const publicCodeFrom=(path:string,index:number)=>validateRoomCode(decodeURIComponent(path.split('/')[index]??''));

async function turnstile(request:Request,env:Env,token:unknown,expectedAction:'register'|'login'|'recovery'|'room_lookup'):Promise<boolean>{
  if(env.TURNSTILE_MODE==='disabled')return env.APP_ENV!=='production';
  if(typeof token!=='string'||!token||token.length>2048)return false;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const body=new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('cf-connecting-ip')??'',idempotency_key:crypto.randomUUID()});
    const result=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body,signal:controller.signal});
    const payload=(await result.json()) as {success?:boolean;hostname?:string;action?:string};
    const expectedHost=new URL(env.PUBLIC_ORIGIN).hostname;
    return payload.success===true&&payload.hostname===expectedHost&&payload.action===expectedAction;
  }catch{return false}finally{clearTimeout(timeout)}
}

async function resolveDirectory(env:Env,code:string){const repo=new AuthService(env).repo;const current=await hmacSha256(code,env.ROOM_CODE_LOOKUP_SECRET);let record=await repo.roomByCodeHmac(current,Date.now());if(record)return{hmac:current,record,repo};if(env.ROOM_CODE_LOOKUP_SECRET_PREVIOUS&&env.ROOM_CODE_LOOKUP_PREVIOUS_KEY_VERSION){const previous=await hmacSha256(code,env.ROOM_CODE_LOOKUP_SECRET_PREVIOUS);record=await repo.roomByCodeHmac(previous,Date.now());if(record&&record.lookup_key_version===env.ROOM_CODE_LOOKUP_PREVIOUS_KEY_VERSION)return{hmac:previous,record,repo};}return{hmac:current,record:null,repo};}

async function route(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
  config(env);const url=new URL(request.url),path=url.pathname,auth=new AuthService(env);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':env.PUBLIC_ORIGIN,'access-control-allow-credentials':'true','access-control-allow-headers':'content-type,x-csrf-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
  if(isMutation(request)&&!validateOrigin(request,env.PUBLIC_ORIGIN))throw new ValidationError('ORIGIN_INVALID','Origin rejected.',403);
  if(path==='/health')return json({status:'ok',environment:env.APP_ENV,version:env.APP_VERSION,architecture:'worker+d1+durable-object'});
  if(path==='/version')return json({appVersion:env.APP_VERSION,protocolVersion:PROTOCOL_VERSION,clientMinimumVersion:CLIENT_MINIMUM_VERSION});
  if(path==='/api/config'&&request.method==='GET')return json({appVersion:env.APP_VERSION,protocolVersion:PROTOCOL_VERSION,clientMinimumVersion:CLIENT_MINIMUM_VERSION,turnstile:{mode:env.TURNSTILE_MODE,siteKey:env.TURNSTILE_SITE_KEY}});

  if(path==='/api/auth/register'&&request.method==='POST'){const input=await bodyObject(request);const risk=await auth.repo.rateLimit(`register-risk:${request.headers.get('cf-connecting-ip')??'local'}`,20,15*60_000,Date.now());if(env.TURNSTILE_MODE==='escalation'&&risk.remaining<3&&!await turnstile(request,env,input.turnstileToken,'register'))throw new ValidationError('CHALLENGE_REQUIRED','Security check required.',403);const result=await auth.register(request,input);return addCookies(json({user:result.session.user,csrfToken:result.rawCsrf,activeRoom:null},201),result.setCookies);}
  if(path==='/api/auth/login'&&request.method==='POST'){const input=await bodyObject(request);const candidate=typeof input.username==='string'?await auth.repo.accountByUsername(input.username.trim().toLowerCase()):null;if(env.TURNSTILE_MODE==='escalation'&&(candidate?.failed_attempt_count??0)>=3&&!await turnstile(request,env,input.turnstileToken,'login'))throw new ValidationError('CHALLENGE_REQUIRED','Security check required.',403);const result=await auth.login(request,input);return addCookies(json({user:result.session.user,csrfToken:result.rawCsrf,activeRoom:null}),result.setCookies);}
  if(path==='/api/auth/session'&&request.method==='GET'){const session=await auth.require(request);return json({user:session.user,csrfToken:null,activeRoom:null});}
  if(path==='/api/auth/logout'&&request.method==='POST'){const session=await auth.require(request);await auth.requireCsrf(request,session);return addCookies(json({ok:true}),await auth.logout(request));}
  if(path==='/api/auth/recovery/request'&&request.method==='POST'){const input=await bodyObject(request),username=typeof input.username==='string'?input.username.trim().toLowerCase():'',risk=await auth.repo.rateLimit(`recovery:${request.headers.get('cf-connecting-ip')??'local'}:${username}`,6,15*60_000,Date.now());if(!risk.allowed)throw new ValidationError('RATE_LIMITED','Too many recovery attempts.',429);if(env.TURNSTILE_MODE==='escalation'&&risk.remaining<2&&!await turnstile(request,env,input.turnstileToken,'recovery'))throw new ValidationError('CHALLENGE_REQUIRED','Security check required.',403);const account=await auth.repo.accountByUsername(username);let token:string|undefined;if(account){token=randomToken(32);await env.DB.prepare('INSERT INTO recovery_tokens(id,account_id,token_digest,expires_at,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),account.id,await sha256(token),Date.now()+15*60_000,Date.now()).run();}return json({accepted:true,...(env.APP_ENV==='local'||env.APP_ENV==='test'?{developmentToken:token}: {})});}
  if(path==='/api/auth/recovery/complete'&&request.method==='POST'){const input=await bodyObject(request);const token=typeof input.token==='string'?input.token:'';const pin=typeof input.pin==='string'?input.pin:'';if(!/^\d{6}$/.test(pin))throw new ValidationError('INVALID_PIN','PIN must contain exactly 6 digits.',400);const row=await auth.repo.recoveryByDigest(await sha256(token),Date.now());if(!row)throw new ValidationError('RECOVERY_INVALID','Recovery token is invalid or expired.',400);const hashed=await hashPin(pin,env.PIN_PEPPER);await auth.repo.updatePin(row.account_id,{hash:hashed.hash,salt:hashed.salt,version:hashed.version,parameters:hashed.parameters},Date.now());await auth.repo.consumeRecovery(row.id,Date.now());await auth.repo.invalidateAccountSessions(row.account_id,Date.now());await auth.repo.audit(row.account_id,'pin_recovered','success',{});return json({ok:true});}

  if(path==='/api/home'&&request.method==='GET'){const session=await auth.require(request);return json({history:await auth.repo.history(session.user.accountId),statistics:await auth.repo.statistics(session.user.accountId)});}
  if(path==='/api/profile'&&request.method==='GET'){const session=await auth.require(request);return json({profile:await auth.repo.profile(session.user.accountId),statistics:await auth.repo.statistics(session.user.accountId)});}
  if(path==='/api/profile'&&request.method==='PUT'){const session=await auth.require(request);await auth.requireCsrf(request,session);const input=await bodyObject(request);await auth.repo.updateProfile(session.user.accountId,{displayName:typeof input.displayName==='string'?sanitizeDisplayName(input.displayName):undefined,avatar:typeof input.avatar==='string'?input.avatar:undefined,locale:input.locale?validateLocale(input.locale):undefined,reducedMotion:typeof input.reducedMotion==='boolean'?input.reducedMotion:undefined,accessibleConfirmation:typeof input.accessibleConfirmation==='boolean'?input.accessibleConfirmation:undefined,textScale:typeof input.textScale==='number'?input.textScale:undefined},Date.now());return json({profile:await auth.repo.profile(session.user.accountId),statistics:await auth.repo.statistics(session.user.accountId)});}
  if(path==='/api/history'&&request.method==='GET'){const session=await auth.require(request);return json({history:await auth.repo.history(session.user.accountId)});}
  if(path==='/api/integrations'&&request.method==='GET'){await auth.require(request);return json({cloudflare:{worker:true,d1:true,durableObjects:true,staticAssets:true},turnstile:{mode:env.TURNSTILE_MODE,siteKey:env.TURNSTILE_SITE_KEY},supabase:{enabled:false}});}

  if(path==='/api/rooms/create'&&request.method==='POST'){
    const session=await auth.require(request);await auth.requireCsrf(request,session);const input=await bodyObject(request);const rate=await auth.repo.rateLimit(`room-create:${session.user.accountId}`,10,60_000,Date.now());if(!rate.allowed)throw new ValidationError('RATE_LIMITED','Too many rooms created.',429);
    let code='',hmac='';for(let i=0;i<100;i++){code=generateRoomCode();hmac=await hmacSha256(code,env.ROOM_CODE_LOOKUP_SECRET);if(!await auth.repo.roomByCodeHmac(hmac,Date.now()))break;if(i===99)throw new ValidationError('ROOM_CODE_UNAVAILABLE','Room code allocation failed.',503);}
    const id=env.MAFIYAAR_ROOMS.newUniqueId(),doId=id.toString(),stub=env.MAFIYAAR_ROOMS.get(id);const invite=randomToken(24),now=Date.now(),expiresAt=now+Number(env.ROOM_TTL_HOURS)*3_600_000;await auth.repo.createRoomDirectory({codeHmac:hmac,lookupKeyVersion:env.ROOM_CODE_LOOKUP_KEY_VERSION,durableObjectId:doId,creatorAccountId:session.user.accountId,inviteDigest:await sha256(`${invite}:${env.INVITATION_HASH_SECRET}`),now,expiresAt});
    const initialized=await stub.initialize({publicCode:code,codeLookupHmac:hmac,creator:session.user,settings:input as Partial<MatchSettings>,expiresAt});await auth.repo.setActiveRoom(session.session.id,hmac);return json({room:initialized.view,inviteUrl:`${url.origin}/join/${code}?t=${encodeURIComponent(invite)}`},201);
  }

  if(path.startsWith('/api/rooms/resolve/')){
    const code=publicCodeFrom(path,4),session=await auth.require(request),{hmac,record,repo}=await resolveDirectory(env,code);if(!record)throw new ValidationError('ROOM_UNAVAILABLE','Room is unavailable.',404);const id=env.MAFIYAAR_ROOMS.idFromString(record.durable_object_id),stub=env.MAFIYAAR_ROOMS.get(id);
    if(request.method==='POST'){await auth.requireCsrf(request,session);const input=await bodyObject(request),lookup=await repo.rateLimit(`room-lookup:${request.headers.get('cf-connecting-ip')??'local'}:${hmac}`,20,15*60_000,Date.now());if(!lookup.allowed)throw new ValidationError('RATE_LIMITED','Too many room lookup attempts.',429);if(env.TURNSTILE_MODE==='escalation'&&lookup.remaining<3&&!await turnstile(request,env,input.turnstileToken,'room_lookup'))throw new ValidationError('CHALLENGE_REQUIRED','Security check required.',403);if(input.token){const digest=await sha256(`${String(input.token)}:${env.INVITATION_HASH_SECRET}`);if(!safeEqual(digest,record.invite_digest)){await repo.recordFailedJoin(hmac,Date.now());throw new ValidationError('ROOM_UNAVAILABLE','Room is unavailable.',404);}}const joined=await stub.join({user:session.user});await repo.setActiveRoom(session.session.id,hmac);return json({room:joined.view});}
    if(request.method==='GET'){const member=await stub.member(session.user.accountId);return json({room:member.view});}
  }

  const roomAction=path.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{5})\/(invite|connection-ticket|leave|qr)$/);
  if(roomAction){const code=validateRoomCode(roomAction[1]!),action=roomAction[2]!,session=await auth.require(request),{hmac,record,repo}=await resolveDirectory(env,code);if(!record)throw new ValidationError('ROOM_UNAVAILABLE','Room is unavailable.',404);const stub=env.MAFIYAAR_ROOMS.get(env.MAFIYAAR_ROOMS.idFromString(record.durable_object_id));const member=await stub.member(session.user.accountId);
    if(action==='qr'&&request.method==='GET'){const link=`${url.origin}/join/${code}`;return new Response(qrSvg(link),{headers:{'content-type':'image/svg+xml','cache-control':'no-store'}});}
    await auth.requireCsrf(request,session);
    if(action==='invite'&&request.method==='POST'){if(!member.view.isCreator)throw new ValidationError('CREATOR_ONLY','Only the creator can rotate invitations.',403);const invite=randomToken(24);await repo.rotateInvite(hmac,await sha256(`${invite}:${env.INVITATION_HASH_SECRET}`),Date.now());return json({inviteUrl:`${url.origin}/join/${code}?t=${encodeURIComponent(invite)}`});}
    if(action==='leave'&&request.method==='POST'){await stub.leave(session.user.accountId);await repo.setActiveRoom(session.session.id,null);return json({ok:true});}
    if(action==='connection-ticket'&&request.method==='POST'){const rate=await repo.rateLimit(`ticket:${session.user.accountId}`,30,60_000,Date.now());if(!rate.allowed)throw new ValidationError('RATE_LIMITED','Too many connection attempts.',429);const input=await bodyObject(request);const clientVersion=typeof input.clientVersion==='string'?input.clientVersion:env.APP_VERSION,protocol=typeof input.protocolVersion==='string'?input.protocolVersion:PROTOCOL_VERSION;if(protocol!==PROTOCOL_VERSION)throw new ValidationError('UPDATE_REQUIRED','App update required.',409);const ticket=randomToken(32),now=Date.now();await repo.issueTicket({raw:ticket,doId:record.durable_object_id,codeHmac:hmac,accountId:session.user.accountId,sessionId:session.session.id,memberId:member.memberId,protocol,clientVersion,now,expiresAt:now+Number(env.WS_TICKET_TTL_SECONDS)*1000});return json({ticket,expiresAt:now+Number(env.WS_TICKET_TTL_SECONDS)*1000});}
  }

  if(path.startsWith('/ws/connect/')&&request.headers.get('upgrade')?.toLowerCase()==='websocket'){
    if(!validateOrigin(request,env.PUBLIC_ORIGIN))return new Response('Connection unavailable',{status:404});
    const ticket=decodeURIComponent(path.slice('/ws/connect/'.length));if(!/^[A-Za-z0-9_-]{32,200}$/.test(ticket))return new Response('Connection unavailable',{status:404});
    const current=await auth.current(request);if(!current)return new Response('Connection unavailable',{status:404});
    const row=await auth.repo.consumeTicket(ticket,Date.now());if(!row||current.session.id!==row.session_id||current.user.accountId!==row.account_id)return new Response('Connection unavailable',{status:404});
    const identity={sessionId:row.session_id,accountId:row.account_id,playerId:row.room_member_id,roomMemberId:row.room_member_id,protocolVersion:row.protocol_version,clientVersion:row.client_version};const forwarded=new Request(request.url,{method:'GET',headers:{upgrade:'websocket','x-mafiyaar-internal':env.INTERNAL_ROUTING_SECRET,'x-mafiyaar-identity':JSON.stringify(identity)}});return env.MAFIYAAR_ROOMS.get(env.MAFIYAAR_ROOMS.idFromString(row.durable_object_id)).fetch(forwarded);
  }

  if(path.startsWith('/api/'))throw new ValidationError('NOT_FOUND','Not found.',404);
  const asset=await env.ASSETS.fetch(request);const headers=new Headers(asset.headers);securityHeaders(headers);return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});
}

export default {async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{try{return await route(request,env,ctx)}catch(error){return safeError(error)}}};
