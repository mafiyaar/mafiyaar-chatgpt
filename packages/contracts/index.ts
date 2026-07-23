export const PROTOCOL_VERSION = 'cf-1.0.0';
export const RULES_VERSION = 'rules-1.0.0';
export const ENGINE_VERSION = 'engine-1.0.0';
export const STATE_SCHEMA_VERSION = 'state-1.0.0';
export const JOURNAL_VERSION = 'journal-1.0.0';
export const COPY_VERSION = 'copy-1.0.0';
export const CLIENT_MINIMUM_VERSION = '1.0.0';
export type Locale = 'ur-Roman' | 'en';
export type Role = 'mafia' | 'civilian';
export type StartModel = 'traditional' | 'day' | 'opening';
export type AlignmentReveal = 'on' | 'off';
export type MultiMafiaRule = 'random-tied' | 'hidden-lead' | 'no-kill';
export type TeammateSelectionRule = 'silent-waste' | 'previous-valid' | 'no-action' | 'lose-kill';
export type ConfirmationMode = 'hold' | 'accessible-tap';
export type Phase =
  | 'lobby' | 'role_reveal' | 'opening_discussion' | 'night_transition'
  | 'night_action' | 'night_resolution' | 'morning' | 'discussion'
  | 'vote_transition' | 'vote' | 'vote_resolution' | 'runoff_discussion'
  | 'runoff_vote' | 'elimination' | 'victory' | 'summary' | 'technical_pause' | 'abandoned';

export interface TimerPreset {
  opening: number;
  nightTransition: number;
  night: number;
  resolution: number;
  morning: number;
  discussion: number;
  voteTransition: number;
  vote: number;
  runoffDiscussion: number;
  runoffVote: number;
  elimination: number;
}

export interface MatchSettings {
  playerLimit: number;
  mafiaCount: number;
  startModel: StartModel;
  alignmentReveal: AlignmentReveal;
  multiMafiaRule: MultiMafiaRule;
  teammateSelectionRule: TeammateSelectionRule;
  confirmationMode: ConfirmationMode;
  locale: Locale;
  preset: 'fast' | 'standard' | 'relaxed' | 'test';
  timers: TimerPreset;
  roleRevealMode: 'all-ack' | 'timed-accessible';
}

export interface PlayerState {
  id: string;
  accountId: string;
  displayName: string;
  avatar: string;
  role: Role;
  alive: boolean;
  connected: boolean;
  ready: boolean;
  roleAcknowledged: boolean;
  joinedAt: number;
  eliminated?: { reason: 'night' | 'vote' | 'removed'; round: number };
  previousValidNightTarget?: string;
}

export interface NightSubmission {
  actorId: string;
  targetId: string | null;
  kind: 'kill' | 'civilian_prediction' | 'spectator_prediction';
  confirmed: boolean;
  sequence: number;
  submittedAt: number;
}

export interface VoteSubmission {
  actorId: string;
  targetId: string | null;
  kind: 'real' | 'spectator_prediction';
  runoff: boolean;
  confirmed: boolean;
  sequence: number;
  submittedAt: number;
}

export interface PublicEvent {
  id: string;
  type: string;
  round: number;
  at: number;
  payload: Record<string, unknown>;
}

export interface MatchState {
  id: string;
  roomId: string;
  rulesVersion: string;
  protocolVersion: string;
  engineVersion: string;
  stateSchemaVersion: string;
  journalVersion: string;
  copyVersion: string;
  clientMinimumVersion: string;
  phase: Phase;
  phaseSequence: number;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  round: number;
  winner: Role | null;
  settings: MatchSettings;
  players: PlayerState[];
  nightSubmissions: Record<string, NightSubmission>;
  voteSubmissions: Record<string, VoteSubmission>;
  runoffSubmissions: Record<string, VoteSubmission>;
  gridOrders: Record<string, string[]>;
  publicEvents: PublicEvent[];
  lastVictimId: string | null;
  lastEliminatedId: string | null;
  lastVoteLedger: Array<{ voterId: string; targetId: string | null }>;
  tieCandidates: string[];
  noEliminationReason: string | null;
  createdAt: number;
  completedAt: number | null;
  secretEntropyId: string;
  predictionHistory: Array<{ actorId: string; kind: 'night' | 'vote'; round: number; targetId: string | null; actualId: string | null; correct: boolean }>;
  technicalPause: null | { previousPhase: Phase; remainingMs: number; reason: string; startedAt: number };
}

