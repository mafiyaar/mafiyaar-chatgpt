import type { MatchSettings, MatchState, PlayerState, PlayerView, PublicEvent, RoomState, Role, NightSubmission, VoteSubmission, Phase } from '../contracts/index.js';
import { PROTOCOL_VERSION, RULES_VERSION, ENGINE_VERSION, STATE_SCHEMA_VERSION, JOURNAL_VERSION, COPY_VERSION, CLIENT_MINIMUM_VERSION } from '../contracts/index.js';

export type RandomSource = (maxExclusive: number) => number;
const defaultRandom: RandomSource = max => Math.floor(Math.random() * max);

export function shuffle<T>(input: readonly T[], random: RandomSource = defaultRandom): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function livingPlayers(match: MatchState): PlayerState[] { return match.players.filter(p => p.alive); }
export function livingMafia(match: MatchState): PlayerState[] { return livingPlayers(match).filter(p => p.role === 'mafia'); }
export function livingCivilians(match: MatchState): PlayerState[] { return livingPlayers(match).filter(p => p.role === 'civilian'); }
export function playerById(match: MatchState, id: string | null | undefined): PlayerState | undefined { return match.players.find(p => p.id === id); }

function event(match: MatchState, type: string, payload: Record<string, unknown>, at = Date.now()): PublicEvent {
  const item: PublicEvent = { id: `${match.id}:${match.publicEvents.length + 1}`, type, round: match.round, at, payload };
  match.publicEvents.push(item);
  return item;
}

export function createMatch(params: {
  id: string; roomId: string; members: RoomState['members']; settings: MatchSettings;
  entropyId: string; now?: number; random?: RandomSource;
}): MatchState {
  const now = params.now ?? Date.now();
  const random = params.random ?? defaultRandom;
  if (params.members.length < 5) throw new Error('At least five players are required.');
  const memberOrder = shuffle(params.members, random);
  const mafiaAccounts = new Set(memberOrder.slice(0, params.settings.mafiaCount).map(m => m.accountId));
  const players: PlayerState[] = params.members.map((m, index) => ({
    id: m.playerId || `p${index + 1}`,
    accountId: m.accountId,
    displayName: m.displayName,
    avatar: m.avatar,
    role: mafiaAccounts.has(m.accountId) ? 'mafia' : 'civilian',
    alive: true,
    connected: m.connected,
    ready: true,
    roleAcknowledged: false,
    joinedAt: now
  }));
  const match: MatchState = {
    id: params.id, roomId: params.roomId, rulesVersion: RULES_VERSION, protocolVersion: PROTOCOL_VERSION, engineVersion: ENGINE_VERSION, stateSchemaVersion: STATE_SCHEMA_VERSION, journalVersion: JOURNAL_VERSION, copyVersion: COPY_VERSION, clientMinimumVersion: CLIENT_MINIMUM_VERSION,
    phase: 'role_reveal', phaseSequence: 1, phaseStartedAt: now,
    phaseEndsAt: params.settings.roleRevealMode === 'timed-accessible' ? now + 60_000 : null,
    round: 1, winner: null, settings: params.settings, players,
    nightSubmissions: {}, voteSubmissions: {}, runoffSubmissions: {}, gridOrders: {}, publicEvents: [],
    lastVictimId: null, lastEliminatedId: null, lastVoteLedger: [], tieCandidates: [], noEliminationReason: null,
    createdAt: now, completedAt: null, secretEntropyId: params.entropyId, predictionHistory: [], technicalPause: null
  };
  event(match, 'match_started', { playerCount: players.length, startModel: params.settings.startModel }, now);
  return match;
}

export function allRolesAcknowledged(match: MatchState): boolean {
  return match.players.every(p => p.roleAcknowledged || !p.connected);
}

export function acknowledgeRole(match: MatchState, playerId: string): void {
  const player = playerById(match, playerId);
  if (!player || match.phase !== 'role_reveal') throw new Error('Role cannot be acknowledged now.');
  player.roleAcknowledged = true;
}

export function startAfterRoleReveal(match: MatchState, now = Date.now()): void {
  if (match.settings.startModel === 'traditional') setPhase(match, 'night_transition', now);
  else setPhase(match, 'opening_discussion', now);
}

