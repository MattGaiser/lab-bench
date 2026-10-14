/** A shared request allowance survives Cloud Run restarts and concurrent instances. */
export class UsageLimitError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createUsageReservation({
  bucket = process.env.AI_USAGE_BUCKET,
  fetchImpl = fetch,
  now = () => new Date(),
} = {}) {
  if (!bucket) return undefined;
  return async (parentSignal) => {
    const signal = AbortSignal.any([
      AbortSignal.timeout(8000),
      ...(parentSignal ? [parentSignal] : []),
    ]);
    const unavailable = () =>
      new UsageLimitError(
        503,
        'The assistant could not check its demo allowance. Try again, or open the sample editor.',
      );
    try {
      const identity = await fetchImpl(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
        { headers: { 'Metadata-Flavor': 'Google' }, signal },
      );
      if (!identity.ok) throw unavailable();
      const token = (await identity.json()).access_token;
      if (typeof token !== 'string' || !token) throw unavailable();
      const headers = { Authorization: `Bearer ${token}` };
      const object = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/assistant-usage.json`;
      // Generation preconditions make each reservation atomic, including the first write.
      for (let attempt = 0; attempt < 3; attempt++) {
        const today = now().toISOString().slice(0, 10);
        const metadata = await fetchImpl(`${object}?fields=generation`, { headers, signal });
        let generation = '0';
        let usage = { date: today, daily: 0, total: 0 };
        if (metadata.ok) {
          generation = (await metadata.json()).generation;
          if (typeof generation !== 'string' || !/^\d+$/.test(generation)) throw unavailable();
          const stored = await fetchImpl(`${object}?alt=media&generation=${generation}`, {
            headers,
            signal,
          });
          if (stored.status === 404) continue; // Another reservation replaced this generation.
          if (!stored.ok) throw unavailable();
          usage = await stored.json();
          if (
            !usage ||
            !/^\d{4}-\d{2}-\d{2}$/.test(usage.date) ||
            !Number.isSafeInteger(usage.daily) ||
            usage.daily < 0 ||
            !Number.isSafeInteger(usage.total) ||
            usage.total < usage.daily
          )
            throw unavailable();
        } else if (metadata.status !== 404) throw unavailable();
        if (usage.date !== today) usage = { ...usage, date: today, daily: 0 };
        if (usage.total >= 100)
          throw new UsageLimitError(
            429,
            'This demo has used its AI allowance. The sample editor and simulator are still available.',
          );
        if (usage.daily >= 25)
          throw new UsageLimitError(
            429,
            'Today’s shared AI allowance is used up. Try after midnight UTC, or open the sample editor.',
          );
        const write = await fetchImpl(
          `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=assistant-usage.json&ifGenerationMatch=${generation}`,
          {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({ date: today, daily: usage.daily + 1, total: usage.total + 1 }),
          },
        );
        if (write.status === 412) {
          await write.body?.cancel();
          continue;
        }
        if (!write.ok) throw unavailable();
        await write.body?.cancel();
        return;
      }
      throw unavailable();
    } catch (error) {
      if (error instanceof UsageLimitError) throw error;
      throw unavailable();
    }
  };
}