export interface RoomState {
  id: string;
  code: string;
  inviteToken: string;
  creatorAccountId: string;
  status: 'lobby' | 'active' | 'complete' | 'expired' | 'abandoned';
  settings: MatchSettings;
  members: Array<{ accountId: string; playerId: string; displayName: string; avatar: string; ready: boolean; connected: boolean }>;
  match: MatchState | null;
  createdAt: number;
  expiresAt: number;
  version: number;
}

export interface PublicPlayerView {
  id: string;
  displayName: string;
  avatar: string;
  alive: boolean;
  connected: boolean;
  ready: boolean;
  revealedRole?: Role;
  eliminated?: PlayerState['eliminated'];
}

export interface PlayerView {
  roomId: string;
  roomCode: string;
  roomStatus: RoomState['status'];
  version: number;
  isCreator: boolean;
  settings: Omit<MatchSettings, 'timers'> & { timers: TimerPreset };
  members: PublicPlayerView[];
  match: null | {
    id: string;
    phase: Phase;
    phaseSequence: number;
    phaseStartedAt: number;
    phaseEndsAt: number | null;
    round: number;
    winner: Role | null;
    publicEvents: PublicEvent[];
    lastVictimId: string | null;
    lastEliminatedId: string | null;
    lastVoteLedger: Array<{ voterId: string; targetId: string | null }>;
    tieCandidates: string[];
    noEliminationReason: string | null;
    self: {
      id: string;
      role?: Role;
      alive: boolean;
      acknowledged: boolean;
      teammates?: string[];
      grid?: string[];
      selectedTargetId?: string | null;
      submissionConfirmed?: boolean;
      canAct: boolean;
      actionKind?: NightSubmission['kind'] | VoteSubmission['kind'];
    };
    summary?: {
      players: Array<{ id: string; displayName: string; role: Role; alive: boolean; eliminated?: PlayerState['eliminated'] }>;
      events: PublicEvent[];
      predictions: Array<{ actorId: string; correct: number; total: number }>;
    };
  };
}

export interface CommandEnvelope { commandId?: string; phaseSequence?: number; }
export type ClientCommand =
  | { type: 'subscribe'; roomId: string; lastVersion?: number } & CommandEnvelope
  | { type: 'ready'; roomId: string; ready: boolean; sequence: number } & CommandEnvelope
  | { type: 'start'; roomId: string; sequence: number } & CommandEnvelope
  | { type: 'ack_role'; roomId: string; sequence: number } & CommandEnvelope
  | { type: 'night_action'; roomId: string; targetId: string | null; confirmed: boolean; sequence: number } & CommandEnvelope
  | { type: 'vote'; roomId: string; targetId: string | null; confirmed: boolean; runoff: boolean; sequence: number } & CommandEnvelope
  | { type: 'rematch'; roomId: string; sameSettings: boolean; sequence: number } & CommandEnvelope
  | { type: 'update_settings'; roomId: string; settings: Partial<MatchSettings>; sequence: number } & CommandEnvelope
  | { type: 'leave'; roomId: string; sequence: number } & CommandEnvelope
  | { type: 'pause'; roomId: string; reason: string; sequence: number } & CommandEnvelope
  | { type: 'resume'; roomId: string; sequence: number } & CommandEnvelope
  | { type: 'abandon'; roomId: string; reason: string; sequence: number } & CommandEnvelope
  | ({ type: 'pong'; at: number } & CommandEnvelope);

export type ServerEvent =
  | { type: 'snapshot'; view: PlayerView; serverTime: number } & CommandEnvelope
  | { type: 'room_update'; view: PlayerView; serverTime: number } & CommandEnvelope
  | { type: 'command_accepted'; sequence: number; serverTime: number } & CommandEnvelope
  | { type: 'error'; code: string; message: string; recoverable: boolean; sequence?: number } & CommandEnvelope
  | { type: 'ping'; at: number } & CommandEnvelope
  | { type: 'session_replaced'; message: string };

export interface SessionUser {
  accountId: string;
  username: string;
  displayName: string;
  avatar: string;
  locale: Locale;
}
