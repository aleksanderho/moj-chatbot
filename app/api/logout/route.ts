import { sameOrigin, sessionCookie } from "../../../lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Niedozwolone źródło żądania.", { status: 403 });
  return new Response(null, { status: 204, headers: { "Set-Cookie": sessionCookie("", true), "Cache-Control": "no-store" } });
}
