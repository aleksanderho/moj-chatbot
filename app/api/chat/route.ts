import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { authError, sameOrigin } from "../../../lib/session";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  validateUIMessages,
} from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const providerError = "Nie udało się uzyskać odpowiedzi. Sprawdź klucz, identyfikator modelu i dostępne środki w OpenRouter, a następnie spróbuj ponownie.";

export async function POST(request: Request) {
  const denied = authError(request);
  if (denied) return denied;
  if (!sameOrigin(request)) return new Response("Niedozwolone źródło żądania.", { status: 403 });
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim();
  if (!apiKey || !model) {
    return new Response(
      "Brak konfiguracji: uzupełnij OPENROUTER_API_KEY i OPENROUTER_MODEL w pliku .env.local w folderze projektu.",
      { status: 503 },
    );
  }

  let messages;
  try {
    const body = await request.json();
    messages = await validateUIMessages({ messages: body.messages });
    const last = messages.at(-1);
    if (!last || last.role !== "user" || !last.parts.some((part) => part.type === "text" && part.text.trim())) {
      throw new Error("Empty message");
    }
    if (messages.some((message) => !["user", "assistant"].includes(message.role) || message.parts.some((part) =>
      part.type !== "text" && !(message.role === "assistant" && (part.type === "step-start" || part.type === "reasoning"))
    ))) {
      throw new Error("Unsupported message");
    }
  } catch {
    return new Response("Nieprawidłowa wiadomość lub historia rozmowy.", { status: 400 });
  }

  try {
    const openrouter = createOpenRouter({ apiKey });
    const result = streamText({
      model: openrouter(model),
      messages: await convertToModelMessages(messages),
      abortSignal: request.signal,
      maxRetries: 0,
    });
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: () => providerError,
      }),
    });
  } catch {
    return new Response(providerError, { status: 502 });
  }
}
