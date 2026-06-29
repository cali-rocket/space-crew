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
} from '@space-crew/engine';

export interface Match {
  game: GameState;
  isBot: Record<PlayerId, boolean>;
  taskPool: Card[];
  seed: number;
  step: number;
  taskCount: number;
}

export function setupMatch(def: MissionDef, players: PlayerId[], isBot: Record<PlayerId, boolean>, seed: number): Match {
  const game = createMission(def, { players, seed });
  const taskPool = drawTaskCards(seed, def.taskCount);
  return { game, isBot, taskPool, seed, step: 0, taskCount: def.taskCount };
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
      if (taskPool.length === 0) {
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
    | { type: 'communicate'; card: Card; token: CommToken | null },
): Match {
  let m = { ...match };

  if (action.type === 'pick-task') {
    m.game = assignTask(m.game, player, action.card);
    m.taskPool = m.taskPool.filter((c) => c.suit !== action.card.suit || c.value !== action.card.value);
  } else if (action.type === 'play-card') {
    m.game = applyPlay(m.game, player, action.card);
  } else if (action.type === 'communicate') {
    m.game = communicate(m.game, player, action.card, action.token);
  }

  m.step++;
  return advance(m);
}

export function viewFor(match: Match, player: PlayerId) {
  return toPlayerView(match.game, player, { isBot: match.isBot });
}
