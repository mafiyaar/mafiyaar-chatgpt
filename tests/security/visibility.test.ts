import {describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {viewFor,createMatch} from '../../packages/engine/index.js';
import {validateSettings,parseClientCommand} from '../../packages/validation/index.js';

describe('runtime security and visibility invariants',()=>{
  it('filters server-only state from every player view',()=>{const settings=validateSettings({playerLimit:6,preset:'test'},true),members=Array.from({length:6},(_,i)=>({accountId:`a${i}`,playerId:`p${i}`,displayName:`P${i}`,avatar:'moon',ready:true,connected:true}));const match=createMatch({id:'m',roomId:'ABCDE',members,settings,entropyId:'DO-NOT-LEAK',random:()=>0});const room:any={id:'ABCDE',code:'ABCDE',inviteToken:'private',creatorAccountId:'a0',status:'active',settings,members,match,createdAt:0,expiresAt:999999,version:1};for(const member of members){const text=JSON.stringify(viewFor(room,member.accountId));expect(text).not.toContain('DO-NOT-LEAK');expect(text).not.toContain('gridOrders');expect(text).not.toContain('nightSubmissions');expect(text).not.toContain('inviteToken');}});
  it('strictly rejects malformed and unsupported WebSocket commands',()=>{for(const input of [{type:'ready',roomId:'ABCDE',ready:true,sequence:1},{type:'root_shell',roomId:'ABCDE',commandId:'abcdefghijklmnop'},{type:'vote',roomId:'ABCDE',commandId:'abcdefghijklmnop',sequence:1,phaseSequence:1,targetId:'<script>',confirmed:true,runoff:false}])expect(()=>parseClientCommand(input)).toThrow();});
  it('uses private random Durable Object identifiers in D1 only',async()=>{const row=await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='room_codes'").first<any>();expect(row.sql).toContain('durable_object_id');expect(row.sql).toContain('code_lookup_hmac');});
});
