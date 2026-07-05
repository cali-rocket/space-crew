import {
  GameState,
  PlayerId,
  Card,
  MissionDef,
  createMission,
  drawTaskCards,
  assignTask,
  assignByDistribution,
  applyOrderTokens,
  beginTricks,
  currentPlayer,
  applyPlay,
  communicate,
  toPlayerView,
  legalMovesFromView,
  BasicBot,
  CommToken,
  assignRole,
  setAppointedNoCommPlayer,
  derivePink9Holder,
  setDistress,
  submitDistressCard,
} from '@space-crew/engine';

export interface Match {
  game: GameState;
  isBot: Record<PlayerId, boolean>;
  taskPool: Card[];
  seed: number;
  step: number;
  taskCount: number;
  def: MissionDef;
  distressDone: boolean;
}

export type Decision =
  | { kind: 'role'; role: string; candidates: PlayerId[] }
  | { kind: 'all-tasks'; candidates: PlayerId[] }
  | { kind: 'distribute'; candidates: PlayerId[] }
  | { kind: 'appoint-no-comm'; candidates: PlayerId[] }
  | { kind: 'm50-roles'; roles: string[]; candidates: PlayerId[] };

function isOneMemberNoComm(game: GameState): boolean {
  const p = game.communicationPolicy;
  return typeof p === 'object' && 'oneMemberNoComm' in p;
}

/** Bind roles derivable without interaction (commander, pink-9 holder). */
function bindDerivableRoles(def: MissionDef, game: GameState): GameState {
  let g = game;
  const cons = def.constraints ?? [];
  if (cons.some((c) => 'role' in c && c.role === 'commander')) {
    g = assignRole(g, 'commander', g.commander);
  }
  if (cons.some((c) => c.kind === 'pink-left-sweep')) {
    g = assignRole(g, 'pink9holder', derivePink9Holder(g));
  }
  return g;
}

function unboundRole(match: Match): string | null {
  for (const c of match.def.constraints ?? []) {
    if ((c.kind === 'player-trick-count' || c.kind === 'player-exact-tricks') && c.role !== 'commander') {
      if (match.game.roles[c.role] === undefined) return c.role;
    }
  }
  return null;
}

function partitionRoles(match: Match): string[] | null {
  const c = (match.def.constraints ?? []).find((x) => x.kind === 'trick-partition');
  if (!c || c.kind !== 'trick-partition') return null;
  const roles = c.parts.map((p) => p.role);
  return roles.every((r) => match.game.roles[r] !== undefined) ? null : roles;
}

/** The commander decision still pending (role bind / one-takes-all / M50 roles), or null. */
export function pendingDecision(match: Match): Decision | null {
  if (match.game.phase !== 'task-assignment') return null;
  const nonCmd = match.game.players.filter((p) => p !== match.game.commander);
  const role = unboundRole(match);
  if (role !== null) return { kind: 'role', role, candidates: nonCmd };
  if (isOneMemberNoComm(match.game) && match.game.appointedNoCommPlayer === undefined) {
    // Commander appoints ANOTHER crew member who cannot communicate (M11).
    return { kind: 'appoint-no-comm', candidates: nonCmd };
  }
  const m50 = partitionRoles(match);
  if (m50 !== null) return { kind: 'm50-roles', roles: m50, candidates: [...match.game.players] };
  if (match.def.assignment === 'commander-decision' && match.taskPool.length > 0) {
    return { kind: 'all-tasks', candidates: nonCmd };
  }
  if (match.def.assignment === 'commander-distribution' && match.taskPool.length > 0) {
    // Commander hands out the individual orders among the whole crew (incl. self).
    return { kind: 'distribute', candidates: [...match.game.players] };
  }
  return null;
}

function distressPending(match: Match): boolean {
  return match.game.distressActive && !match.distressDone;
}

export function setupMatch(
  def: MissionDef,
  players: PlayerId[],
  isBot: Record<PlayerId, boolean>,
  seed: number,
  distress?: { active: boolean; direction: 'left' | 'right' },
): Match {
  let game = bindDerivableRoles(def, createMission(def, { players, seed }));
  if (distress?.active) game = setDistress(game, true, distress.direction);
  const taskPool = drawTaskCards(seed, def.taskCount);
  return { game, isBot, taskPool, seed, step: 0, taskCount: def.taskCount, def, distressDone: false };
}

