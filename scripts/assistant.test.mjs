import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { draftScenario, createAssistantHandler } from './assistant.mjs';
import { exampleLab } from '../src/domain.ts';

const response = (value) =>
  Response.json({
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
  });
const ready = () => ({ message: 'A holding-circuit exercise.', scenario: exampleLab() });
test('provider contract, model limits and canonical lab conversion', async () => {
  let called = 0;
  const context = [
    { role: 'user', content: 'Make a motor lab' },
    { role: 'assistant', content: 'Who is it for?' },
  ];
  const result = await draftScenario(
    { prompt: 'First-year apprentices, 15 minutes', previous: exampleLab(), context },
    {
      apiKey: 'test-only',
      fetchImpl: async (url, options) => {
        called++;
        assert.equal(url, 'https://api.openai.com/v1/responses');
        const body = JSON.parse(options.body);
        assert.equal(body.store, false);
        assert.equal(body.text.format.strict, true);
        assert.equal(body.max_output_tokens, 1800);
        assert.equal(JSON.parse(body.input).previousProposal.fault, 'hold');
        assert.deepEqual(JSON.parse(body.input).recentConversation, context);
        const value = ready();
        value.scenario.positions.start.x = 9999;
        // The model cannot change topology/layout even if it supplies extra fields.
        return response(value);
      },
    },
  );
  assert.equal(called, 1);
  assert.deepEqual(result.lab, exampleLab());
});
test('missing key and malformed input never call the provider', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
  };
  for (const input of [
    null,
    {},
    { prompt: '' },
    { prompt: 'x'.repeat(2001) },
    { prompt: 'ok', previous: {} },
    { prompt: 'ok', context: [{ role: 'system', content: 'bad' }] },
    { prompt: 'ok', context: Array(5).fill({ role: 'user', content: 'x' }) },
  ])
    await assert.rejects(draftScenario(input, { apiKey: 'test-only', fetchImpl }), { status: 400 });
  await assert.rejects(draftScenario({ prompt: 'ok' }, { fetchImpl }), { status: 503 });
  assert.equal(calls, 0);
});
test('unsupported requests and refusals return guidance without a lab', async () => {
  assert.equal(
    (
      await draftScenario(
        { prompt: 'plumbing' },
        {
          apiKey: 'test',
          fetchImpl: async () =>
            response({ message: 'Only start/stop circuits are supported.', scenario: null }),
        },
      )
    ).lab,
    null,
  );
  assert.equal(
    (
      await draftScenario(
        { prompt: 'test' },
        {
          apiKey: 'test',
          fetchImpl: async () =>
            Response.json({
              status: 'completed',
              output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }],
            }),
        },
      )
    ).lab,
    null,
  );
});
test('invalid provider data, incomplete responses and network failures fail closed', async () => {
  for (const value of [
    null,
    {},
    { message: 'ok' },
    { message: 'ok', scenario: { ...exampleLab(), fault: 'fake' } },
    { message: 'ok', scenario: { ...exampleLab(), title: '' } },
  ])
    await assert.rejects(
      draftScenario({ prompt: 'test' }, { apiKey: 'test', fetchImpl: async () => response(value) }),
      { status: 502 },
    );
  for (const fetchImpl of [
    async () => Response.json({ status: 'incomplete', output: [] }),
    async () => {
      throw new Error('SECRET FROM PROVIDER');
    },
  ])
    await assert.rejects(
      draftScenario({ prompt: 'test' }, { apiKey: 'test', fetchImpl }),
      (e) => e.status === 502 && !e.message.includes('SECRET'),
    );
});
test('provider errors are sanitized and canceled requests are bounded', async () => {
  for (const status of [401, 429, 500]) {
    let calls = 0;
    await assert.rejects(
      draftScenario(
        { prompt: 'test' },
        {
          apiKey: 'test',
          fetchImpl: async () => {
            calls++;
            return new Response('secret details', { status });
          },
        },
      ),
      (e) => e.status === (status === 429 ? 429 : 502) && !e.message.includes('secret'),
    );
    assert.equal(calls, 1, 'Billed requests are not automatically retried');
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    draftScenario(
      { prompt: 'test' },
      {
        apiKey: 'test',
        signal: controller.signal,
        fetchImpl: async (_, options) => {
          options.signal.throwIfAborted();
        },
      },
    ),
    { status: 504 },
  );
});
test('HTTP boundary rejects cross-origin, host spoofing, malformed and oversized requests', async (t) => {
  let calls = 0;
  const handler = createAssistantHandler({
    apiKey: 'test',
    fetchImpl: async () => {
      calls++;
      return response(ready());
    },
  });
  const server = createServer((req, res) => void handler(req, res, server.address().port));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const status = await fetch(`${url}/api/assistant/status`);
  assert.deepEqual(await status.json(), { available: true });
  const send = (body, headers = {}) =>
    fetch(`${url}/api/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    });
  assert.equal((await send('{}', { Origin: 'https://evil.example' })).status, 403);
  const spoofed = await new Promise((resolve, reject) => {
    const req = httpRequest(
      `${url}/api/scenario`,
      { method: 'POST', headers: { Host: 'evil.example', 'Content-Type': 'application/json' } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
    req.end('{}');
  });
  assert.equal(spoofed, 403);
  assert.equal((await send('{}', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await send('not json')).status, 400);
  assert.equal((await send('x'.repeat(66000))).status, 413);
  assert.equal(calls, 0);
  const valid = await send(JSON.stringify({ prompt: 'Teach seal-in' }), { Origin: url });
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).lab.fault, 'hold');
  assert.equal(calls, 1);
  assert.equal((await send(JSON.stringify({ prompt: 'repeat' }))).status, 429);
});