export function setPhase(match: MatchState, phase: Phase, now = Date.now()): void {
  match.phase = phase;
  match.phaseSequence += 1;
  match.phaseStartedAt = now;
  // Secret inputs are valid only inside the phase in which they were submitted.
  if (phase === 'night_action') match.nightSubmissions = {};
  if (phase === 'vote') match.voteSubmissions = {};
  if (phase === 'runoff_vote') match.runoffSubmissions = {};
  const t = match.settings.timers;
  const seconds: Partial<Record<Phase, number>> = {
    role_reveal: match.settings.roleRevealMode === 'timed-accessible' ? 60 : 0,
    opening_discussion: t.opening,
    night_transition: t.nightTransition,
    night_action: t.night,
    night_resolution: t.resolution,
    morning: t.morning,
    discussion: t.discussion,
    vote_transition: t.voteTransition,
    vote: t.vote,
    vote_resolution: t.resolution,
    runoff_discussion: t.runoffDiscussion,
    runoff_vote: t.runoffVote,
    elimination: t.elimination,
    victory: 0,
    summary: 0,
    technical_pause: 0,
    abandoned: 0,
    lobby: 0
  };
  const duration = seconds[phase] ?? 0;
  match.phaseEndsAt = duration > 0 ? now + Math.round(duration * 1000) : null;
  event(match, 'phase_started', { phase, endsAt: match.phaseEndsAt }, now);
}

export function ensureGridOrders(match: MatchState, random: RandomSource = defaultRandom): void {
  if (match.phase !== 'night_action' && match.phase !== 'vote' && match.phase !== 'runoff_vote') return;
  for (const viewer of match.players) {
    const candidates = match.phase === 'runoff_vote'
      ? match.tieCandidates.filter(id => id !== viewer.id)
      : livingPlayers(match).filter(p => !viewer.alive || p.id !== viewer.id).map(p => p.id);
    const key = `${match.phaseSequence}:${viewer.id}`;
    if (!match.gridOrders[key]) match.gridOrders[key] = shuffle(candidates, random);
  }
}

export function getGrid(match: MatchState, playerId: string): string[] {
  return [...(match.gridOrders[`${match.phaseSequence}:${playerId}`] ?? [])];
}

export function submitNightAction(match: MatchState, playerId: string, targetId: string | null, confirmed: boolean, sequence: number, now = Date.now()): NightSubmission {
  if (match.phase !== 'night_action') throw new Error('Night action is closed.');
  const player = playerById(match, playerId);
  if (!player) throw new Error('Player not found.');
  const target = targetId ? playerById(match, targetId) : undefined;
  if (targetId && (!target || !target.alive || (player.alive && targetId === playerId))) throw new Error('Target is not available.');
  const prior = match.nightSubmissions[playerId];
  if (prior && sequence <= prior.sequence) return prior;
  const kind: NightSubmission['kind'] = !player.alive ? 'spectator_prediction' : player.role === 'mafia' ? 'kill' : 'civilian_prediction';
  const submission: NightSubmission = { actorId: playerId, targetId, kind, confirmed, sequence, submittedAt: now };
  match.nightSubmissions[playerId] = submission;
  return submission;
}

export function resolveNight(match: MatchState, random: RandomSource = defaultRandom, now = Date.now()): { victimId: string | null; method: string } {
  const validTargets: string[] = [];
  let forceLoseKill = false;
  for (const mafia of livingMafia(match)) {
    const submission = match.nightSubmissions[mafia.id];
    if (!submission?.confirmed || !submission.targetId) continue;
    const target = playerById(match, submission.targetId);
    const isValid = Boolean(target?.alive && target.role !== 'mafia' && target.id !== mafia.id);
    if (isValid) {
      validTargets.push(submission.targetId);
      mafia.previousValidNightTarget = submission.targetId;
      continue;
    }
    switch (match.settings.teammateSelectionRule) {
      case 'previous-valid': if (mafia.previousValidNightTarget && playerById(match, mafia.previousValidNightTarget)?.alive) validTargets.push(mafia.previousValidNightTarget); break;
      case 'no-action': break;
      case 'lose-kill': forceLoseKill = true; break;
      case 'silent-waste': break;
    }
  }
  let victimId: string | null = null;
  let method = forceLoseKill ? 'invalid_teammate_selection_lost_kill' : 'no_valid_mafia_action';
  if (!forceLoseKill && validTargets.length) {
    const counts = new Map<string, number>();
    for (const id of validTargets) counts.set(id, (counts.get(id) ?? 0) + 1);
    const top = Math.max(...counts.values());
    const tied = [...counts.entries()].filter(([, count]) => count === top).map(([id]) => id);
    if (tied.length === 1) { victimId = tied[0]!; method = 'majority'; }
    else if (match.settings.multiMafiaRule === 'no-kill') method = 'mafia_tie_no_kill';
    else if (match.settings.multiMafiaRule === 'hidden-lead') {
      const mafia = livingMafia(match);
      const lead = mafia[(match.round - 1) % mafia.length];
      const leadTarget = lead ? match.nightSubmissions[lead.id]?.targetId : null;
      victimId = leadTarget && tied.includes(leadTarget) ? leadTarget : tied[0]!;
      method = 'hidden_lead';
    } else { victimId = tied[random(tied.length)]!; method = 'random_tied_target'; }
  }
  if (victimId) {
    const victim = playerById(match, victimId)!;
    victim.alive = false;
    victim.eliminated = { reason: 'night', round: match.round };
    match.lastVictimId = victimId;
    match.lastEliminatedId = victimId;
    event(match, 'night_kill', { victimId, method }, now);
  } else {
    match.lastVictimId = null;
    event(match, 'no_kill', { method }, now);
  }
  for (const submission of Object.values(match.nightSubmissions)) {
    if (submission.kind === 'kill' || !submission.confirmed) continue;
    match.predictionHistory.push({ actorId: submission.actorId, kind: 'night', round: match.round, targetId: submission.targetId, actualId: victimId, correct: submission.targetId === victimId });
  }
  return { victimId, method };
}

