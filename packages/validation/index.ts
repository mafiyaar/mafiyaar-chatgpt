import type { MatchSettings, Locale, ClientCommand } from '../contracts/index.js';

export class ValidationError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('INVALID_BODY', 'A JSON object is required.');
  return value as Record<string, unknown>;
}
export function stringField(obj: Record<string, unknown>, key: string, min = 1, max = 100): string {
  const value = typeof obj[key] === 'string' ? obj[key].trim() : '';
  if (value.length < min || value.length > max) throw new ValidationError('INVALID_FIELD', `${key} must be ${min}-${max} characters.`);
  return value;
}
export function normalizeUsername(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  if (!/^[a-z0-9_]{3,24}$/.test(normalized)) throw new ValidationError('INVALID_USERNAME', 'Username must use 3-24 lowercase letters, numbers or underscores.');
  const reserved = new Set(['admin','root','system','support','mafiyaar','mafia','moderator','api']);
  if (reserved.has(normalized)) throw new ValidationError('RESERVED_USERNAME', 'That username is reserved.');
  return normalized;
}
export function validatePin(value: string): string {
  if (!/^\d{6}$/.test(value)) throw new ValidationError('INVALID_PIN', 'PIN must contain exactly 6 digits.');
  if (/^(\d)\1+$/.test(value) || ['123456','000000','111111','654321'].includes(value)) throw new ValidationError('WEAK_PIN', 'Choose a less predictable PIN.');
  return value;
}
export function sanitizeDisplayName(value: string): string {
  const clean = value.replace(/[<>\u0000-\u001F]/g, '').trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 30) throw new ValidationError('INVALID_DISPLAY_NAME', 'Display name must be 2-30 characters.');
  return clean;
}
export function validateRoomCode(value: string): string {
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-HJ-NP-Z2-9]{5}$/.test(code)) throw new ValidationError('INVALID_ROOM_CODE', 'Room code must be five unambiguous characters.');
  return code;
}
export function validateLocale(value: unknown): Locale { return value === 'en' ? 'en' : 'ur-Roman'; }
export function validateSettings(input: Partial<MatchSettings>, testMode = false): MatchSettings {
  const requestedPreset = input.preset && ['fast','standard','relaxed','test'].includes(input.preset) ? input.preset : 'standard';
  const preset = requestedPreset === 'test' && !testMode ? 'standard' : requestedPreset;
  const presets = {
    fast: { opening: 0, nightTransition: 4, night: 30, resolution: 3, morning: 8, discussion: 90, voteTransition: 4, vote: 20, runoffDiscussion: 20, runoffVote: 15, elimination: 7 },
    standard: { opening: 60, nightTransition: 8, night: 40, resolution: 4, morning: 12, discussion: 120, voteTransition: 8, vote: 30, runoffDiscussion: 30, runoffVote: 20, elimination: 10 },
    relaxed: { opening: 90, nightTransition: 8, night: 45, resolution: 5, morning: 15, discussion: 180, voteTransition: 8, vote: 40, runoffDiscussion: 45, runoffVote: 25, elimination: 12 },
    test: { opening: 0.08, nightTransition: 0.05, night: 0.12, resolution: 0.04, morning: 0.08, discussion: 0.12, voteTransition: 0.05, vote: 0.12, runoffDiscussion: 0.08, runoffVote: 0.1, elimination: 0.08 }
  } as const;
  const playerLimit = Math.max(5, Math.min(20, Number(input.playerLimit ?? 8)));
  const recommended = playerLimit <= 8 ? 1 : playerLimit <= 13 ? 2 : 3;
  const mafiaCount = Math.max(1, Math.min(Math.floor((playerLimit - 1) / 2), Number(input.mafiaCount ?? recommended)));
  if (mafiaCount >= playerLimit - mafiaCount) throw new ValidationError('INVALID_BALANCE', 'The game cannot begin at Mafia parity.');
  return {
    playerLimit, mafiaCount,
    startModel: ['traditional','day','opening'].includes(String(input.startModel)) ? input.startModel! : 'opening',
    alignmentReveal: input.alignmentReveal === 'off' ? 'off' : 'on',
    multiMafiaRule: ['random-tied','hidden-lead','no-kill'].includes(String(input.multiMafiaRule)) ? input.multiMafiaRule! : 'random-tied',
    teammateSelectionRule: ['silent-waste','previous-valid','no-action','lose-kill'].includes(String(input.teammateSelectionRule)) ? input.teammateSelectionRule! : 'silent-waste',
    confirmationMode: input.confirmationMode === 'accessible-tap' ? 'accessible-tap' : 'hold',
    locale: validateLocale(input.locale), preset,
    timers: { ...presets[preset], ...(testMode && input.timers ? input.timers : {}) },
    roleRevealMode: input.roleRevealMode === 'timed-accessible' ? 'timed-accessible' : 'all-ack'
  };
}


