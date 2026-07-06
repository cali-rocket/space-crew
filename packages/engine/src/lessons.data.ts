import { Card, Suit } from './cards';

export interface LessonDef {
  id: string;
  concept: string;
  title: string;
  goal: string;
  /** Explicit hands keyed 'me' | 'bot-1' | 'bot-2' (a lesson position cannot come from a seed). */
  hands: Record<string, Card[]>;
  tasks: { card: Card; owner: string }[];
}

const SUITS: Record<string, Suit> = { p: 'pink', b: 'blue', g: 'green', y: 'yellow', r: 'rocket' };

/** Parse a compact hand string like "g7 g8 y2 r4" into Cards. */
export function parseCards(s: string): Card[] {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const suit = SUITS[tok[0]!];
      const value = Number(tok.slice(1));
      if (!suit || !Number.isInteger(value)) throw new Error(`bad card token: ${tok}`);
      return { suit, value };
    });
}

const C = (suit: Suit, value: number): Card => ({ suit, value });

export const LESSONS: LessonDef[] = [
  {
    id: 'win-low-card',
    concept: 'low-task',
    title: '낮은 카드 따기',
    goal: '네 태스크 노랑2를 직접 따세요. 위 노랑을 먼저 소진하고, 로켓이 밖에 있는 동안엔 노랑2를 리드하지 마세요.',
    hands: {
      me: parseCards('y2 y5 y6 y7 y8 y9 r4 r3 p9 p8 b9 b8 g9 g8'),
      'bot-1': parseCards('y1 y3 r1 p1 p2 p3 p4 b1 b2 b3 g1 g2 g3'),
      'bot-2': parseCards('y4 r2 p5 p6 p7 b4 b5 b6 b7 g4 g5 g6 g7'),
    },
    tasks: [{ card: C('yellow', 2), owner: 'me' }],
  },
  {
    id: 'master-recognition',
    concept: 'master',
    title: '마스터 인식',
    goal: '분홍9를 따세요. 로켓이 밖에 있는 동안엔 트럼프 위험이 있어요 — 로켓이 빠지면 분홍 상위가 마스터가 됩니다.',
    hands: {
      me: parseCards('p9 p8 p7 p6 p5 g9 g8 g7 b9 b8 y9 y8 r4 r1'),
      'bot-1': parseCards('p1 p2 g1 g2 g3 g4 b1 b2 b3 y1 y2 y3 r2'),
      'bot-2': parseCards('p3 p4 g5 g6 b4 b5 b6 b7 y4 y5 y6 y7 r3'),
    },
    tasks: [{ card: C('pink', 9), owner: 'me' }],
  },
  {
    id: 'void-deduction',
    concept: 'void',
    title: '보이드 추론',
    goal: '초록9를 따세요. 초록을 리드해 보면 bot-2가 초록에 보이드임이 드러나요 — 리빌로 네 추론을 대조하세요.',
    hands: {
      me: parseCards('g9 g8 g7 g6 p9 p8 p7 b9 b8 b7 y9 y8 y7 r4'),
      'bot-1': parseCards('g1 g2 g3 g4 g5 p1 p2 b1 b2 y1 y2 r1 r2'),
      'bot-2': parseCards('p3 p4 p5 p6 b3 b4 b5 b6 y3 y4 y5 y6 r3'),
    },
    tasks: [{ card: C('green', 9), owner: 'me' }],
  },
];
