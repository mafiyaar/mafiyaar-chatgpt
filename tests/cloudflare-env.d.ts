declare module 'cloudflare:workers' {
  interface ProvidedEnv extends Env {}
  export const env: ProvidedEnv & { TEST_MIGRATIONS: unknown[] };
  export const exports: { default: ExportedHandler<ProvidedEnv> };
}
declare module 'cloudflare:test' {
  export function applyD1Migrations(db:D1Database,migrations:unknown[]):Promise<void>;
  export function runInDurableObject<T,R>(stub:unknown,callback:(instance:T,state:DurableObjectState)=>R|Promise<R>):Promise<R>;
  export function runDurableObjectAlarm(stub:unknown):Promise<boolean>;
  export function evictDurableObject(stub:unknown,options?:{webSockets?:'close'|'hibernate'}):Promise<void>;
}
declare module 'vitest' {
  export function describe(name:string,fn:()=>void):void;
  export function it(name:string,fn:()=>unknown|Promise<unknown>):void;
  export function expect(value:unknown):any;
  export function beforeEach(fn:()=>unknown|Promise<unknown>):void;
  export function afterEach(fn:()=>unknown|Promise<unknown>):void;
}
declare module '@playwright/test' {
  export const test:any;
  export const expect:any;
  export function defineConfig(value:unknown):unknown;
  export type Page=any;
  export type BrowserContext=any;
}
