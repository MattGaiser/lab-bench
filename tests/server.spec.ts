import { test, expect } from '@playwright/test';

test('the packaged server serves app assets without exposing source or traversal paths', async ({
  request,
}) => {
  const index = await request.get('/');
  expect(index.status()).toBe(200);
  expect(index.headers()['content-type']).toContain('text/html');
  expect(index.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect((await request.get('/src/App.tsx')).status()).toBe(404);
  expect((await request.get('/package.json')).status()).toBe(404);
  expect((await request.get('/..%5cpackage.json')).status()).toBe(400);
  expect((await request.get('/%ZZ')).status()).toBe(400);
  expect((await request.post('/')).status()).toBe(405);
  const head = await request.head('/');
  expect(head.status()).toBe(200);
  expect(Number(head.headers()['content-length'])).toBeGreaterThan(0);
  expect((await head.body()).length).toBe(0);
});
