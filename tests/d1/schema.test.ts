import {describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';

describe('D1 global schema boundary',()=>{
  it('contains required global tables',async()=>{const r=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<any>();const names=new Set(r.results.map(x=>x.name));for(const name of ['accounts','profiles','sessions','room_codes','connection_tickets','completed_matches','player_statistics','audit_events','schema_versions'])expect(names.has(name)).toBe(true);});
  it('contains no active-secret-bearing columns',async()=>{const r=await env.DB.prepare("SELECT name,sql FROM sqlite_master WHERE type='table'").all<any>();const ddl=JSON.stringify(r.results).toLowerCase();for(const forbidden of ['secret_entropy','role_map','unrevealed_vote','night_submission','selection_map'])expect(ddl).not.toContain(forbidden);});
  it('enforces unique idempotency keys',async()=>{const now=Date.now();await env.DB.prepare("INSERT INTO accounts(id,username,pin_hash,pin_salt,pin_hash_version,pin_hash_parameters,created_at,updated_at) VALUES('a','unique_a','h','s','v','{}',?,?)").bind(now,now).run();await expect(env.DB.prepare("INSERT INTO accounts(id,username,pin_hash,pin_salt,pin_hash_version,pin_hash_parameters,created_at,updated_at) VALUES('b','unique_a','h','s','v','{}',?,?)").bind(now,now).run()).rejects.toBeTruthy();});
});
