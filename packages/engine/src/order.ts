import { TaskAssignment } from './state';

export function orderViolated(tasks: readonly TaskAssignment[]): boolean {
  const abs = tasks.filter((t) => t.order?.kind === 'absolute');
  for (const tk of abs) {
    if (!tk.fulfilled) continue;
    const p = (tk.order as { kind: 'absolute'; position: number }).position;
    const earlierAllDone = abs.every((o) => {
      const op = (o.order as { kind: 'absolute'; position: number }).position;
      return op >= p || o.fulfilled;
    });
    if (!earlierAllDone) return true;
  }

  const rel = tasks.filter((t) => t.order?.kind === 'relative');
  for (const tk of rel) {
    if (!tk.fulfilled) continue;
    const c = (tk.order as { kind: 'relative'; chevrons: number }).chevrons;
    const earlierAllDone = rel.every((o) => {
      const oc = (o.order as { kind: 'relative'; chevrons: number }).chevrons;
      return oc >= c || o.fulfilled;
    });
    if (!earlierAllDone) return true;
  }

  const last = tasks.filter((t) => t.order?.kind === 'last');
  if (last.some((t) => t.fulfilled)) {
    const others = tasks.filter((t) => t.order?.kind !== 'last');
    if (others.some((t) => !t.fulfilled)) return true;
  }

  return false;
}
