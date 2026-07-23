import type { ClientCommand, PlayerView, RoomState, SessionUser } from '../contracts/index.js';

export interface Clock { now(): number; }
export interface IdGenerator { opaque(bytes?: number): string; uuid(): string; integer(maxExclusive: number): number; }
export interface RoomTransport { send(accountId: string, payload: unknown): void; broadcast(factory: (accountId: string) => unknown): void; }
export interface RoomPersistence<TEnvelope> { load(): TEnvelope | null; commit(input: { envelope: TEnvelope; eventType: string; actorId: string | null; commandId: string | null; phaseSequence: number | null; visibility: string; payload: unknown }): number; }
export interface GlobalRepository {
  createRoomDirectory(input: { codeHmac: string; keyVersion: string; durableObjectId: string; creatorAccountId: string; inviteDigest: string; createdAt: number; expiresAt: number }): Promise<void>;
  resolveRoom(codeHmac: string, now: number): Promise<{ durableObjectId: string; creatorAccountId: string; status: string; inviteDigest: string; expiresAt: number } | null>;
}
export interface SessionRepository { getSession(rawToken: string, now: number): Promise<SessionUser | null>; }
export interface DeadlineScheduler { set(at: number): Promise<void>; clear(): Promise<void>; }
export interface ArchiveWriter { archive(room: RoomState): Promise<void>; }
export interface AbuseProtectionProvider { consume(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number }>; }
export interface CryptoProvider {
  hashPin(pin: string, salt?: string): Promise<{ hash: string; salt: string; version: string; parameters: string }>;
  verifyPin(pin: string, salt: string, expected: string, parameters: string): Promise<boolean>;
  hmac(value: string, secret: string): Promise<string>;
  digest(value: string): Promise<string>;
}
export interface RoomEngineAdapter { command(room: RoomState, user: SessionUser, command: ClientCommand): PlayerView; }
