import "server-only";
import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";

export const COOKIE_NAME = "chat_session";
export const SESSION_SECONDS = 8 * 60 * 60;
export const CONFIG_ERROR = "Brak konfiguracji ochrony: ustaw CHAT_PASSWORD i SESSION_SECRET (co najmniej 32 znaki) na serwerze.";

export function authConfig() {
  const password = process.env.CHAT_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password?.trim() || !secret || secret.length < 32) return null;
  return { password, secret };
}

function signature(payload: string, config: NonNullable<ReturnType<typeof authConfig>>) {
  // Zmiana hasła również unieważnia wcześniejsze sesje.
  return createHmac("sha256", config.secret)
    .update("chat-session-v1\0").update(config.password).update("\0").update(payload).digest();
}

export function passwordMatches(input: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(input).digest(), createHash("sha256").update(expected).digest());
}

export function createSession(now = Date.now()) {
  const config = authConfig();
  if (!config) throw new Error(CONFIG_ERROR);
  const payload = Buffer.from(JSON.stringify({ v: 1, exp: Math.floor(now / 1000) + SESSION_SECONDS, nonce: randomBytes(16).toString("hex") })).toString("base64url");
  return `${payload}.${signature(payload, config).toString("base64url")}`;
}

export function validSession(token: string | undefined, now = Date.now()) {
  const config = authConfig();
  if (!config || !token || token.length > 1024) return false;
  try {
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return false;
    const [payload, mac] = token.split(".");
    const expected = signature(payload, config);
    const actual = Buffer.from(mac, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const seconds = Math.floor(now / 1000);
    return data.v === 1 && typeof data.nonce === "string" && Number.isInteger(data.exp) && data.exp > seconds && data.exp <= seconds + SESSION_SECONDS;
  } catch { return false; }
}

export function requestSession(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return validSession(cookie?.slice(COOKIE_NAME.length + 1));
}

export function sessionCookie(value: string, clear = false) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${clear ? "; Expires=Thu, 01 Jan 1970 00:00:00 GMT" : ""}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function sameOrigin(request: Request) {
  const expected = new URL(request.url);
  const host = request.headers.get("host");
  // Next dev może używać localhost wewnętrznie, mimo wejścia przez 127.0.0.1.
  // Wyjątek dotyczy tylko lokalnego serwera dev; Origin nadal musi pasować do Host.
  if (process.env.NODE_ENV === "development" && process.env.VERCEL !== "1"
    && ["localhost", "127.0.0.1", "[::1]"].includes(expected.hostname)
    && host && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) {
    expected.host = host;
  }
  return request.headers.get("origin") === expected.origin;
}

export function authError(request: Request) {
  if (!authConfig()) return new Response(CONFIG_ERROR, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!requestSession(request)) return new Response("Sesja wygasła. Zaloguj się ponownie.", { status: 401, headers: { "Cache-Control": "no-store" } });
  return null;
}
