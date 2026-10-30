import "server-only";
import { checkRateLimit } from "@vercel/firewall";

// Wyłącznie dla jednego lokalnego serwera dev. Restart zeruje ten licznik.
let localWindow = { attempts: 0, reset: 0 };
const WINDOW = 15 * 60 * 1000;

export async function loginLimit(request: Request) {
  if (process.env.NODE_ENV === "development" && process.env.VERCEL !== "1") {
    const now = Date.now();
    if (now >= localWindow.reset) localWindow = { attempts: 0, reset: now + WINDOW };
    if (++localWindow.attempts > 5) return new Response("Za dużo prób. Poczekaj 15 minut.", { status: 429, headers: { "Retry-After": String(Math.ceil((localWindow.reset - now) / 1000)) } });
    return null;
  }
  // Hosting wymaga współdzielonego limitera; nigdy nie wracamy do licznika w RAM.
  if (process.env.VERCEL !== "1" || process.env.NODE_ENV !== "production") return new Response("Logowanie na tym hostingu wymaga produkcyjnej konfiguracji współdzielonego limitera. Obsługiwany jest Vercel Firewall.", { status: 503 });
  try {
    const result = await checkRateLimit("chat-login", { request, timeout: 3000 });
    if (result.error === "not-found") throw new Error("Missing firewall rule");
    if (result.rateLimited || result.error === "blocked") return new Response("Za dużo prób logowania. Spróbuj później.", { status: 429, headers: { "Retry-After": "900" } });
    return null;
  } catch {
    return new Response("Logowanie zablokowane: nie można potwierdzić ochrony Vercel Firewall (reguła chat-login).", { status: 503 });
  }
}
