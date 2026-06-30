import {
  GameState,
  PlayerId,
  Card,
  MissionDef,
  createMission,
  drawTaskCards,
  assignTask,
  beginTricks,
  currentPlayer,
  applyPlay,
  communicate,
  toPlayerView,
  legalMovesFromView,
  BasicBot,
  CommToken,
  assignRole,
  derivePink9Holder,
} from '@space-crew/engine';

/** Bind roles that are derivable without player interaction (commander, pink-9 holder). */
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

export interface Match {
  game: GameState;
  isBot: Record<PlayerId, boolean>;
  taskPool: Card[];
  seed: number;
  step: number;
  taskCount: number;
  def: MissionDef;
}

/** The unbound player-target role (e.g. 'sick'/'chosen') the commander must decide, or null. */
function pendingRoleDecision(match: Match): string | null {
  for (const c of match.def.constraints ?? []) {
    if ((c.kind === 'player-trick-count' || c.kind === 'player-exact-tricks') && c.role !== 'commander') {
      if (match.game.roles[c.role] === undefined) return c.role;
    }
  }
  return null;
}

export function setupMatch(def: MissionDef, players: PlayerId[], isBot: Record<PlayerId, boolean>, seed: number): Match {
  const game = bindDerivableRoles(def, createMission(def, { players, seed }));
  const taskPool = drawTaskCards(seed, def.taskCount);
  return { game, isBot, taskPool, seed, step: 0, taskCount: def.taskCount, def };
}

export function advance(match: Match): Match {
  let m = { ...match };
  let lastStateStr = JSON.stringify(m.game);

  while (true) {
    const { game, isBot, taskPool } = m;

    // Check if mission has ended
    if (game.outcome === 'won' || game.outcome === 'lost') {
      return m;
    }

    if (game.phase === 'mission-result') {
      return m;
    }

    // Task assignment phase
    if (game.phase === 'task-assignment') {
      // Commander-decision: bind an unbound player-target role before tasks/tricks.
      const role = pendingRoleDecision(m);
      if (role !== null) {
        if (isBot[game.commander]) {
          const candidate = game.players.find((p) => p !== game.commander)!;
          m.game = assignRole(game, role, candidate);
          m.step++;
        } else {
          return m; // human commander must decide
        }
      } else if (taskPool.length === 0) {
        // Pool is empty, move to tricks
        m.game = beginTricks(m.game);
        m.step++;
      } else {
        // Find next picker in round-robin order from commander
        const commanderIndex = game.players.indexOf(game.commander);
        const pickCount = m.taskCount - taskPool.length;
        const nextPickerIndex = (commanderIndex + pickCount) % game.players.length;
        const nextPicker = game.players[nextPickerIndex]!;

        if (isBot[nextPicker]) {
          // Bot picks
          const card = BasicBot.chooseTask(
            toPlayerView(game, nextPicker, { isBot }),
            taskPool,
          );
          m.game = assignTask(game, nextPicker, card);
          m.taskPool = taskPool.filter((c) => c.suit !== card.suit || c.value !== card.value);
          m.step++;
        } else {
          // Human turn, stop
          return m;
        }
      }
    } else if (game.phase === 'trick-in-progress') {
      const player = currentPlayer(game);
      if (isBot[player]) {
        // Bot plays
        const view = toPlayerView(game, player, { isBot });
        const legal = view.legalMoves ?? legalMovesFromView(view);
        const card = BasicBot.playCard(view, legal);
        m.game = applyPlay(game, player, card);
        m.step++;
      } else {
        // Human turn, stop
        return m;
      }
    }

    // Check for infinite loop (state unchanged)
    const newStateStr = JSON.stringify(m.game);
    if (newStateStr === lastStateStr) {
      return m;
    }
    lastStateStr = newStateStr;
  }
}

export function applyHumanAction(
  match: Match,
  player: PlayerId,
  action:
    | { type: 'pick-task'; card: Card }
    | { type: 'play-card'; card: Card }
    | { type: 'communicate'; card: Card; token: CommToken | null }
    | { type: 'commander-assign'; assignee: PlayerId },
): Match {
  let m = { ...match };

  if (action.type === 'pick-task') {
    m.game = assignTask(m.game, player, action.card);
    m.taskPool = m.taskPool.filter((c) => c.suit !== action.card.suit || c.value !== action.card.value);
  } else if (action.type === 'play-card') {
    m.game = applyPlay(m.game, player, action.card);
  } else if (action.type === 'communicate') {
    m.game = communicate(m.game, player, action.card, action.token);
  } else if (action.type === 'commander-assign') {
    if (player !== m.game.commander) throw new Error('only the commander may decide');
    const role = pendingRoleDecision(m);
    if (role === null) throw new Error('no pending commander decision');
    if (action.assignee === m.game.commander) throw new Error('commander cannot choose self');
    if (!m.game.players.includes(action.assignee)) throw new Error('unknown assignee');
    m.game = assignRole(m.game, role, action.assignee);
  }

  m.step++;
  return advance(m);
}

export function viewFor(match: Match, player: PlayerId) {
  let v = toPlayerView(match.game, player, { isBot: match.isBot });
  if (match.game.phase === 'task-assignment') {
    v = { ...v, taskPool: [...match.taskPool] };
    const role = pendingRoleDecision(match);
    if (role !== null && player === match.game.commander) {
      v = { ...v, decision: { role, candidates: match.game.players.filter((p) => p !== match.game.commander) } };
    }
  }
  return v;
}
