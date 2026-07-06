import { useState } from 'react';
import { gradeQuiz } from '@space-crew/engine';
import type { Quiz } from '@space-crew/engine';

export interface QuizPanelProps {
  quizzes: Quiz[];
  onGraded(concept: string, correct: boolean): void;
  onSubmitted?(): void;
  onReset?(): void;
}

/** L2 "test" stage: recall the count instead of reading it, then get graded. */
export function QuizPanel({ quizzes, onGraded, onSubmitted, onReset }: QuizPanelProps) {
  // answers keyed by quiz id; multiselect = string[], count = [value]
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [graded, setGraded] = useState<Record<string, { correct: boolean; correctAnswer: string[] }> | null>(null);

  const toggle = (q: Quiz, opt: string) => {
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
      return { ...prev, [q.id]: next };
    });
  };
  const setCount = (q: Quiz, v: string) => setAnswers((prev) => ({ ...prev, [q.id]: [v] }));

  const submit = () => {
    const results: Record<string, { correct: boolean; correctAnswer: string[] }> = {};
    for (const q of quizzes) {
      const r = gradeQuiz(q, answers[q.id] ?? []);
      results[q.id] = r;
      onGraded(q.concept, r.correct);
    }
    setGraded(results);
    onSubmitted?.();
  };

  return (
    <div className="sc-quiz" data-testid="quiz-panel">
      <div className="sc-hud-h">L2 테스트 · 스스로 확인</div>
      <div className="sc-hud-sub">먼저 세고, 그 다음 채점하세요</div>

      {quizzes.map((q) => {
        const g = graded?.[q.id];
        return (
          <div key={q.id} className="sc-quiz-item" data-testid={`quiz-${q.concept}`}>
            <div className="sc-quiz-prompt">{q.prompt}</div>
            {q.kind === 'count' ? (
              <div className="sc-quiz-opts">
                {['0', '1', '2', '3', '4'].map((n) => (
                  <button key={n} className={`sc-chip ${(answers[q.id] ?? []).includes(n) ? 'on' : ''}`}
                    disabled={!!graded} onClick={() => setCount(q, n)}>{n}</button>
                ))}
              </div>
            ) : (
              <div className="sc-quiz-opts">
                {(q.options ?? []).map((opt) => (
                  <button key={opt} className={`sc-chip ${(answers[q.id] ?? []).includes(opt) ? 'on' : ''}`}
                    disabled={!!graded} onClick={() => toggle(q, opt)}>{opt}</button>
                ))}
              </div>
            )}
            {g && (
              <div className={`sc-quiz-result ${g.correct ? 'ok' : 'no'}`} data-testid={`quiz-result-${q.concept}`}>
                {g.correct ? '✓ 정답' : `✗ 정답: ${g.correctAnswer.join(', ') || '없음'}`}
              </div>
            )}
          </div>
        );
      })}

      {!graded ? (
        <button className="sc-btn primary" data-testid="quiz-submit" onClick={submit}>채점</button>
      ) : (
        <button className="sc-btn ghost" data-testid="quiz-reset" onClick={() => { setGraded(null); setAnswers({}); onReset?.(); }}>다시</button>
      )}
    </div>
  );
}
