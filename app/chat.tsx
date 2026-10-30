"use client";

import { useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const transport = new DefaultChatTransport({ api: "/api/chat" });

export default function Chat() {
  const [message, setMessage] = useState("");
  const { messages, sendMessage, status, error, clearError } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";
  const [logoutError, setLogoutError] = useState("");
  const [leaving, setLeaving] = useState(false);
  async function logout() {
    setLeaving(true);
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.replace("/");
    } catch {
      setLogoutError("Nie udało się wyjść. Spróbuj ponownie.");
      setLeaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    clearError();
    void sendMessage({ text });
    setMessage("");
  }

  return (
    <main>
      <h1>Mój chatbot</h1>
      <button type="button" onClick={logout} disabled={leaving}>{leaving ? "Wychodzę…" : "Wyjdź"}</button>
      {logoutError && <p className="error" role="alert">{logoutError}</p>}
      <section className="conversation" role="log" aria-label="Rozmowa" aria-live="polite">
        {messages.map((item) => (
          <p className={`message ${item.role === "assistant" ? "assistant" : ""}`} key={item.id}>
            <strong>{item.role === "user" ? "Ty: " : "Chatbot: "}</strong>
            {item.parts.map((part, index) => part.type === "text" ? <span key={index}>{part.text}</span> : null)}
          </p>
        ))}
      </section>
      {busy && <p role="status">{status === "submitted" ? "Czekam na odpowiedź…" : "Chatbot pisze…"}</p>}
      {error && <p className="error" role="alert">{error.message.startsWith("Sesja wygasła") ? <>Sesja wygasła. <a href="/">Zaloguj się ponownie</a>.</> : error.message.startsWith("Brak konfiguracji") || error.message.startsWith("Nie udało się") || error.message.startsWith("Nieprawidłowa") ? error.message : "Nie udało się połączyć z czatem. Sprawdź połączenie i konfigurację OpenRouter, a następnie spróbuj ponownie."}</p>}
      <form onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="message">Wiadomość</label>
        <input id="message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Napisz wiadomość…" autoComplete="off" disabled={busy} />
        <button type="submit" disabled={busy || !message.trim()}>Wyślij</button>
      </form>
    </main>
  );
}
