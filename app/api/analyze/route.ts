import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import { authError, sameOrigin } from "../../../lib/session";
import { analysisSchema } from "../../../lib/analysis-schema";
import { analysisError, analysisInstructions, checkAnalysisSupport, requireComplete } from "../../../lib/analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = z.strictObject({ message: z.string().trim().min(1).max(12000) });

export async function POST(request: Request) {
  const denied = authError(request);
  if (denied) return denied;
  if (!sameOrigin(request)) return new Response("Niedozwolone źródło żądania.", { status: 403 });
  let input;
  try {
    input = inputSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Wpisz wiadomość klienta (od 1 do 12000 znaków).", code: "input" }, { status: 400 });
  }
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim();
  if (!apiKey || !model) return Response.json({ error: "Brak konfiguracji: ustaw OPENROUTER_API_KEY i OPENROUTER_MODEL po stronie serwera.", code: "config" }, { status: 503 });

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50000)]);
  try {
    await checkAnalysisSupport(model, signal);
    const openrouter = createOpenRouter({ apiKey });
    const result = await generateText({
      model: openrouter.chat(model, {
        structuredOutputs: { strict: true },
        provider: { require_parameters: true },
      }),
      instructions: analysisInstructions,
      messages: [{ role: "user", content: input.message }],
      output: Output.object({ name: "studio_nova_analysis", schema: analysisSchema }),
      // Potrzebne do rozpoznania pola refusal dostawcy; treść nie jest logowana ani wysyłana do klienta.
      include: { responseBody: true },
      abortSignal: signal,
      maxRetries: 0,
    });
    requireComplete(result.finishReason, result.response.body);
    const analysis = analysisSchema.parse(result.output);
    return Response.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = analysisError(error);
    return Response.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
