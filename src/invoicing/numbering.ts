export class InMemoryNumberingSequence {
  private readonly counters = new Map<string, number>();
  next(legalEntityId: string, series: string, year: number): string {
    const key = `${legalEntityId}:${series}:${year}`; const next = (this.counters.get(key) ?? 0) + 1; this.counters.set(key, next);
    return `${series}-${year}-${String(next).padStart(6, '0')}`;
  }
}
