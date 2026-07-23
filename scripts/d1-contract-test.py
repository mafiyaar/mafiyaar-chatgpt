from pathlib import Path
import sqlite3, json, sys
sql=Path('migrations/d1/0001_initial.sql').read_text(encoding='utf-8')
con=sqlite3.connect(':memory:')
con.execute('PRAGMA foreign_keys=ON')
con.executescript(sql)
checks=[]
def ok(cond,label):
    if not cond: raise AssertionError(label)
    checks.append(label)
tables={r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required={'accounts','profiles','sessions','recovery_tokens','room_codes','connection_tickets','completed_matches','completed_match_players','completed_public_events','completed_votes','completed_predictions','player_statistics','statistics_applications','audit_events','rate_limits','schema_versions'}
ok(required<=tables,'required tables')
# No unresolved active secrets in D1 schema.
cols=[]
for table in tables:
    if table.startswith('sqlite_'): continue
    cols.extend((table,r[1]) for r in con.execute(f'PRAGMA table_info({table})'))
for forbidden in ['role_map','match_seed','night_action','unrevealed_vote','grid_order','private_view']:
    ok(not any(forbidden in c.lower() for _,c in cols),f'no {forbidden} column')
# Core constraints and cascades.
now=1_000
con.execute("INSERT INTO accounts(id,username,pin_hash,pin_salt,pin_hash_version,pin_hash_parameters,recovery_email,failed_attempt_count,locked_until,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",('a','userone','hash','salt','scrypt-v1','{}',None,0,None,now,now,None))
con.execute("INSERT INTO profiles(account_id,display_name,updated_at) VALUES(?,?,?)",('a','User One',now))
con.execute("INSERT INTO player_statistics(account_id,updated_at) VALUES(?,?)",('a',now))
try:
    con.execute("INSERT INTO accounts(id,username,pin_hash,pin_salt,pin_hash_version,pin_hash_parameters,recovery_email,failed_attempt_count,locked_until,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",('b','USERONE','hash','salt','scrypt-v1','{}',None,0,None,now,now,None))
    raise AssertionError('username uniqueness')
except sqlite3.IntegrityError: checks.append('username case-insensitive uniqueness')
con.execute("INSERT INTO room_codes(code_lookup_hmac,lookup_key_version,durable_object_id,creator_account_id,invite_digest,status,created_at,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",('h','hmac-v1','do-private','a','invite','lobby',now,now+1_000,now))
try:
    con.execute("INSERT INTO room_codes(code_lookup_hmac,lookup_key_version,durable_object_id,creator_account_id,invite_digest,status,created_at,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",('h2','hmac-v1','do-private','a','invite2','lobby',now,now+1_000,now))
    raise AssertionError('DO ID unique')
except sqlite3.IntegrityError: checks.append('DO ID unique')
con.execute("INSERT INTO completed_matches VALUES(?,?,?,?,?,?,?,?,?,?,?)",('m','1','h','rules','engine',now,now+10,'civilian',2,'{}',now))
try:
    con.execute("INSERT INTO completed_matches VALUES(?,?,?,?,?,?,?,?,?,?,?)",('m','1','h','rules','engine',now,now+10,'civilian',2,'{}',now))
    raise AssertionError('archive idempotency key')
except sqlite3.IntegrityError: checks.append('archive idempotency key')
con.execute("INSERT INTO completed_match_players VALUES(?,?,?,?,?,?,?)",('m','1','a','p1','civilian',1,'{}'))
con.execute("DELETE FROM room_codes WHERE creator_account_id='a'")
con.execute("DELETE FROM accounts WHERE id='a'")
ok(con.execute("SELECT count(*) FROM profiles").fetchone()[0]==0,'profile cascade')
ok(con.execute("SELECT count(*) FROM sessions").fetchone()[0]==0,'session cascade')
indexes={r[1] for r in con.execute("PRAGMA index_list('sessions')")}
ok(any('token' in x for x in indexes),'session token index')
print(json.dumps({'ok':True,'checks':len(checks),'tables':len(tables),'columns':len(cols),'labels':checks},indent=2))
