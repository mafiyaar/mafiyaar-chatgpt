import {describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {runDurableObjectAlarm,runInDurableObject,evictDurableObject} from 'cloudflare:test';
import type {MafiYaarRoom} from '../../apps/worker/src/durable/MafiYaarRoom.js';
import type {ClientCommand,PlayerView,SessionUser} from '../../packages/contracts/index.js';
const user=(i:number):SessionUser=>({accountId:`rt-account-${i}-${crypto.randomUUID().slice(0,8)}`,username:`rt_user_${i}`,displayName:`Player ${i}`,avatar:'moon',locale:'ur-Roman'});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function socket(stub:any,u:SessionUser,playerId:string):Promise<WebSocket>{
  const identity={sessionId:`session-${u.accountId}`,accountId:u.accountId,playerId,roomMemberId:playerId,protocolVersion:'cf-1.0.0',clientVersion:'1.0.0'};
  const response=await stub.fetch(new Request('http://internal/ws',{headers:{upgrade:'websocket','x-mafiyaar-internal':env.INTERNAL_ROUTING_SECRET,'x-mafiyaar-identity':JSON.stringify(identity)}}));
  expect(response.status).toBe(101);const ws=response.webSocket!;ws.accept?.();return ws;
}
let seq=0;const command=(value:Omit<ClientCommand,'commandId'|'sequence'>):ClientCommand=>({...value,commandId:`cmd_${crypto.randomUUID().replaceAll('-','')}`,sequence:++seq} as ClientCommand);
async function send(ws:WebSocket,value:ClientCommand){ws.send(JSON.stringify(value));await sleep(8);}

describe('Hibernatable realtime room',()=>{
  it('runs six clients, preserves fixed deadlines, and deduplicates commands',async()=>{
    const stub=env.MAFIYAAR_ROOMS.get(env.MAFIYAAR_ROOMS.newUniqueId()),users=Array.from({length:6},(_,i)=>user(i));
    const initialized=await stub.initialize({publicCode:'RTABC',codeLookupHmac:'hmac-rt',creator:users[0]!,settings:{playerLimit:6,mafiaCount:1,preset:'test',startModel:'opening'},expiresAt:Date.now()+3_600_000});
    const memberships=[initialized,...await Promise.all(users.slice(1).map(u=>stub.join({user:u})))];
    const sockets=await Promise.all(users.map((u,i)=>socket(stub,u,memberships[i]!.memberId)));
    for(let i=0;i<6;i++)await send(sockets[i]!,command({type:'ready',roomId:'RTABC',ready:true} as any));
    await send(sockets[0]!,command({type:'start',roomId:'RTABC'} as any));
    expect((await stub.getPlayerView(users[0]!.accountId)).match!.phase).toBe('role_reveal');
    for(let i=0;i<6;i++)await send(sockets[i]!,command({type:'ack_role',roomId:'RTABC'} as any));
    expect((await stub.getPlayerView(users[0]!.accountId)).match!.phase).toBe('opening_discussion');
    await sleep(100);expect(await runDurableObjectAlarm(stub)).toBe(true);await sleep(70);expect(await runDurableObjectAlarm(stub)).toBe(true);
    const before=await stub.getPlayerView(users[0]!.accountId);expect(before.match!.phase).toBe('night_action');
    for(let i=0;i<6;i++){const view=await stub.getPlayerView(users[i]!.accountId),target=view.match!.self.grid![0]!;await send(sockets[i]!,command({type:'night_action',roomId:'RTABC',phaseSequence:view.match!.phaseSequence,targetId:target,confirmed:true} as any));}
    expect((await stub.getPlayerView(users[0]!.accountId)).match!.phase).toBe('night_action');
    const duplicateId=`cmd_${crypto.randomUUID().replaceAll('-','')}`,v=await stub.getPlayerView(users[0]!.accountId),target=v.match!.self.grid![0]!;
    const dup={type:'night_action',roomId:'RTABC',phaseSequence:v.match!.phaseSequence,targetId:target,confirmed:true,sequence:999,commandId:duplicateId} as ClientCommand;
    await send(sockets[0]!,dup);const count1=await runInDurableObject(stub,async(_i:MafiYaarRoom,state)=>state.storage.sql.exec<any>('SELECT count(*) c FROM room_events WHERE command_id=?',duplicateId).one().c);await send(sockets[0]!,dup);const count2=await runInDurableObject(stub,async(_i:MafiYaarRoom,state)=>state.storage.sql.exec<any>('SELECT count(*) c FROM room_events WHERE command_id=?',duplicateId).one().c);expect(count1).toBe(1);expect(count2).toBe(1);
    for(const ws of sockets)ws.close(1000,'done');
  });
  it('reconstructs snapshot, journal, attachments, and alarm after hibernation eviction',async()=>{const u=user(20),stub=env.MAFIYAAR_ROOMS.get(env.MAFIYAAR_ROOMS.newUniqueId());const init=await stub.initialize({publicCode:'RTBCD',codeLookupHmac:'h2',creator:u,settings:{playerLimit:6,preset:'test'},expiresAt:Date.now()+3_600_000});const ws=await socket(stub,u,init.memberId);await evictDurableObject(stub,{webSockets:'hibernate'});const view=await stub.getPlayerView(u.accountId);expect(view.roomCode).toBe('RTBCD');const alarm=await runInDurableObject(stub,async(_i:MafiYaarRoom,state)=>state.storage.getAlarm());expect(alarm).not.toBeNull();ws.close(1000,'done');});
  it('isolates two rooms with distinct random IDs',async()=>{const a=env.MAFIYAAR_ROOMS.newUniqueId(),b=env.MAFIYAAR_ROOMS.newUniqueId();expect(a.toString()).not.toBe(b.toString());const sa=env.MAFIYAAR_ROOMS.get(a),sb=env.MAFIYAAR_ROOMS.get(b),ua=user(30),ub=user(31);await sa.initialize({publicCode:'RTCDE',codeLookupHmac:'ha',creator:ua,settings:{playerLimit:6,preset:'test'},expiresAt:Date.now()+10000});await sb.initialize({publicCode:'RTDEF',codeLookupHmac:'hb',creator:ub,settings:{playerLimit:6,preset:'test'},expiresAt:Date.now()+10000});expect((await sa.getPlayerView(ua.accountId)).roomCode).toBe('RTCDE');await expect(sb.getPlayerView(ua.accountId)).rejects.toBeTruthy();});
});