export function submitVote(match: MatchState, playerId: string, targetId: string | null, confirmed: boolean, runoff: boolean, sequence: number, now = Date.now()): VoteSubmission {
  const expected = runoff ? 'runoff_vote' : 'vote';
  if (match.phase !== expected) throw new Error('Voting is closed.');
  const player = playerById(match, playerId);
  if (!player) throw new Error('Player not found.');
  const target = targetId ? playerById(match, targetId) : undefined;
  const isSpectator = !player.alive;
  if (targetId && (!target || !target.alive || (!isSpectator && targetId === playerId))) throw new Error('Target is not available.');
  if (runoff && targetId && !match.tieCandidates.includes(targetId)) throw new Error('Runoff target is not eligible.');
  const store = runoff ? match.runoffSubmissions : match.voteSubmissions;
  const prior = store[playerId];
  if (prior && sequence <= prior.sequence) return prior;
  const submission: VoteSubmission = { actorId: playerId, targetId, kind: isSpectator ? 'spectator_prediction' : 'real', runoff, confirmed, sequence, submittedAt: now };
  store[playerId] = submission;
  return submission;
}

export function resolveVote(match: MatchState, runoff: boolean, now = Date.now()): { eliminatedId: string | null; tied: string[] } {
  const store = runoff ? match.runoffSubmissions : match.voteSubmissions;
  const living = livingPlayers(match);
  const ledger = living.map(voter => ({ voterId: voter.id, targetId: store[voter.id]?.confirmed ? store[voter.id]!.targetId : null }));
  const counts = new Map<string, number>();
  for (const row of ledger) if (row.targetId) counts.set(row.targetId, (counts.get(row.targetId) ?? 0) + 1);
  let eliminatedId: string | null = null;
  let tied: string[] = [];
  if (counts.size) {
    const top = Math.max(...counts.values());
    tied = [...counts.entries()].filter(([, count]) => count === top).map(([id]) => id);
    if (tied.length === 1) eliminatedId = tied[0]!;
  }
  match.lastVoteLedger = ledger;
  match.tieCandidates = tied;
  match.lastEliminatedId = eliminatedId;
  if (eliminatedId) {
    const eliminated = playerById(match, eliminatedId)!;
    eliminated.alive = false;
    eliminated.eliminated = { reason: 'vote', round: match.round };
    match.noEliminationReason = null;
    event(match, 'vote_elimination', { eliminatedId, runoff, ledger }, now);
  } else if (tied.length > 1) {
    match.noEliminationReason = runoff ? 'runoff_tie' : 'main_vote_tie';
    event(match, runoff ? 'runoff_tie' : 'vote_tie', { tied, ledger }, now);
  } else {
    match.noEliminationReason = 'no_votes';
    event(match, 'no_elimination', { reason: 'no_votes', runoff, ledger }, now);
  }
  for (const submission of Object.values(store)) {
    if (submission.kind !== 'spectator_prediction' || !submission.confirmed) continue;
    match.predictionHistory.push({ actorId: submission.actorId, kind: 'vote', round: match.round, targetId: submission.targetId, actualId: eliminatedId, correct: submission.targetId === eliminatedId });
  }
  return { eliminatedId, tied };
}

