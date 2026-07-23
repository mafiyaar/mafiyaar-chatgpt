import {describe,it,expect} from 'vitest';
import {createMatch,ensureGridOrders,viewFor,submitNightAction,submitVote,advanceExpiredPhase,checkVictory} from '../../packages/engine/index.js';
import {validateSettings} from '../../packages/validation/index.js';
const members=(n:number)=>Array.from({length:n},(_,i)=>({accountId:`a${i}`,playerId:`p${i}`,displayName:`Player ${i}`,avatar:'moon',ready:true,connected:true}));
const room=(n=6,mafiaCount=1)=>{const settings=validateSettings({playerLimit:n,mafiaCount,preset:'test'},true);const match=createMatch({id:'m',roomId:'ABCDE',members:members(n),settings,entropyId:'server-only',random:()=>0,now:0});return{id:'ABCDE',code:'ABCDE',inviteToken:'',creatorAccountId:'a0',status:'active' as const,settings,members:members(n),match,createdAt:0,expiresAt:999999,version:1};};
describe('platform-neutral game engine',()=>{
 it('pins all match versions',()=>{const m=room().match!;expect(m.rulesVersion).toBeTruthy();expect(m.protocolVersion).toBeTruthy();expect(m.stateSchemaVersion).toBeTruthy();});
 it('never exposes seed in filtered view',()=>{const r=room();expect(JSON.stringify(viewFor(r,'a0'))).not.toContain('server-only');});
 it('gives living players N-1 cards',()=>{const r=room(12);r.match!.phase='night_action';r.match!.phaseSequence=2;ensureGridOrders(r.match!,()=>0);expect(r.match!.players.every(p=>(r.match!.gridOrders[`2:${p.id}`]??[]).length===11)).toBe(true);});
 it('keeps grids stable when ensure runs twice',()=>{const r=room();r.match!.phase='night_action';r.match!.phaseSequence=2;ensureGridOrders(r.match!,()=>0);const before=JSON.stringify(r.match!.gridOrders);ensureGridOrders(r.match!,()=>1);expect(JSON.stringify(r.match!.gridOrders)).toBe(before);});
 it('rejects dead night targets',()=>{const r=room();r.match!.phase='night_action';r.match!.players[1]!.alive=false;expect(()=>submitNightAction(r.match!,'p0','p1',true,1,1)).toThrow();});
 it('resets night submissions by phase',()=>{const r=room();r.match!.phase='night_action';r.match!.nightSubmissions={p0:{actorId:'p0',targetId:'p1',kind:'kill',confirmed:true,sequence:1,submittedAt:0}};advanceExpiredPhase(r.match!,1,()=>0);while(r.match!.phase!=='night_action')advanceExpiredPhase(r.match!,r.match!.phaseEndsAt??2,()=>0);expect(Object.keys(r.match!.nightSubmissions)).toHaveLength(0);});
 it('spectator votes never become real votes',()=>{const r=room();r.match!.phase='vote';r.match!.players[5]!.alive=false;const v=submitVote(r.match!,'p5','p1',true,false,1,1);expect(v.kind).toBe('spectator_prediction');});
 it('Mafia victory occurs at parity',()=>{const r=room(5);r.match!.players.filter(p=>p.role==='civilian').slice(0,2).forEach(p=>p.alive=false);expect(checkVictory(r.match!,1)).toBe('mafia');});
 it('Civilian victory occurs when Mafia gone',()=>{const r=room();r.match!.players.find(p=>p.role==='mafia')!.alive=false;expect(checkVictory(r.match!,1)).toBe('civilian');});
});