export function advance(match: Match): Match {
  let m = { ...match };
  let lastKey = JSON.stringify([m.game, m.distressDone]);

  while (true) {
    const { game, isBot, taskPool } = m;
    if (game.outcome === 'won' || game.outcome === 'lost' || game.phase === 'mission-result') return m;

    if (game.phase === 'task-assignment') {
      // 1) Distress card pass (before any decision / pick).
      if (distressPending(m)) {
        const committed = game.distressCommits ?? {};
        const pending = game.players.filter((p) => !committed[p]);
        const next = pending[0];
        if (next === undefined) {
          m.distressDone = true;
        } else if (isBot[next]) {
          const hand = (game.hands[next] ?? []).filter((c) => c.suit !== 'rocket');
          if (hand.length === 0) {
            m.distressDone = true; // degenerate: only rockets, skip
          } else {
            const card = hand.reduce((lo, c) => (c.value < lo.value ? c : lo));
            m.game = submitDistressCard(game, next, card);
            if (Object.keys(m.game.distressCommits ?? {}).length === 0) m.distressDone = true;
            m.step++;
          }
        } else {
          return m; // human must submit
        }
      }
      // 2) Commander decision.
      else {
        const dec = pendingDecision(m);
        if (dec !== null) {
          if (!isBot[game.commander]) return m; // human commander decides
          if (dec.kind === 'role') {
            m.game = assignRole(game, dec.role, dec.candidates[0]!);
            m.step++;
          } else if (dec.kind === 'all-tasks') {
            let g = game;
            for (const card of taskPool) g = assignTask(g, dec.candidates[0]!, card);
            m.game = g;
            m.taskPool = [];
            m.step++;
          } else if (dec.kind === 'distribute') {
            // Even round-robin split across the crew (bot commander).
            const entries = taskPool.map((card, i) => ({ spec: { card }, owner: game.players[i % game.players.length]! }));
            m.game = assignByDistribution(game, entries);
            m.taskPool = [];
            m.step++;
          } else if (dec.kind === 'appoint-no-comm') {
            m.game = setAppointedNoCommPlayer(game, dec.candidates[0]!);
            m.step++;
          } else {
            let g = game;
            dec.roles.forEach((r, i) => {
              g = assignRole(g, r, game.players[i % game.players.length]!);
            });
            m.game = g;
            m.step++;
          }
        }
        // 3) Open-pick task assignment.
        else if (taskPool.length === 0) {
          const tokens = m.def.orderTokens;
          m.game = beginTricks(tokens && tokens.length ? applyOrderTokens(m.game, tokens) : m.game);
          m.step++;
        } else {
          const commanderIndex = game.players.indexOf(game.commander);
          const pickCount = m.taskCount - taskPool.length;
          const nextPicker = game.players[(commanderIndex + pickCount) % game.players.length]!;
          if (isBot[nextPicker]) {
            const card = BasicBot.chooseTask(toPlayerView(game, nextPicker, { isBot }), taskPool);
            m.game = assignTask(game, nextPicker, card);
            m.taskPool = taskPool.filter((c) => c.suit !== card.suit || c.value !== card.value);
            m.step++;
          } else {
            return m; // human picks
          }
        }
      }
    } else if (game.phase === 'trick-in-progress') {
      const player = currentPlayer(game);
      if (isBot[player]) {
        const view = toPlayerView(game, player, { isBot });
        const legal = view.legalMoves ?? legalMovesFromView(view);
        m.game = applyPlay(game, player, BasicBot.playCard(view, legal));
        m.step++;
      } else {
        return m; // human plays
      }
    }

    const newKey = JSON.stringify([m.game, m.distressDone]);
    if (newKey === lastKey) return m; // no progress
    lastKey = newKey;
  }
}

