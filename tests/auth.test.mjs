import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { randomBytes } from 'node:crypto';

// Node uruchamia źródła TS bez zmiany konfiguracji aplikacji Next.js.
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
process.env.NODE_ENV = 'development';
delete process.env.VERCEL;
process.env.CHAT_PASSWORD = randomBytes(24).toString('hex');
process.env.SESSION_SECRET = randomBytes(32).toString('hex');
process.env.OPENROUTER_API_KEY = 'test-only';
process.env.OPENROUTER_MODEL = 'test-only';
let calls = 0;
globalThis.fetch = async () => { calls++; throw new Error('Network forbidden in tests'); };

const session = await import('../lib/session.ts');
const localRequest = (origin) => new Request('http://localhost:3000/api/login', {
  headers: { host: '127.0.0.1:3000', origin },
});
assert.equal(session.sameOrigin(localRequest('http://127.0.0.1:3000')), true);
assert.equal(session.sameOrigin(localRequest('http://127.0.0.1:3001')), false);
assert.equal(session.sameOrigin(localRequest('https://other.example')), false);
assert.equal(session.sameOrigin(localRequest('null')), false);
const { POST: login } = await import('../app/api/login/route.ts');
const { POST: logout } = await import('../app/api/logout/route.ts');
const { POST: chat } = await import('../app/api/chat/route.ts');
function req(path, body = {}, cookie, origin = 'http://localhost') {
  const headers = { origin, 'content-type': 'application/json', host: 'localhost', 'x-real-ip': '127.0.0.1' };
  if (cookie) headers.cookie = cookie;
  return new Request(`http://localhost/api/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}
assert.equal((await login(req('login', { password: 'wrong' }))).status, 401);
const loggedIn = await login(req('login', { password: process.env.CHAT_PASSWORD }));
assert.equal(loggedIn.status, 204);
const cookie = loggedIn.headers.get('set-cookie');
assert.match(cookie, /HttpOnly/);
assert.match(cookie, /SameSite=Strict/);
assert.match(cookie, /Max-Age=28800/);
assert.ok(!cookie.includes(process.env.CHAT_PASSWORD));
const token = cookie.split(';')[0].split('=')[1];
assert.ok(session.validSession(token));
assert.equal(session.validSession(token + 'x'), false);
assert.equal(session.validSession(token, Date.now() + session.SESSION_SECONDS * 1000), false);
assert.equal((await chat(req('chat'))).status, 401);
assert.equal((await chat(req('chat', {}, 'chat_session=forged'))).status, 401);
// Sesja dopuszcza walidację danych, ale nie wywołanie modelu przy pustej historii.
assert.equal((await chat(req('chat', { messages: [] }, cookie.split(';')[0]))).status, 400);
assert.equal((await login(req('login', {}, undefined, 'https://other.example'))).status, 403);
assert.equal((await logout(req('logout', {}, undefined, 'https://other.example'))).status, 403);
const loggedOut = await logout(req('logout', {}, cookie.split(';')[0]));
assert.equal(loggedOut.status, 204);
assert.match(loggedOut.headers.get('set-cookie'), /chat_session=;.*Max-Age=0/);
assert.equal((await chat(req('chat'))).status, 401);
const password = process.env.CHAT_PASSWORD;
delete process.env.CHAT_PASSWORD;
assert.equal((await login(req('login', { password }))).status, 503);
assert.equal((await chat(req('chat', {}, cookie.split(';')[0]))).status, 503);
assert.equal(session.validSession(token), false);
process.env.CHAT_PASSWORD = password;
const secret = process.env.SESSION_SECRET;
delete process.env.SESSION_SECRET;
assert.equal((await login(req('login', { password }))).status, 503);
assert.equal(session.validSession(token), false);
process.env.SESSION_SECRET = secret;
for (let i = 0; i < 3; i++) assert.equal((await login(req('login', { password: 'wrong' }))).status, 401);
assert.equal((await login(req('login', { password }))).status, 429);
assert.equal(calls, 0, 'Brak połączeń z OpenRouter i innymi usługami');

// Druga wiadomość zawiera historię odpowiedzi SDK z technicznym step-start.
let sentHistory;
globalThis.fetch = async (_url, options) => {
  sentHistory = JSON.parse(options.body).messages;
  const chunk = { id: 'test', object: 'chat.completion.chunk', created: 1, model: 'test-only', choices: [{ index: 0, delta: { role: 'assistant', content: 'Odpowiedź testowa' }, finish_reason: null }] };
  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
};
const secondMessage = await chat(req('chat', { messages: [
  { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Mam na imię Ola.' }] },
  { id: 'a1', role: 'assistant', parts: [{ type: 'step-start' }, { type: 'reasoning', text: 'Test' }, { type: 'text', text: 'Witaj, Olu!' }] },
  { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'Jak mam na imię?' }] },
] }, cookie.split(';')[0]));
assert.equal(secondMessage.status, 200);
assert.match(await secondMessage.text(), /Odpowiedź testowa/);
assert.equal(sentHistory.length, 4);
assert.equal(sentHistory[0].role, 'system');
assert.match(sentHistory[0].content[0].text, /Jesteś asystentem Studio Nova/);
assert.match(sentHistory[0].content[0].text, /45 minut.*150 zł brutto/);
assert.match(sentHistory[0].content[0].text, /Przykłady oczekiwanego formatu i zachowania \(few-shot\)/);
assert.equal((sentHistory[0].content[0].text.match(/Odpowiedź asystenta:/g) ?? []).length, 3);
assert.deepEqual(sentHistory.slice(1).map((message) => message.role), ['user', 'assistant', 'user']);
assert.equal(sentHistory[1].content, 'Mam na imię Ola.');
assert.match(JSON.stringify(sentHistory), /Witaj, Olu/);
const invalidHistory = await chat(req('chat', { messages: [
  { id: 'u1', role: 'user', parts: [{ type: 'step-start' }, { type: 'text', text: 'Test' }] },
] }, cookie.split(';')[0]));
assert.equal(invalidHistory.status, 400);

// Produkcja: wyłącznie atrapa Firewall, bez żadnej sieci.
process.env.NODE_ENV = 'production';
assert.equal(session.sameOrigin(localRequest('http://127.0.0.1:3000')), false);
assert.equal((await login(req('login', { password }))).status, 503);
process.env.VERCEL = '1';
globalThis.fetch = async (url) => {
  assert.ok(String(url).includes('/.well-known/vercel/rate-limit-api/chat-login'));
  return new Response(null, { status: 404 });
};
assert.equal((await login(req('login', { password }))).status, 503);
globalThis.fetch = async () => new Response(null, { status: 429 });
assert.equal((await login(req('login', { password }))).status, 429);
globalThis.fetch = async () => { throw new Error('Firewall unavailable'); };
assert.equal((await login(req('login', { password }))).status, 503);
globalThis.fetch = async () => new Response(null, { status: 204 });
// SDK wymaga IP udostępnionego przez Vercel.
const productionRequest = req('login', { password });
productionRequest.headers.set('x-real-ip', '127.0.0.1');
const productionLogin = await login(productionRequest);
assert.equal(productionLogin.status, 204);
assert.match(productionLogin.headers.get('set-cookie'), /; Secure/);
console.log('OK: hasło, sesja, wygaśnięcie, podpis, logout, 401 czatu, konfiguracja, CSRF, limit lokalny i Firewall (atrapa). Bez płatnych wywołań.');
