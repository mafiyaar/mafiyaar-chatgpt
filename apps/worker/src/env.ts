export interface RuntimeConfig {
  appEnv: Env['APP_ENV']; appVersion: string; publicOrigin: string;
  roomTtlMs: number; sessionTtlMs: number; ticketTtlMs: number;
}
export function config(env: Env): RuntimeConfig {
  const requireSecret = (name: keyof Env): string => {
    const value = String(env[name] ?? '');
    if (value.length < 24) throw new Error(`Missing or weak secret binding: ${String(name)}`);
    return value;
  };
  requireSecret('PIN_PEPPER'); requireSecret('SESSION_HASH_SECRET'); requireSecret('ROOM_CODE_LOOKUP_SECRET');
  if(!env.ROOM_CODE_LOOKUP_KEY_VERSION?.trim())throw new Error('Missing ROOM_CODE_LOOKUP_KEY_VERSION');
  if(env.ROOM_CODE_LOOKUP_SECRET_PREVIOUS&&env.ROOM_CODE_LOOKUP_SECRET_PREVIOUS.length<24)throw new Error('Weak ROOM_CODE_LOOKUP_SECRET_PREVIOUS');
  requireSecret('INVITATION_HASH_SECRET'); requireSecret('INTERNAL_ROUTING_SECRET');
  if (env.APP_ENV === 'production' && env.TURNSTILE_MODE === 'disabled') throw new Error('Turnstile test provider cannot be enabled in production.');
  return {
    appEnv: env.APP_ENV, appVersion: env.APP_VERSION, publicOrigin: env.PUBLIC_ORIGIN,
    roomTtlMs: Number(env.ROOM_TTL_HOURS) * 3_600_000,
    sessionTtlMs: Number(env.SESSION_TTL_HOURS) * 3_600_000,
    ticketTtlMs: Number(env.WS_TICKET_TTL_SECONDS) * 1000
  };
}

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MAFIYAAR_ROOMS: DurableObjectNamespace<import('./durable/MafiYaarRoom.js').MafiYaarRoom>;
  APP_ENV: 'local'|'staging'|'production'|'test'; APP_VERSION:string; PUBLIC_ORIGIN:string;
  TURNSTILE_MODE:'disabled'|'escalation'; TURNSTILE_SITE_KEY:string; ROOM_TTL_HOURS:string; SESSION_TTL_HOURS:string; WS_TICKET_TTL_SECONDS:string;
  PIN_PEPPER:string; SESSION_HASH_SECRET:string; ROOM_CODE_LOOKUP_SECRET:string; ROOM_CODE_LOOKUP_KEY_VERSION:string; ROOM_CODE_LOOKUP_SECRET_PREVIOUS?:string; ROOM_CODE_LOOKUP_PREVIOUS_KEY_VERSION?:string; INVITATION_HASH_SECRET:string; INTERNAL_ROUTING_SECRET:string; TURNSTILE_SECRET_KEY:string;
}
