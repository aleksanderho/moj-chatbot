"use client";

import { useRef, useState, type FormEvent } from "react";
import { analysisSchema, type Analysis } from "../lib/analysis-schema";

export default function MessageAnalysis() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !message.trim()) return;
    setResult(null);
    setError("");
    setBusy(true);
    const requestController = new AbortController();
    controller.current = requestController;
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: AbortSignal.any([requestController.signal, AbortSignal.timeout(60000)]),
      });
      if (response.status === 401) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
      if (!response.headers.get("Content-Type")?.includes("application/json")) throw new Error("Nie udało się odczytać odpowiedzi serwera. Odśwież stronę i sprawdź sesję.");
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Serwer odrzucił analizę. Spróbuj ponownie.");
      }
      const validated = analysisSchema.safeParse(body);
      if (!validated.success) throw new Error("Odpowiedź serwera nie spełnia schematu analizy. Nie pokazano wyniku.");
      setResult(validated.data);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error && ["AbortError", "TimeoutError"].includes(cause.name)
        ? "Analiza została przerwana lub przekroczono czas oczekiwania. Nie utworzono wyniku."
        : cause instanceof Error ? cause.message : "Nie udało się połączyć z serwerem analizy.");
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="analysis-heading">
      <h2 id="analysis-heading">Analiza wiadomości Studio Nova</h2>
      <p>Wklej wiadomość klienta. Wynik jest wyłącznie szkicem — nic nie zostanie wysłane ani zarezerwowane.</p>
      <form className="analysis-form" onSubmit={analyze}>
        <label htmlFor="client-message">Wiadomość klienta</label>
        <textarea id="client-message" value={message} maxLength={12000} rows={6} required disabled={busy}
          onChange={(event) => { setMessage(event.target.value); setResult(null); setError(""); }} />
        <div className="analysis-actions">
          <button type="submit" disabled={busy || !message.trim()}>{busy ? "Analizuję…" : "Analizuj wiadomość"}</button>
          {busy && <button type="button" onClick={() => controller.current?.abort()}>Przerwij</button>}
        </div>
      </form>
      {busy && <p role="status">Czekam na pełny, zweryfikowany wynik…</p>}
      {error && <p className="error" role="alert">{error}{error.startsWith("Sesja wygasła") && <> <a href="/">Przejdź do logowania</a></>}</p>}
      {result && <section className="analysis-result" aria-label="Wynik analizy" aria-live="polite">
        <h3>Szkic do wykorzystania przez pracownika</h3>
        <dl>
          <dt>Kategoria</dt><dd>{result.category}</dd>
          <dt>Priorytet</dt><dd>{result.priority === "high" ? "Wysoki (high)" : "Normalny (normal)"}</dd>
          <dt>Status sprawdzenia</dt><dd>{result.needs_review ? "Wymaga sprawdzenia przez pracownika (needs_review = true)" : "Nie wymaga dodatkowego sprawdzenia (needs_review = false)"}</dd>
          <dt>Szkic odpowiedzi</dt><dd className="draft">{result.draft}</dd>
        </dl>
        <p>To nadal szkic. Wiadomość nie została wysłana.</p>
      </section>}
    </section>
  );
}
