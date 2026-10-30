"use client";

import { useState, type FormEvent } from "react";

export default function Login({ configurationError }: { configurationError: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || busy || configurationError) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      setPassword("");
      if (!response.ok) { setError(await response.text()); setBusy(false); return; }
      window.location.replace("/");
    } catch {
      setPassword("");
      setError("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
      setBusy(false);
    }
  }
  return <main>
    <h1>Wpisz hasło</h1>
    <form onSubmit={submit}>
      <label className="sr-only" htmlFor="password">Hasło warsztatowe</label>
      <input id="password" type="password" autoComplete="current-password" placeholder="Hasło warsztatowe" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy || Boolean(configurationError)} required maxLength={1024} />
      <button disabled={busy || !password || Boolean(configurationError)}>{busy ? "Sprawdzam…" : "Wejdź"}</button>
    </form>
    {(configurationError || error) && <p className="error" role="alert">{configurationError || error}</p>}
  </main>;
}
