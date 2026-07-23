import type { Locale, SessionUser } from '../../../../packages/contracts/index.js';
import { hmacSha256, randomId, randomToken, sha256 } from '../security/crypto.js';

export interface AccountRecord { id:string; username:string; pin_hash:string; pin_salt:string; pin_hash_version:string; pin_hash_parameters:string; recovery_email:string|null; failed_attempt_count:number; locked_until:number|null; deleted_at:number|null; }
export interface SessionRecord { id:string; account_id:string; csrf_digest:string; expires_at:number; invalidated_at:number|null; }
export interface AuthenticatedSession { session:SessionRecord; user:SessionUser; csrfDigest:string; }

export class D1Repository {
  constructor(private db:D1Database, private env:Env){}
  async accountByUsername(username:string):Promise<AccountRecord|null>{return await this.db.prepare('SELECT * FROM accounts WHERE username=? AND deleted_at IS NULL').bind(username).first<AccountRecord>();}
  async accountById(id:string):Promise<AccountRecord|null>{return await this.db.prepare('SELECT * FROM accounts WHERE id=? AND deleted_at IS NULL').bind(id).first<AccountRecord>();}
  async createAccount(input:{id:string;username:string;pinHash:string;pinSalt:string;pinVersion:string;pinParameters:string;recoveryEmail:string|null;displayName:string;avatar:string;locale:Locale;now:number}):Promise<void>{
    await this.db.batch([
      this.db.prepare('INSERT INTO accounts(id,username,pin_hash,pin_salt,pin_hash_version,pin_hash_parameters,recovery_email,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(input.id,input.username,input.pinHash,input.pinSalt,input.pinVersion,input.pinParameters,input.recoveryEmail,input.now,input.now),
      this.db.prepare('INSERT INTO profiles(account_id,display_name,avatar,locale,updated_at) VALUES(?,?,?,?,?)').bind(input.id,input.displayName,input.avatar,input.locale,input.now),
      this.db.prepare('INSERT INTO player_statistics(account_id,updated_at) VALUES(?,?)').bind(input.id,input.now)
    ]);
  }
  async setLoginFailure(accountId:string,count:number,lockedUntil:number|null,now:number):Promise<void>{await this.db.prepare('UPDATE accounts SET failed_attempt_count=?,locked_until=?,updated_at=? WHERE id=?').bind(count,lockedUntil,now,accountId).run();}
  async resetLoginFailures(accountId:string,now:number):Promise<void>{await this.db.prepare('UPDATE accounts SET failed_attempt_count=0,locked_until=NULL,updated_at=? WHERE id=?').bind(now,accountId).run();}
  async profile(accountId:string):Promise<{display_name:string;avatar:string;locale:Locale;reduced_motion:number;accessible_confirmation:number;text_scale:number}|null>{return await this.db.prepare('SELECT display_name,avatar,locale,reduced_motion,accessible_confirmation,text_scale FROM profiles WHERE account_id=?').bind(accountId).first();}
  async updateProfile(accountId:string,input:Partial<{displayName:string;avatar:string;locale:Locale;reducedMotion:boolean;accessibleConfirmation:boolean;textScale:number}>,now:number):Promise<void>{
    const current=await this.profile(accountId);if(!current)throw new Error('PROFILE_NOT_FOUND');
    await this.db.prepare('UPDATE profiles SET display_name=?,avatar=?,locale=?,reduced_motion=?,accessible_confirmation=?,text_scale=?,updated_at=? WHERE account_id=?').bind(
      input.displayName??current.display_name,input.avatar??current.avatar,input.locale??current.locale,input.reducedMotion===undefined?current.reduced_motion:Number(input.reducedMotion),input.accessibleConfirmation===undefined?current.accessible_confirmation:Number(input.accessibleConfirmation),input.textScale??current.text_scale,now,accountId).run();
  }
  async createSession(accountId:string,rawToken:string,rawCsrf:string,request:Request,now:number,ttlMs:number):Promise<{id:string;expiresAt:number}>{
    const id=randomId(),expiresAt=now+ttlMs,tokenDigest=await sha256(`${rawToken}:${this.env.SESSION_HASH_SECRET}`),csrfDigest=await sha256(rawCsrf);
    const ua=await sha256(request.headers.get('user-agent')??'');const ip=await sha256((request.headers.get('cf-connecting-ip')??'local').split('.').slice(0,3).join('.'));
    await this.db.prepare('INSERT INTO sessions(id,account_id,token_digest,csrf_digest,created_at,last_seen_at,expires_at,user_agent_hash,ip_prefix_hash) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,accountId,tokenDigest,csrfDigest,now,now,expiresAt,ua,ip).run();
    return{id,expiresAt};
  }
  async session(rawToken:string,now:number):Promise<AuthenticatedSession|null>{
    const digest=await sha256(`${rawToken}:${this.env.SESSION_HASH_SECRET}`);
    const row=await this.db.prepare(`SELECT s.id,s.account_id,s.csrf_digest,s.expires_at,s.invalidated_at,a.username,p.display_name,p.avatar,p.locale FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN profiles p ON p.account_id=a.id WHERE s.token_digest=? AND s.invalidated_at IS NULL AND s.expires_at>? AND a.deleted_at IS NULL`).bind(digest,now).first<any>();
    if(!row)return null;await this.db.prepare('UPDATE sessions SET last_seen_at=? WHERE id=?').bind(now,row.id).run();
    return{session:{id:row.id,account_id:row.account_id,csrf_digest:row.csrf_digest,expires_at:row.expires_at,invalidated_at:row.invalidated_at},csrfDigest:row.csrf_digest,user:{accountId:row.account_id,username:row.username,displayName:row.display_name,avatar:row.avatar,locale:row.locale}};
  }
  async invalidateSession(id:string,now:number):Promise<void>{await this.db.prepare('UPDATE sessions SET invalidated_at=? WHERE id=?').bind(now,id).run();}
  async invalidateAccountSessions(accountId:string,now:number,exceptId?:string):Promise<void>{const q=exceptId?'UPDATE sessions SET invalidated_at=? WHERE account_id=? AND id<>? AND invalidated_at IS NULL':'UPDATE sessions SET invalidated_at=? WHERE account_id=? AND invalidated_at IS NULL';await (exceptId?this.db.prepare(q).bind(now,accountId,exceptId):this.db.prepare(q).bind(now,accountId)).run();}
  async setActiveRoom(sessionId:string,codeHmac:string|null):Promise<void>{await this.db.prepare('UPDATE sessions SET active_room_code_hmac=? WHERE id=?').bind(codeHmac,sessionId).run();}
  async activeRoom(sessionId:string):Promise<{status:string}|null>{return await this.db.prepare('SELECT r.status FROM sessions s JOIN room_codes r ON r.code_lookup_hmac=s.active_room_code_hmac WHERE s.id=? AND r.expires_at>?').bind(sessionId,Date.now()).first();}
  async createRoomDirectory(input:{codeHmac:string;lookupKeyVersion:string;durableObjectId:string;creatorAccountId:string;inviteDigest:string;now:number;expiresAt:number}):Promise<void>{await this.db.prepare('INSERT INTO room_codes(code_lookup_hmac,lookup_key_version,durable_object_id,creator_account_id,invite_digest,status,created_at,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(input.codeHmac,input.lookupKeyVersion,input.durableObjectId,input.creatorAccountId,input.inviteDigest,'lobby',input.now,input.expiresAt,input.now).run();}
  async roomByCodeHmac(codeHmac:string,now:number):Promise<any|null>{return await this.db.prepare('SELECT * FROM room_codes WHERE code_lookup_hmac=? AND expires_at>?').bind(codeHmac,now).first();}
  async roomByDoId(id:string):Promise<any|null>{return await this.db.prepare('SELECT * FROM room_codes WHERE durable_object_id=?').bind(id).first();}
  async updateRoomStatus(doId:string,status:string,now:number):Promise<void>{await this.db.prepare('UPDATE room_codes SET status=?,updated_at=? WHERE durable_object_id=?').bind(status,now,doId).run();}
  async rotateInvite(codeHmac:string,digest:string,now:number):Promise<void>{await this.db.prepare('UPDATE room_codes SET invite_digest=?,invite_version=invite_version+1,updated_at=? WHERE code_lookup_hmac=?').bind(digest,now,codeHmac).run();}
  async recordFailedJoin(codeHmac:string,now:number):Promise<void>{await this.db.prepare('UPDATE room_codes SET failed_join_count=failed_join_count+1,updated_at=? WHERE code_lookup_hmac=?').bind(now,codeHmac).run();}
  async issueTicket(input:{raw:string;doId:string;codeHmac:string;accountId:string;sessionId:string;memberId:string;protocol:string;clientVersion:string;now:number;expiresAt:number}):Promise<void>{const digest=await sha256(input.raw);await this.db.prepare('INSERT INTO connection_tickets(id,ticket_digest,durable_object_id,code_lookup_hmac,account_id,session_id,room_member_id,protocol_version,client_version,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(randomId(),digest,input.doId,input.codeHmac,input.accountId,input.sessionId,input.memberId,input.protocol,input.clientVersion,input.now,input.expiresAt).run();}
  async consumeTicket(raw:string,now:number):Promise<any|null>{const digest=await sha256(raw);const row=await this.db.prepare('SELECT * FROM connection_tickets WHERE ticket_digest=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?').bind(digest,now).first<any>();if(!row)return null;const r=await this.db.prepare('UPDATE connection_tickets SET used_at=? WHERE id=? AND used_at IS NULL').bind(now,row.id).run();return r.meta.changes===1?row:null;}
  async rateLimit(key:string,limit:number,windowMs:number,now:number):Promise<{allowed:boolean;remaining:number}>{const digest=await sha256(key),window=Math.floor(now/windowMs)*windowMs;const row=await this.db.prepare('SELECT attempts,blocked_until FROM rate_limits WHERE key_digest=? AND window_started_at=?').bind(digest,window).first<any>();const attempts=(row?.attempts??0)+1;await this.db.prepare('INSERT INTO rate_limits(key_digest,window_started_at,attempts,blocked_until) VALUES(?,?,?,NULL) ON CONFLICT(key_digest,window_started_at) DO UPDATE SET attempts=excluded.attempts').bind(digest,window,attempts).run();if((attempts&31)===1)await this.db.prepare('DELETE FROM rate_limits WHERE window_started_at<?').bind(now-24*60*60_000).run();return{allowed:attempts<=limit&&!(row?.blocked_until&&row.blocked_until>now),remaining:Math.max(0,limit-attempts)};}
  async statistics(accountId:string):Promise<any>{return await this.db.prepare('SELECT * FROM player_statistics WHERE account_id=?').bind(accountId).first()??{};}
  async history(accountId:string):Promise<any[]>{const result=await this.db.prepare(`SELECT m.match_id,m.ended_at AS completedAt,m.winner,p.role,p.won FROM completed_match_players p JOIN completed_matches m ON m.match_id=p.match_id AND m.archive_version=p.archive_version WHERE p.account_id=? ORDER BY m.ended_at DESC LIMIT 50`).bind(accountId).all();return result.results as any[];}

  async recoveryByDigest(digest:string,now:number):Promise<any|null>{return await this.db.prepare('SELECT * FROM recovery_tokens WHERE token_digest=? AND consumed_at IS NULL AND expires_at>?').bind(digest,now).first<any>();}
  async consumeRecovery(id:string,now:number):Promise<void>{await this.db.prepare('UPDATE recovery_tokens SET consumed_at=? WHERE id=? AND consumed_at IS NULL').bind(now,id).run();}
  async updatePin(accountId:string,input:{hash:string;salt:string;version:string;parameters:string},now:number):Promise<void>{await this.db.prepare('UPDATE accounts SET pin_hash=?,pin_salt=?,pin_hash_version=?,pin_hash_parameters=?,failed_attempt_count=0,locked_until=NULL,updated_at=? WHERE id=?').bind(input.hash,input.salt,input.version,input.parameters,now,accountId).run();}
  async audit(accountId:string|null,category:string,result:string,metadata:Record<string,unknown>,now=Date.now()):Promise<void>{await this.db.prepare('INSERT INTO audit_events(id,account_id,category,result,safe_metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(randomId(),accountId,category,result,JSON.stringify(metadata),now).run();}
}
