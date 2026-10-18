// Small statistics helpers for benchmark results.

/** p-th percentile of an ascending-sorted array (nearest-rank). */
export const percentile = (sorted, p) => {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

/** Round to 2 decimals, keeping null as null. */
export const round2 = (n) => (n === null ? null : Math.round(n * 100) / 100);

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Latency summary from a list of millisecond values. */
export function latencySummary(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    min: round2(sorted[0] ?? null),
    mean: round2(mean(sorted)),
    p50: round2(percentile(sorted, 50)),
    p90: round2(percentile(sorted, 90)),
    p95: round2(percentile(sorted, 95)),
    p99: round2(percentile(sorted, 99)),
    max: round2(sorted[sorted.length - 1] ?? null),
  };
}

/** Count how many times each value appears: ['a','a','b'] -> { a: 2, b: 1 } */
export function countBy(items) {
  const counts = {};
  for (const x of items) counts[x] = (counts[x] || 0) + 1;
  return counts;
}
