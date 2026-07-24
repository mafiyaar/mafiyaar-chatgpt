import { DurableObject } from 'cloudflare:workers';
import type { ClientCommand, MatchSettings, PlayerView, RoomState, SessionUser } from '../../../../packages/contracts/index.js';
import { CLIENT_MINIMUM_VERSION, COPY_VERSION, ENGINE_VERSION, JOURNAL_VERSION, PROTOCOL_VERSION, RULES_VERSION, STATE_SCHEMA_VERSION } from '../../../../packages/contracts/index.js';
import { validateSettings, ValidationError, parseClientCommand } from '../../../../packages/validation/index.js';
import { abandonMatch, acknowledgeRole, advanceExpiredPhase, allRolesAcknowledged, createMatch, ensureGridOrders, pauseMatch, reconcileDiscussionReady, resumeMatch, setDiscussionReady, startAfterRoleReveal, submitNightAction, submitVote, viewFor } from '../../../../packages/engine/index.js';
import { secureRandomInt, randomId, safeEqual } from '../security/crypto.js';
import type { Env } from '../env.js';
import { D1ArchiveWriter } from '../repositories/archive.js';

interface RoomEnvelope {
  room:RoomState;
  codeLookupHmac:string;
  lastEventSequence:number;
  stateVersion:number;
  expectedAlarmAt:number|null;
  expectedAlarmKind:'phase'|'archive'|'expire'|null;
  expectedPhaseSequence:number|null;
  archiveStatus:'none'|'pending'|'complete';
  archiveAttempts:number;
}
interface StoredEvent {sequence:number;resulting_state_json:string;}
interface Attachment {sessionId:string;accountId:string;playerId:string;roomMemberId:string;protocolVersion:string;clientVersion:string;lastAcknowledgedSequence:number;attachmentVersion:'1';}
interface InitializeInput {publicCode:string;codeLookupHmac:string;creator:SessionUser;settings:Partial<MatchSettings>;expiresAt:number;}
interface JoinInput {user:SessionUser;}
interface ConnectIdentity {sessionId:string;accountId:string;playerId:string;roomMemberId:string;protocolVersion:string;clientVersion:string;}

const randomSource=(max:number)=>secureRandomInt(max);
const json=(value:unknown)=>JSON.stringify(value);
const parse=<T>(value:string):T=>JSON.parse(value) as T;

