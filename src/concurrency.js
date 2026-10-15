// Minimal bounded-concurrency map — runs `fn` over `items` with at most `limit`
// in flight at once. Avoids both the "serial, too slow for hundreds of jobs" and
// the "unbounded Promise.all, blows through API rate limits" failure modes.
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