export function applyHumanAction(
  match: Match,
  player: PlayerId,
  action:
    | { type: 'pick-task'; card: Card }
    | { type: 'play-card'; card: Card }
    | { type: 'communicate'; card: Card; token: CommToken | null }
    | { type: 'commander-assign'; assignee: PlayerId }
    | { type: 'commander-assign-roles'; assignments: Record<string, PlayerId> }
    | { type: 'commander-distribute'; assignments: { card: Card; owner: PlayerId }[] }
    | { type: 'submit-distress'; card: Card },
): Match {
  let m = { ...match };

  if (action.type === 'pick-task') {
    m.game = assignTask(m.game, player, action.card);
    m.taskPool = m.taskPool.filter((c) => c.suit !== action.card.suit || c.value !== action.card.value);
  } else if (action.type === 'play-card') {
    m.game = applyPlay(m.game, player, action.card);
  } else if (action.type === 'communicate') {
    m.game = communicate(m.game, player, action.card, action.token);
  } else if (action.type === 'submit-distress') {
    if (m.distressDone) throw new Error('distress already completed');
    m.game = submitDistressCard(m.game, player, action.card);
    if (Object.keys(m.game.distressCommits ?? {}).length === 0) m.distressDone = true;
  } else if (action.type === 'commander-assign') {
    if (player !== m.game.commander) throw new Error('only the commander may decide');
    const dec = pendingDecision(m);
    if (dec === null || dec.kind === 'm50-roles' || dec.kind === 'distribute') throw new Error('no single-assignee decision pending');
    if (action.assignee === m.game.commander) throw new Error('commander cannot choose self');
    if (!m.game.players.includes(action.assignee)) throw new Error('unknown assignee');
    if (dec.kind === 'role') {
      m.game = assignRole(m.game, dec.role, action.assignee);
    } else if (dec.kind === 'appoint-no-comm') {
      m.game = setAppointedNoCommPlayer(m.game, action.assignee);
    } else {
      let g = m.game;
      for (const card of m.taskPool) g = assignTask(g, action.assignee, card);
      m.game = g;
      m.taskPool = [];
    }
  } else if (action.type === 'commander-assign-roles') {
    if (player !== m.game.commander) throw new Error('only the commander may decide');
    const dec = pendingDecision(m);
    if (dec === null || dec.kind !== 'm50-roles') throw new Error('no role-assignment decision pending');
    const chosen = dec.roles.map((r) => action.assignments[r]);
    if (chosen.some((a) => a === undefined || !m.game.players.includes(a))) throw new Error('invalid role assignment');
    if (new Set(chosen).size !== dec.roles.length) throw new Error('each role must be assigned to a distinct player');
    let g = m.game;
    dec.roles.forEach((r) => {
      g = assignRole(g, r, action.assignments[r]!);
    });
    m.game = g;
  } else if (action.type === 'commander-distribute') {
    if (player !== m.game.commander) throw new Error('only the commander may decide');
    const dec = pendingDecision(m);
    if (dec === null || dec.kind !== 'distribute') throw new Error('no distribution decision pending');
    if (action.assignments.length !== m.taskPool.length) throw new Error('every order must be distributed');
    for (const a of action.assignments) {
      if (!m.taskPool.some((c) => c.suit === a.card.suit && c.value === a.card.value)) throw new Error('card not in the task pool');
      if (!m.game.players.includes(a.owner)) throw new Error('unknown owner');
    }
    m.game = assignByDistribution(m.game, action.assignments.map((a) => ({ spec: { card: a.card }, owner: a.owner })));
    m.taskPool = [];
  }

  m.step++;
  return advance(m);
}

export function viewFor(match: Match, player: PlayerId) {
  let v = toPlayerView(match.game, player, { isBot: match.isBot });
  if (match.game.phase === 'task-assignment') {
    v = { ...v, taskPool: [...match.taskPool] };
    if (distressPending(match)) {
      const committed = match.game.distressCommits ?? {};
      if (!committed[player]) v = { ...v, distressPass: { mustSubmit: true } };
    } else {
      const dec = pendingDecision(match);
      if (dec !== null && player === match.game.commander) v = { ...v, decision: dec };
    }
  }
  return v;
}