export class MafiYaarRoom extends DurableObject<Env>{
  private envelope:RoomEnvelope|null=null;
  constructor(ctx:DurableObjectState,env:Env){super(ctx,env);ctx.blockConcurrencyWhile(async()=>{this.ctx.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS room_snapshot(id INTEGER PRIMARY KEY CHECK(id=1),snapshot_json TEXT NOT NULL,last_event_sequence INTEGER NOT NULL,state_version INTEGER NOT NULL,expected_alarm_at INTEGER,expected_alarm_kind TEXT,expected_phase_sequence INTEGER,archive_status TEXT NOT NULL,archive_attempts INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS room_events(sequence INTEGER PRIMARY KEY AUTOINCREMENT,command_id TEXT UNIQUE,actor_account_id TEXT,event_type TEXT NOT NULL,phase_sequence INTEGER,visibility TEXT NOT NULL,payload_json TEXT NOT NULL,resulting_state_json TEXT NOT NULL,resulting_state_version INTEGER NOT NULL,rules_version TEXT NOT NULL,journal_version TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS command_budget(account_id TEXT NOT NULL,window_started_at INTEGER NOT NULL,attempts INTEGER NOT NULL,PRIMARY KEY(account_id,window_started_at));
  `);
    const row=this.ctx.storage.sql.exec<{snapshot_json:string}>('SELECT snapshot_json FROM room_snapshot WHERE id=1').toArray()[0];
    if(row){const restored=parse<RoomEnvelope>(row.snapshot_json);this.assertVersions(restored.room);if(restored.room.status==='active'&&restored.room.match?.phase==='victory'&&restored.room.match.phaseEndsAt===null){const now=Date.now();restored.room.match.phaseEndsAt=now+10_000;restored.room.version++;restored.stateVersion++;restored.expectedAlarmAt=restored.room.match.phaseEndsAt;restored.expectedAlarmKind='phase';restored.expectedPhaseSequence=restored.room.match.phaseSequence;this.persist(restored,{type:'victory_deadline_repaired',phaseSequence:restored.room.match.phaseSequence,visibility:'server'},now);}else{this.envelope=restored;}const scheduled=await this.ctx.storage.getAlarm();if(restored.expectedAlarmAt!==null&&scheduled!==restored.expectedAlarmAt)await this.ctx.storage.setAlarm(restored.expectedAlarmAt);if(restored.expectedAlarmAt===null&&scheduled!==null)await this.ctx.storage.deleteAlarm();}
  });}

  private load():RoomEnvelope{
    if(this.envelope)return this.envelope;
    const row=this.ctx.storage.sql.exec<any>('SELECT * FROM room_snapshot WHERE id=1').toArray()[0];
    if(!row)throw new ValidationError('ROOM_NOT_INITIALIZED','Room is unavailable.',404);
    let env=parse<RoomEnvelope>(row.snapshot_json);
    const tail=this.ctx.storage.sql.exec<StoredEvent>('SELECT sequence,resulting_state_json FROM room_events WHERE sequence>? ORDER BY sequence',env.lastEventSequence).toArray();
    for(const event of tail){env=parse<RoomEnvelope>(event.resulting_state_json);}
    this.assertVersions(env.room);this.envelope=env;return env;
  }
  private assertVersions(room:RoomState){if(room.match&&![STATE_SCHEMA_VERSION].includes(room.match.stateSchemaVersion))throw new Error('UNSUPPORTED_STATE_SCHEMA');}
  private persist(next:RoomEnvelope,event:{commandId?:string;actor?:string;type:string;phaseSequence?:number;visibility?:string;payload?:unknown},now=Date.now()):void{
    this.ctx.storage.transactionSync(()=>{
      this.ctx.storage.sql.exec('INSERT INTO room_events(command_id,actor_account_id,event_type,phase_sequence,visibility,payload_json,resulting_state_json,resulting_state_version,rules_version,journal_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',event.commandId??null,event.actor??null,event.type,event.phaseSequence??null,event.visibility??'server',json(event.payload??{}),'{}',next.stateVersion,RULES_VERSION,JOURNAL_VERSION,now);
      const seq=this.ctx.storage.sql.exec<{sequence:number}>('SELECT last_insert_rowid() AS sequence').one().sequence;
      next.lastEventSequence=seq;
      this.ctx.storage.sql.exec('UPDATE room_events SET resulting_state_json=? WHERE sequence=?',json(next),seq);
      this.ctx.storage.sql.exec(`INSERT INTO room_snapshot(id,snapshot_json,last_event_sequence,state_version,expected_alarm_at,expected_alarm_kind,expected_phase_sequence,archive_status,archive_attempts,updated_at) VALUES(1,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET snapshot_json=excluded.snapshot_json,last_event_sequence=excluded.last_event_sequence,state_version=excluded.state_version,expected_alarm_at=excluded.expected_alarm_at,expected_alarm_kind=excluded.expected_alarm_kind,expected_phase_sequence=excluded.expected_phase_sequence,archive_status=excluded.archive_status,archive_attempts=excluded.archive_attempts,updated_at=excluded.updated_at`,json(next),seq,next.stateVersion,next.expectedAlarmAt,next.expectedAlarmKind,next.expectedPhaseSequence,next.archiveStatus,next.archiveAttempts,now);
    });
    this.envelope=next;
  }
  private persistInitial(next:RoomEnvelope,now=Date.now()):void{this.ctx.storage.transactionSync(()=>{this.ctx.storage.sql.exec('INSERT INTO room_snapshot(id,snapshot_json,last_event_sequence,state_version,expected_alarm_at,expected_alarm_kind,expected_phase_sequence,archive_status,archive_attempts,updated_at) VALUES(1,?,?,?,?,?,?,?,?,?)',json(next),0,next.stateVersion,next.expectedAlarmAt,next.expectedAlarmKind,next.expectedPhaseSequence,next.archiveStatus,next.archiveAttempts,now);});this.envelope=next;}
  private prepareExpectedAlarm(next:RoomEnvelope):void{const match=next.room.match;if(next.room.status==='active'&&match?.phase==='victory'&&match.phaseEndsAt===null)match.phaseEndsAt=Date.now()+10_000;const deadline=next.room.status==='active'?match?.phaseEndsAt??null:null;if(deadline){next.expectedAlarmAt=deadline;next.expectedAlarmKind='phase';next.expectedPhaseSequence=match?.phaseSequence??null;}else if(next.room.status==='lobby'){next.expectedAlarmAt=next.room.expiresAt;next.expectedAlarmKind='expire';next.expectedPhaseSequence=null;}else if(next.archiveStatus==='pending'){next.expectedAlarmAt=Date.now()+Math.min(300_000,5000*2**Math.min(next.archiveAttempts,6));next.expectedAlarmKind='archive';next.expectedPhaseSequence=null;}else{next.expectedAlarmAt=null;next.expectedAlarmKind=null;next.expectedPhaseSequence=null;}}
  private async applyExpectedAlarm(next:RoomEnvelope):Promise<void>{if(next.expectedAlarmAt)await this.ctx.storage.setAlarm(next.expectedAlarmAt);else await this.ctx.storage.deleteAlarm();}
  private safeView(room:RoomState,accountId:string):PlayerView{return viewFor(room,accountId);}
  private attachment(ws:WebSocket):Attachment|null{try{return ws.deserializeAttachment() as Attachment}catch{return null;}}
  private broadcast(room:RoomState):void{for(const ws of this.ctx.getWebSockets()){const a=this.attachment(ws);if(!a)continue;try{ws.send(json({type:'room_update',view:this.safeView(room,a.accountId),serverTime:Date.now(),protocolVersion:PROTOCOL_VERSION}));}catch{}}}
  private requireMember(room:RoomState,accountId:string){const member=room.members.find(m=>m.accountId===accountId);if(!member)throw new ValidationError('NOT_MEMBER','You are not in this room.',403);return member;}
  private requireMatch(room:RoomState){if(!room.match)throw new ValidationError('MATCH_NOT_STARTED','Match has not started.',409);return room.match;}
  private commandBudget(accountId:string,now:number){const window=Math.floor(now/10_000)*10_000;this.ctx.storage.sql.exec('INSERT INTO command_budget(account_id,window_started_at,attempts) VALUES(?,?,1) ON CONFLICT(account_id,window_started_at) DO UPDATE SET attempts=attempts+1',accountId,window);const row=this.ctx.storage.sql.exec<{attempts:number}>('SELECT attempts FROM command_budget WHERE account_id=? AND window_started_at=?',accountId,window).one();if((row.attempts&31)===1)this.ctx.storage.sql.exec('DELETE FROM command_budget WHERE window_started_at<?',now-60*60_000);if(row.attempts>80)throw new ValidationError('RATE_LIMITED','Too many commands.',429);}

  async initialize(input:InitializeInput):Promise<{memberId:string;view:PlayerView}>{
    const existing=this.ctx.storage.sql.exec<any>('SELECT id FROM room_snapshot WHERE id=1').toArray()[0];if(existing){const env=this.load(),m=this.requireMember(env.room,input.creator.accountId);return{memberId:m.playerId,view:this.safeView(env.room,input.creator.accountId)};}
    const now=Date.now();const settings=validateSettings(input.settings,this.env.APP_ENV==='test');const member={accountId:input.creator.accountId,playerId:`p-${randomId().slice(0,8)}`,displayName:input.creator.displayName,avatar:input.creator.avatar,ready:false,connected:true};
    const room:RoomState={id:input.publicCode,code:input.publicCode,inviteToken:'',creatorAccountId:input.creator.accountId,status:'lobby',settings,members:[member],match:null,createdAt:now,expiresAt:input.expiresAt,version:1};
    const env:RoomEnvelope={room,codeLookupHmac:input.codeLookupHmac,lastEventSequence:0,stateVersion:1,expectedAlarmAt:null,expectedAlarmKind:null,expectedPhaseSequence:null,archiveStatus:'none',archiveAttempts:0};this.prepareExpectedAlarm(env);this.persistInitial(env,now);await this.applyExpectedAlarm(env);return{memberId:member.playerId,view:this.safeView(room,input.creator.accountId)};
  }
  async join(input:JoinInput):Promise<{memberId:string;view:PlayerView}>{const env=this.load(),room=structuredClone(env.room);if(room.expiresAt<=Date.now())throw new ValidationError('ROOM_EXPIRED','Room has expired.',410);let member=room.members.find(m=>m.accountId===input.user.accountId);if(member){member.connected=true;member.displayName=input.user.displayName;member.avatar=input.user.avatar;}else{if(room.status!=='lobby')throw new ValidationError('MATCH_ALREADY_STARTED','This match already started.',409);if(room.members.length>=room.settings.playerLimit)throw new ValidationError('ROOM_FULL','Room is full.',409);if(room.members.some(m=>m.displayName.toLowerCase()===input.user.displayName.toLowerCase()))throw new ValidationError('DISPLAY_NAME_TAKEN','That display name is in use.',409);member={accountId:input.user.accountId,playerId:`p-${randomId().slice(0,8)}`,displayName:input.user.displayName,avatar:input.user.avatar,ready:false,connected:true};room.members.push(member);}room.version++;const next={...env,room,stateVersion:env.stateVersion+1};this.persist(next,{actor:input.user.accountId,type:'member_joined',visibility:'public'});this.broadcast(room);return{memberId:member.playerId,view:this.safeView(room,input.user.accountId)};}
  async member(accountId:string):Promise<{memberId:string;view:PlayerView}>{const env=this.load(),m=this.requireMember(env.room,accountId);return{memberId:m.playerId,view:this.safeView(env.room,accountId)};}
  async leave(accountId:string):Promise<void>{const env=this.load(),room=structuredClone(env.room),m=this.requireMember(room,accountId);if(room.status==='lobby'){room.members=room.members.filter(x=>x.accountId!==accountId);if(room.creatorAccountId===accountId&&room.members[0])room.creatorAccountId=room.members[0].accountId;}else{m.connected=false;const p=room.match?.players.find(x=>x.accountId===accountId);if(p)p.connected=false;if(room.match)reconcileDiscussionReady(room.match,Date.now());}room.version++;const next={...env,room,stateVersion:env.stateVersion+1};this.prepareExpectedAlarm(next);this.persist(next,{actor:accountId,type:'member_left',visibility:'public'});await this.applyExpectedAlarm(next);this.broadcast(room);}
  async getPlayerView(accountId:string):Promise<PlayerView>{const env=this.load();this.requireMember(env.room,accountId);return this.safeView(env.room,accountId);}
  async roomStatus():Promise<{status:RoomState['status'];expiresAt:number}>{const env=this.load();return{status:env.room.status,expiresAt:env.room.expiresAt};}

  async fetch(request:Request):Promise<Response>{
    if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('Upgrade required',{status:426});
    const internal=request.headers.get('x-mafiyaar-internal')??'';if(!safeEqual(internal,this.env.INTERNAL_ROUTING_SECRET))return new Response('Not found',{status:404});
    const identity=parse<ConnectIdentity>(request.headers.get('x-mafiyaar-identity')??'{}');if(identity.protocolVersion!==PROTOCOL_VERSION)return new Response('Protocol mismatch',{status:409});
    const env=this.load(),room=structuredClone(env.room),member=this.requireMember(room,identity.accountId);if(member.playerId!==identity.playerId)return new Response('Membership mismatch',{status:403});
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.ctx.acceptWebSocket(server,[identity.accountId]);const attachment:Attachment={...identity,attachmentVersion:'1',lastAcknowledgedSequence:env.lastEventSequence};server.serializeAttachment(attachment);member.connected=true;const player=room.match?.players.find(p=>p.accountId===identity.accountId);if(player){player.connected=true;reconcileDiscussionReady(room.match!,Date.now());}
    room.version++;const next={...env,room,stateVersion:env.stateVersion+1};this.prepareExpectedAlarm(next);this.persist(next,{actor:identity.accountId,type:'socket_connected',visibility:'public'});await this.applyExpectedAlarm(next);server.send(json({type:'snapshot',view:this.safeView(next.room,identity.accountId),serverTime:Date.now(),protocolVersion:PROTOCOL_VERSION}));this.broadcast(next.room);return new Response(null,{status:101,webSocket:client});
  }

  async webSocketMessage(ws:WebSocket,message:ArrayBuffer|string):Promise<void>{
    const a=this.attachment(ws);if(!a){ws.close(1008,'Invalid attachment');return;}const raw=typeof message==='string'?message:new TextDecoder().decode(message);if(raw.length>16_384){ws.close(1009,'Message too large');return;}
    try{const command=parseClientCommand(parse<unknown>(raw));if(command.type==='pong')return;const env=this.load();this.commandBudget(a.accountId,Date.now());if(command.roomId!==env.room.code)throw new ValidationError('ROOM_MISMATCH','Room mismatch.',403);if(command.commandId){const duplicate=this.ctx.storage.sql.exec<any>('SELECT sequence FROM room_events WHERE command_id=?',command.commandId).toArray()[0];if(duplicate){ws.send(json({type:'command_accepted',sequence:'sequence'in command?command.sequence:0,serverTime:Date.now(),commandId:command.commandId}));return;}}
      const room=structuredClone(env.room);this.applyCommand(room,a.accountId,command);room.version++;const next:{[K in keyof RoomEnvelope]:RoomEnvelope[K]}={...env,room,stateVersion:env.stateVersion+1};this.prepareExpectedAlarm(next);this.persist(next,{commandId:command.commandId,actor:a.accountId,type:`command:${command.type}`,phaseSequence:command.phaseSequence,visibility:'server',payload:{type:command.type}},Date.now());await this.applyExpectedAlarm(next);if(room.status!==env.room.status)await this.env.DB.prepare('UPDATE room_codes SET status=?,updated_at=? WHERE durable_object_id=?').bind(room.status,Date.now(),this.ctx.id.toString()).run();this.broadcast(room);ws.send(json({type:'command_accepted',sequence:'sequence'in command?command.sequence:0,serverTime:Date.now(),commandId:command.commandId}));
    }catch(error){const e=error instanceof ValidationError?error:new ValidationError('COMMAND_FAILED','Action could not be completed.',400);ws.send(json({type:'error',code:e.code,message:e.message,recoverable:e.status<500}));}
  }
  async webSocketClose(ws:WebSocket):Promise<void>{await this.disconnectSocket(ws);}
  async webSocketError(ws:WebSocket):Promise<void>{await this.disconnectSocket(ws);}
  private async disconnectSocket(ws:WebSocket){const a=this.attachment(ws);if(!a)return;const still=this.ctx.getWebSockets(a.accountId).some(x=>x!==ws);if(still)return;const env=this.load(),room=structuredClone(env.room),member=room.members.find(m=>m.accountId===a.accountId);if(!member)return;member.connected=false;const player=room.match?.players.find(p=>p.accountId===a.accountId);if(player){player.connected=false;reconcileDiscussionReady(room.match!,Date.now());}room.version++;const next={...env,room,stateVersion:env.stateVersion+1};this.prepareExpectedAlarm(next);this.persist(next,{actor:a.accountId,type:'socket_disconnected',visibility:'public'});await this.applyExpectedAlarm(next);this.broadcast(room);}

  private applyCommand(room:RoomState,accountId:string,command:ClientCommand):void{
    const member=this.requireMember(room,accountId),now=Date.now();
    switch(command.type){
      case'subscribe':return;
      case'ready':if(room.status!=='lobby')throw new ValidationError('ROOM_LOCKED','Room is locked.',409);member.ready=command.ready;return;
      case'update_settings':if(room.status!=='lobby'||room.creatorAccountId!==accountId)throw new ValidationError('CREATOR_ONLY','Only the creator can change settings.',403);room.settings=validateSettings({...room.settings,...command.settings},this.env.APP_ENV==='test');room.members.forEach(m=>m.ready=false);return;
      case'start':{if(room.status!=='lobby'||room.creatorAccountId!==accountId)throw new ValidationError('CREATOR_ONLY','Only the creator can start.',403);if(room.members.length<5)throw new ValidationError('NOT_ENOUGH_PLAYERS','At least five players are required.',409);if(!room.members.every(m=>m.ready&&m.connected))throw new ValidationError('PLAYERS_NOT_READY','Everyone must be ready and connected.',409);room.match=createMatch({id:randomId(),roomId:room.code,members:room.members,settings:room.settings,entropyId:`entropy:${randomId()}`,random:randomSource});ensureGridOrders(room.match,randomSource);room.status='active';return;}
      case'ack_role':{const match=this.requireMatch(room);const p=match.players.find(p=>p.accountId===accountId)!;acknowledgeRole(match,p.id);if(allRolesAcknowledged(match))startAfterRoleReveal(match,now);return;}
      case'discussion_ready':{const match=this.requireMatch(room);if(command.phaseSequence!==match.phaseSequence)throw new ValidationError('STALE_PHASE','This phase has ended.',409);const p=match.players.find(p=>p.accountId===accountId)!;setDiscussionReady(match,p.id,command.ready,now);return;}
      case'night_action':{const match=this.requireMatch(room);if(command.phaseSequence!==match.phaseSequence)throw new ValidationError('STALE_PHASE','This phase has ended.',409);const p=match.players.find(p=>p.accountId===accountId)!;submitNightAction(match,p.id,command.targetId,command.confirmed,command.sequence,now);return;}
      case'vote':{const match=this.requireMatch(room);if(command.phaseSequence!==match.phaseSequence)throw new ValidationError('STALE_PHASE','This phase has ended.',409);const p=match.players.find(p=>p.accountId===accountId)!;submitVote(match,p.id,command.targetId,command.confirmed,command.runoff,command.sequence,now);return;}
      case'rematch':{if(room.status!=='complete')throw new ValidationError('MATCH_NOT_COMPLETE','Match is not complete.',409);room.status='lobby';room.match=null;room.expiresAt=now+Number(this.env.ROOM_TTL_HOURS)*3_600_000;room.members.forEach(m=>{m.ready=false;m.connected=true});return;}
      case'leave':if(room.status==='lobby')room.members=room.members.filter(m=>m.accountId!==accountId);else member.connected=false;return;
      case'pause':if(room.creatorAccountId!==accountId)throw new ValidationError('CREATOR_ONLY','Only the creator can pause.',403);pauseMatch(this.requireMatch(room),command.reason,now);return;
      case'resume':if(room.creatorAccountId!==accountId)throw new ValidationError('CREATOR_ONLY','Only the creator can resume.',403);resumeMatch(this.requireMatch(room),now);return;
      case'abandon':if(room.creatorAccountId!==accountId)throw new ValidationError('CREATOR_ONLY','Only the creator can abandon.',403);abandonMatch(this.requireMatch(room),command.reason,now);room.status='abandoned';return;
      case'pong':return;
    }
  }

  async alarm():Promise<void>{const env=this.load(),now=Date.now();if(!env.expectedAlarmAt||env.expectedAlarmAt>now+25){if(env.expectedAlarmAt)await this.ctx.storage.setAlarm(env.expectedAlarmAt);return;}if(env.expectedAlarmKind==='archive'){await this.attemptArchive(env);return;}if(env.expectedAlarmKind==='expire'){if(env.room.status==='lobby'&&env.room.expiresAt<=now){const room=structuredClone(env.room);room.status='expired';room.version++;const next={...env,room,stateVersion:env.stateVersion+1,expectedAlarmAt:null,expectedAlarmKind:null,expectedPhaseSequence:null};this.persist(next,{type:'room_expired',visibility:'public'},now);await this.ctx.storage.deleteAlarm();await this.env.DB.prepare('UPDATE room_codes SET status=?,updated_at=? WHERE durable_object_id=?').bind('expired',now,this.ctx.id.toString()).run();this.broadcast(room);}return;}if(env.expectedAlarmKind!=='phase'||!env.room.match||env.room.status!=='active')return;const match=env.room.match;if(env.expectedPhaseSequence!==match.phaseSequence||match.phaseEndsAt===null||match.phaseEndsAt>now||(match.completedAt&&match.phase!=='victory'))return;const room=structuredClone(env.room),phaseBefore=room.match!.phase;advanceExpiredPhase(room.match!,now,randomSource);if(room.match!.phase===phaseBefore&&room.match!.phaseEndsAt&&room.match!.phaseEndsAt>now){await this.ctx.storage.setAlarm(room.match!.phaseEndsAt);return;}const becameComplete=room.match!.phase==='summary';if(becameComplete)room.status='complete';
    room.version++;const next={...env,room,archiveStatus:becameComplete?'pending' as const:env.archiveStatus,stateVersion:env.stateVersion+1,expectedAlarmAt:null,expectedAlarmKind:null,expectedPhaseSequence:null};this.prepareExpectedAlarm(next);this.persist(next,{type:'alarm_phase_advanced',phaseSequence:match.phaseSequence,visibility:'public',payload:{from:phaseBefore,to:room.match!.phase}},now);await this.applyExpectedAlarm(next);if(room.status!==env.room.status)await this.env.DB.prepare('UPDATE room_codes SET status=?,updated_at=? WHERE durable_object_id=?').bind(room.status,now,this.ctx.id.toString()).run();this.broadcast(room);if(next.archiveStatus==='pending')await this.attemptArchive(next);
  }
  private async attemptArchive(env:RoomEnvelope):Promise<void>{try{await new D1ArchiveWriter(this.env).archive(env.room,env.codeLookupHmac);const next={...env,archiveStatus:'complete' as const,expectedAlarmAt:null,expectedAlarmKind:null,expectedPhaseSequence:null,stateVersion:env.stateVersion+1};this.persist(next,{type:'archive_complete',visibility:'server'});await this.ctx.storage.deleteAlarm();}catch{const next={...env,archiveStatus:'pending' as const,archiveAttempts:env.archiveAttempts+1,stateVersion:env.stateVersion+1};this.prepareExpectedAlarm(next);this.persist(next,{type:'archive_retry_scheduled',visibility:'server',payload:{attempt:next.archiveAttempts}});await this.applyExpectedAlarm(next);}}
}

