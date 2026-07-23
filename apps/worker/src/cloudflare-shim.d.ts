declare interface D1Meta { changes:number; }
declare interface D1Result<T=unknown>{results:T[];success:boolean;meta:D1Meta;}
declare interface D1PreparedStatement {bind(...values:unknown[]):D1PreparedStatement;first<T=Record<string,unknown>>(column?:string):Promise<T|null>;all<T=Record<string,unknown>>():Promise<D1Result<T>>;run<T=unknown>():Promise<D1Result<T>>;raw<T=unknown[]>():Promise<T[]>;}
declare interface D1Database {prepare(query:string):D1PreparedStatement;batch<T=unknown>(statements:D1PreparedStatement[]):Promise<D1Result<T>[]>;exec(query:string):Promise<unknown>;}
declare interface Fetcher {fetch(request:Request):Promise<Response>;}
declare interface DurableObjectId {toString():string;equals(other:DurableObjectId):boolean;}
declare interface DurableObjectStub<T=unknown> {fetch(request:Request):Promise<Response>;[key:string]:unknown;}
declare interface DurableObjectNamespace<T=unknown>{newUniqueId(options?:unknown):DurableObjectId;idFromString(id:string):DurableObjectId;get(id:DurableObjectId):DurableObjectStub<T>&T;getByName?(name:string):DurableObjectStub<T>&T;}
declare interface DurableObjectSqlStorage {exec<T=Record<string,unknown>>(query:string,...bindings:unknown[]):{one():T;toArray():T[];};}
declare interface DurableObjectStorage {sql:DurableObjectSqlStorage;transactionSync<T>(closure:()=>T):T;setAlarm(scheduledTime:number|Date):Promise<void>;getAlarm():Promise<number|null>;deleteAlarm():Promise<void>;blockConcurrencyWhile?<T>(callback:()=>Promise<T>):Promise<T>;}
declare interface DurableObjectState {id:DurableObjectId;storage:DurableObjectStorage;blockConcurrencyWhile<T>(callback:()=>Promise<T>):Promise<T>;acceptWebSocket(ws:WebSocket,tags?:string[]):void;getWebSockets(tag?:string):WebSocket[];}
declare interface WebSocket {serializeAttachment(value:unknown):void;deserializeAttachment():unknown;accept?():void;}
declare class WebSocketPair {0:WebSocket;1:WebSocket;}
declare interface ExecutionContext {waitUntil(promise:Promise<unknown>):void;passThroughOnException():void;}
declare interface ResponseInit {webSocket?:WebSocket;}
declare module 'cloudflare:workers' { export class DurableObject<Env=unknown>{protected ctx:DurableObjectState;protected env:Env;constructor(ctx:DurableObjectState,env:Env);} }
declare module 'node:crypto' { export function randomBytes(size:number):{toString(format:string):string}; export function randomInt(min:number,max:number):number; export function randomUUID():string; export function timingSafeEqual(a:Uint8Array,b:Uint8Array):boolean; export function scrypt(password:string|Uint8Array,salt:string|Uint8Array,keylen:number,options:unknown,callback:(error:Error|null,derivedKey:Uint8Array)=>void):void; }
declare module 'node:util' { export function promisify(fn:Function):(...args:unknown[])=>Promise<unknown>; }
declare class Buffer extends Uint8Array { static from(value:string|Uint8Array):Buffer; toString(format?:string):string; }
declare module '@cloudflare/vitest-pool-workers/config' { export function defineWorkersConfig(value:unknown):unknown; }
declare const process:{cwd():string;platform:string};
declare module 'node:fs' { const fs:{readFileSync(path:string,encoding:string):string}; export default fs; }
declare module 'node:path' { const path:{join(...parts:string[]):string}; export default path; }
declare module '@cloudflare/vitest-pool-workers' { export function cloudflareTest(options:unknown):unknown; export function readD1Migrations(path:string):Promise<unknown[]>; }
declare module 'vitest/config' { export function defineConfig(config:unknown):unknown; }
