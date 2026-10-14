import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUsageReservation } from './quota.mjs';

const today = '2026-10-14';
const now = () => new Date(`${today}T12:00:00Z`);
function storage(initial) {
  let state = initial;
  let generation = initial ? 1 : 0;
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname === 'metadata.google.internal') {
      assert.equal(options.headers['Metadata-Flavor'], 'Google');
      return Response.json({ access_token: 'fixture-token' });
    }
    assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    assert.equal(url.hostname, 'storage.googleapis.com');
    if (options.method === 'POST') {
      if (url.searchParams.get('ifGenerationMatch') !== String(generation))
        return new Response(null, { status: 412 });
      state = JSON.parse(options.body);
      generation++;
      return Response.json({ generation: String(generation) });
    }
    if (!state) return new Response(null, { status: 404 });
    if (url.searchParams.has('alt')) {
      if (url.searchParams.get('generation') !== String(generation))
        return new Response(null, { status: 404 });
      return Response.json(state);
    }
    return Response.json({ generation: String(generation) });
  };
  return { fetchImpl, read: () => state };
}
test('first reservation persists and a new handler sees the same allowance', async () => {
  const db = storage();
  for (let restart = 0; restart < 2; restart++)
    await createUsageReservation({ bucket: 'demo', now, fetchImpl: db.fetchImpl })();
  assert.deepEqual(db.read(), { date: today, daily: 2, total: 2 });
});
test('concurrent reservations cannot spend the last daily slot twice', async () => {
  const db = storage({ date: today, daily: 24, total: 60 });
  const attempt = () => createUsageReservation({ bucket: 'demo', now, fetchImpl: db.fetchImpl })();
  const results = await Promise.allSettled([attempt(), attempt(), attempt()]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected' && r.reason.status === 429).length, 2);
  assert.deepEqual(db.read(), { date: today, daily: 25, total: 61 });
});
test('a new UTC day resets only the daily allowance, never the lifetime allowance', async () => {
  const db = storage({ date: '2026-10-13', daily: 25, total: 99 });
  const reserve = createUsageReservation({ bucket: 'demo', now, fetchImpl: db.fetchImpl });
  await reserve();
  assert.deepEqual(db.read(), { date: today, daily: 1, total: 100 });
  await assert.rejects(reserve(), { status: 429 });
});
test('malformed counters, authentication and storage failures stop reservations', async () => {
  for (const state of [
    { date: today, daily: -1, total: 0 },
    { date: today, daily: 2, total: 1 },
    {},
  ]) {
    const db = storage(state);
    await assert.rejects(
      createUsageReservation({ bucket: 'demo', now, fetchImpl: db.fetchImpl })(),
      { status: 503 },
    );
  }
  for (const fail of ['token', 'metadata', 'write']) {
    const db = storage();
    const fetchImpl = (url, options) => {
      if (
        (fail === 'token' && url.includes('metadata.google.internal')) ||
        (fail === 'metadata' && url.includes('?fields=')) ||
        (fail === 'write' && options.method === 'POST')
      )
        return Promise.resolve(new Response('private error details', { status: 403 }));
      return db.fetchImpl(url, options);
    };
    await assert.rejects(
      createUsageReservation({ bucket: 'demo', now, fetchImpl })(),
      (error) => error.status === 503 && !error.message.includes('private'),
    );
  }
});
