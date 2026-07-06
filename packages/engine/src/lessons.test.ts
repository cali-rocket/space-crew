import { describe, it, expect } from 'vitest';
import { LESSONS, parseCards } from './lessons.data';
import { createGameFromHands } from './state';
import { setupMatchFromHands } from './match';
import { advance } from './match';

const DEF = (taskCount: number) => ({ id: 1, sourceText: 'lesson', logbookPage: 0, taskCount });

describe('parseCards', () => {
  it('parses compact tokens', () => {
    expect(parseCards('g7 r4 y2')).toEqual([
      { suit: 'green', value: 7 }, { suit: 'rocket', value: 4 }, { suit: 'yellow', value: 2 },
    ]);
  });
});

describe('lesson data integrity', () => {
  for (const lesson of LESSONS) {
    it(`"${lesson.id}" is a legal 14/13/13 partition of the full deck`, () => {
      const sizes = ['me', 'bot-1', 'bot-2'].map((p) => lesson.hands[p]!.length).sort((a, b) => b - a);
      expect(sizes).toEqual([14, 13, 13]);
      // createGameFromHands throws on any dup / missing / wrong count.
      expect(() =>
        createGameFromHands({ players: ['me', 'bot-1', 'bot-2'], missionId: 1, hands: lesson.hands }),
      ).not.toThrow();
    });

    it(`"${lesson.id}" boots into trick play with its task pre-assigned`, () => {
      const m = setupMatchFromHands(DEF(lesson.tasks.length), ['me', 'bot-1', 'bot-2'], { me: false, 'bot-1': true, 'bot-2': true }, lesson.hands, lesson.tasks);
      expect(m.game.phase).toBe('trick-in-progress');
      expect(m.game.tasks.length).toBe(lesson.tasks.length);
      expect(m.game.tasks[0]!.owner).toBe(lesson.tasks[0]!.owner);
      // advancing must not throw (bots may move until it's my turn).
      expect(() => advance(m)).not.toThrow();
    });
  }
});
