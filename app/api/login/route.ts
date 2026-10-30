import { authConfig, CONFIG_ERROR, createSession, passwordMatches, sameOrigin, sessionCookie } from "../../../lib/session";
import { loginLimit } from "../../../lib/login-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Niedozwolone źródło żądania.", { status: 403 });
  const config = authConfig();
  if (!config) return new Response(CONFIG_ERROR, { status: 503 });
  const limited = await loginLimit(request);
  if (limited) return limited;
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response("Wpisz hasło.", { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return new Response("Zbyt długie żądanie.", { status: 413 }); }
      chunks.push(value);
    }
    const { password } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (typeof password !== "string" || !passwordMatches(password, config.password)) return new Response("Nieprawidłowe hasło.", { status: 401 });
    return new Response(null, { status: 204, headers: { "Set-Cookie": sessionCookie(createSession()), "Cache-Control": "no-store" } });
  } catch {
    return new Response("Nieprawidłowe żądanie logowania.", { status: 400 });
  }
}