function integerField(obj: Record<string, unknown>, key: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const value = obj[key];
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) throw new ValidationError('COMMAND_INVALID', `${key} is invalid.`);
  return Number(value);
}

function booleanField(obj: Record<string, unknown>, key: string): boolean {
  if (typeof obj[key] !== 'boolean') throw new ValidationError('COMMAND_INVALID', `${key} is invalid.`);
  return obj[key] as boolean;
}
function optionalPhaseSequence(obj: Record<string, unknown>): number | undefined {
  return obj.phaseSequence === undefined ? undefined : integerField(obj, 'phaseSequence', 0, 1_000_000_000);
}
function targetField(obj: Record<string, unknown>): string | null {
  if (obj.targetId === null) return null;
  if (typeof obj.targetId !== 'string' || !/^[A-Za-z0-9:_-]{1,80}$/.test(obj.targetId)) throw new ValidationError('COMMAND_INVALID', 'targetId is invalid.');
  return obj.targetId;
}
/** Strict runtime validation for every browser WebSocket command. */
export function parseClientCommand(value: unknown): ClientCommand {
  const obj = asObject(value);
  const type = typeof obj.type === 'string' ? obj.type : '';
  const roomId = type === 'pong' ? '' : validateRoomCode(String(obj.roomId ?? ''));
  const commandId = obj.commandId === undefined ? undefined : String(obj.commandId);
  if (type !== 'subscribe' && type !== 'pong' && (!commandId || !/^[A-Za-z0-9_-]{16,160}$/.test(commandId))) throw new ValidationError('COMMAND_INVALID', 'commandId is required.');
  const base = { ...(commandId ? { commandId } : {}), ...(optionalPhaseSequence(obj) === undefined ? {} : { phaseSequence: optionalPhaseSequence(obj) }) };
  switch (type) {
    case 'subscribe': return { type, roomId, lastVersion: obj.lastVersion === undefined ? undefined : integerField(obj, 'lastVersion'), ...base };
    case 'ready': return { type, roomId, ready: booleanField(obj, 'ready'), sequence: integerField(obj, 'sequence'), ...base };
    case 'start': return { type, roomId, sequence: integerField(obj, 'sequence'), ...base };
    case 'ack_role': return { type, roomId, sequence: integerField(obj, 'sequence'), ...base };
    case 'night_action': return { type, roomId, targetId: targetField(obj), confirmed: booleanField(obj, 'confirmed'), sequence: integerField(obj, 'sequence'), phaseSequence: integerField(obj, 'phaseSequence'), ...(commandId ? { commandId } : {}) };
    case 'vote': return { type, roomId, targetId: targetField(obj), confirmed: booleanField(obj, 'confirmed'), runoff: booleanField(obj, 'runoff'), sequence: integerField(obj, 'sequence'), phaseSequence: integerField(obj, 'phaseSequence'), ...(commandId ? { commandId } : {}) };
    case 'rematch': return { type, roomId, sameSettings: booleanField(obj, 'sameSettings'), sequence: integerField(obj, 'sequence'), ...base };
    case 'update_settings': return { type, roomId, settings: asObject(obj.settings), sequence: integerField(obj, 'sequence'), ...base } as ClientCommand;
    case 'leave': return { type, roomId, sequence: integerField(obj, 'sequence'), ...base };
    case 'pause': return { type, roomId, reason: sanitizeDisplayName(String(obj.reason ?? 'Technical pause')).slice(0,120), sequence: integerField(obj, 'sequence'), ...base };
    case 'resume': return { type, roomId, sequence: integerField(obj, 'sequence'), ...base };
    case 'abandon': return { type, roomId, reason: sanitizeDisplayName(String(obj.reason ?? 'Match abandoned')).slice(0,120), sequence: integerField(obj, 'sequence'), ...base };
    case 'pong': return { type, at: integerField(obj, 'at', 0), ...(commandId ? { commandId } : {}) };
    default: throw new ValidationError('COMMAND_INVALID', 'Unsupported command.');
  }
}
