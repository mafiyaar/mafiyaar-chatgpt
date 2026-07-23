interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MAFIYAAR_ROOMS: DurableObjectNamespace<import('./apps/worker/src/durable/MafiYaarRoom.js').MafiYaarRoom>;
  APP_ENV: 'local' | 'staging' | 'production' | 'test';
  APP_VERSION: string;
  PUBLIC_ORIGIN: string;
  TURNSTILE_MODE: 'disabled' | 'escalation';
  TURNSTILE_SITE_KEY: string;
  ROOM_TTL_HOURS: string;
  SESSION_TTL_HOURS: string;
  WS_TICKET_TTL_SECONDS: string;
  PIN_PEPPER: string;
  SESSION_HASH_SECRET: string;
  ROOM_CODE_LOOKUP_SECRET: string;
  ROOM_CODE_LOOKUP_KEY_VERSION: string;
  ROOM_CODE_LOOKUP_SECRET_PREVIOUS?: string;
  ROOM_CODE_LOOKUP_PREVIOUS_KEY_VERSION?: string;
  INVITATION_HASH_SECRET: string;
  INTERNAL_ROUTING_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
}