export function checkVictory(match: MatchState, now = Date.now()): Role | null {
  const mafia = livingMafia(match).length;
  const civilians = livingCivilians(match).length;
  const winner: Role | null = mafia === 0 ? 'civilian' : mafia >= civilians ? 'mafia' : null;
  if (winner && !match.winner) {
    match.winner = winner;
    match.completedAt = now;
    event(match, 'victory', { winner, mafiaAlive: mafia, civiliansAlive: civilians }, now);
  }
  return winner;
}

export function advanceExpiredPhase(match: MatchState, now = Date.now(), random: RandomSource = defaultRandom): Phase {
  switch (match.phase) {
    case 'role_reveal':
      startAfterRoleReveal(match, now); break;
    case 'opening_discussion':
      setPhase(match, match.settings.startModel === 'day' ? 'vote_transition' : 'night_transition', now); break;
    case 'night_transition':
      setPhase(match, 'night_action', now); ensureGridOrders(match, random); break;
    case 'night_action':
      resolveNight(match, random, now); setPhase(match, 'night_resolution', now); break;
    case 'night_resolution':
      if (checkVictory(match, now)) setPhase(match, 'victory', now); else setPhase(match, 'morning', now); break;
    case 'morning':
      setPhase(match, 'discussion', now); break;
    case 'discussion':
      setPhase(match, 'vote_transition', now); break;
    case 'vote_transition':
      setPhase(match, 'vote', now); ensureGridOrders(match, random); break;
    case 'vote': {
      const result = resolveVote(match, false, now);
      setPhase(match, 'vote_resolution', now);
      if (result.tied.length > 1) match.noEliminationReason = 'main_vote_tie';
      break;
    }
    case 'vote_resolution':
      if (match.tieCandidates.length > 1 && !match.lastEliminatedId) setPhase(match, 'runoff_discussion', now);
      else setPhase(match, 'elimination', now);
      break;
    case 'runoff_discussion':
      setPhase(match, 'runoff_vote', now); ensureGridOrders(match, random); break;
    case 'runoff_vote':
      resolveVote(match, true, now); setPhase(match, 'elimination', now); break;
    case 'elimination':
      if (checkVictory(match, now)) setPhase(match, 'victory', now);
      else { match.round += 1; match.lastEliminatedId = null; match.tieCandidates = []; match.noEliminationReason = null; setPhase(match, 'night_transition', now); }
      break;
    case 'victory': setPhase(match, 'summary', now); break;
    default: break;
  }
  return match.phase;
}


export function pauseMatch(match: MatchState, reason = 'Technical pause', now = Date.now()): void {
  if (match.phase === 'technical_pause') return;
  if (match.phase === 'summary' || match.phase === 'abandoned') throw new Error('This match cannot be paused.');
  const remainingMs = match.phaseEndsAt ? Math.max(0, match.phaseEndsAt - now) : 0;
  match.technicalPause = { previousPhase: match.phase, remainingMs, reason: reason.slice(0, 120), startedAt: now };
  match.phase = 'technical_pause';
  match.phaseSequence += 1;
  match.phaseStartedAt = now;
  match.phaseEndsAt = null;
  event(match, 'technical_pause_started', { reason: match.technicalPause.reason }, now);
}

export function resumeMatch(match: MatchState, now = Date.now()): void {
  const pause = match.technicalPause;
  if (match.phase !== 'technical_pause' || !pause) throw new Error('The match is not paused.');
  match.phase = pause.previousPhase;
  match.phaseSequence += 1;
  match.phaseStartedAt = now;
  match.phaseEndsAt = pause.remainingMs > 0 ? now + pause.remainingMs : null;
  match.technicalPause = null;
  event(match, 'technical_pause_ended', { resumedPhase: match.phase, endsAt: match.phaseEndsAt }, now);
}

export function abandonMatch(match: MatchState, reason = 'Match abandoned', now = Date.now()): void {
  if (match.phase === 'summary') throw new Error('A completed match cannot be abandoned.');
  match.phase = 'abandoned';
  match.phaseSequence += 1;
  match.phaseStartedAt = now;
  match.phaseEndsAt = null;
  match.technicalPause = null;
  match.completedAt = now;
  event(match, 'match_abandoned', { reason: reason.slice(0, 120) }, now);
}

export function predictionSummary(match: MatchState): Array<{ actorId: string; correct: number; total: number }> {
  const results = new Map<string, { correct: number; total: number }>();
  for (const player of match.players) results.set(player.id, { correct: 0, total: 0 });
  for (const item of match.predictionHistory) {
    const result = results.get(item.actorId) ?? { correct: 0, total: 0 };
    result.total += 1;
    if (item.correct) result.correct += 1;
    results.set(item.actorId, result);
  }
  return [...results.entries()].map(([actorId, value]) => ({ actorId, ...value }));
}

export function viewFor(room: RoomState, accountId: string): PlayerView {
  const member = room.members.find(m => m.accountId === accountId);
  if (!member) throw new Error('Not a room member.');
  const match = room.match;
  const revealPublicRole = (p: PlayerState): Role | undefined => {
    if (!p.alive && match?.settings.alignmentReveal === 'on') return p.role;
    if (match?.phase === 'summary' || match?.phase === 'victory') return p.role;
    return undefined;
  };
  const sourcePlayers: PlayerState[] = match?.players ?? room.members.map((m, i): PlayerState => ({
    id: m.playerId || `p${i + 1}`, accountId: m.accountId, displayName: m.displayName, avatar: m.avatar,
    role: 'civilian' as Role, alive: true, connected: m.connected, ready: m.ready, roleAcknowledged: false, joinedAt: room.createdAt
  }));
  const publicPlayers = sourcePlayers.map(p => ({
    id: p.id, displayName: p.displayName, avatar: p.avatar, alive: p.alive, connected: p.connected, ready: p.ready,
    ...(revealPublicRole(p) ? { revealedRole: revealPublicRole(p) } : {}), ...(p.eliminated ? { eliminated: p.eliminated } : {})
  }));
  const base: PlayerView = {
    roomId: room.id, roomCode: room.code, roomStatus: room.status, version: room.version,
    isCreator: room.creatorAccountId === accountId, settings: room.settings, members: publicPlayers, match: null
  };
  if (!match) return base;
  const self = match.players.find(p => p.accountId === accountId)!;
  const roleVisible = true; // Own role remains privately accessible for recovery; no other player's role is included.
  const actionPhase = match.phase === 'night_action' || match.phase === 'vote' || match.phase === 'runoff_vote';
  const night = match.nightSubmissions[self.id];
  const vote = match.phase === 'runoff_vote' ? match.runoffSubmissions[self.id] : match.voteSubmissions[self.id];
  const summary = match.phase === 'summary' ? {
    players: match.players.map(p => ({ id: p.id, displayName: p.displayName, role: p.role, alive: p.alive, ...(p.eliminated ? { eliminated: p.eliminated } : {}) })),
    events: match.publicEvents,
    predictions: predictionSummary(match)
  } : undefined;
  base.match = {
    id: match.id, phase: match.phase, phaseSequence: match.phaseSequence, phaseStartedAt: match.phaseStartedAt,
    phaseEndsAt: match.phaseEndsAt, round: match.round, winner: match.winner, publicEvents: match.publicEvents,
    lastVictimId: match.lastVictimId, lastEliminatedId: match.lastEliminatedId, lastVoteLedger: match.lastVoteLedger,
    tieCandidates: match.tieCandidates, noEliminationReason: match.noEliminationReason,
    self: {
      id: self.id, ...(roleVisible ? { role: self.role } : {}), alive: self.alive, acknowledged: self.roleAcknowledged,
      ...(roleVisible && self.role === 'mafia' ? { teammates: match.players.filter(p => p.role === 'mafia' && p.id !== self.id).map(p => p.id) } : {}),
      ...(actionPhase ? { grid: getGrid(match, self.id) } : {}),
      selectedTargetId: match.phase === 'night_action' ? night?.targetId : vote?.targetId,
      submissionConfirmed: match.phase === 'night_action' ? night?.confirmed : vote?.confirmed,
      canAct: actionPhase,
      ...(match.phase === 'night_action' ? { actionKind: !self.alive ? 'spectator_prediction' : self.role === 'mafia' ? 'kill' : 'civilian_prediction' } : actionPhase ? { actionKind: self.alive ? 'real' : 'spectator_prediction' } : {})
    },
    ...(summary ? { summary } : {})
  };
  return base;
}

export function assertNoHiddenState(view: PlayerView): void {
  const serialized = JSON.stringify(view);
  const forbidden = ['secretEntropyId', 'gridOrders', 'nightSubmissions', 'voteSubmissions', 'runoffSubmissions', 'predictionHistory', 'inviteToken'];
  for (const key of forbidden) if (serialized.includes(key)) throw new Error(`Hidden field leaked: ${key}`);
}
