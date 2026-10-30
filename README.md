# Mój chatbot

Prosty chatbot Next.js App Router i TypeScript: odpowiedzi strumieniowe przez Vercel AI SDK i OpenRouter, historia bieżącej rozmowy oraz jedno hasło warsztatowe. Bez bazy danych i kont użytkowników.

## Lokalnie

Użyj Node.js 24. Zainstaluj zależności poleceniem `npm.cmd ci`.
Utwórz lokalnie `.env.local` na podstawie `.env.example`, uzupełnij wartości samodzielnie i uruchom `npm.cmd run dev`.
Nie publikuj plików `.env` ani `.env.local`.

## Publikacja na Vercel

Zaimportuj wyłącznie własne repozytorium GitHub. Wybierz Next.js, katalog główny projektu oraz Node.js 24.x. Build: `npm run build`. Zachowaj `package-lock.json`; Vercel instaluje zależności z lockfile.

W ustawieniach Environment Variables dodaj jako zmienne serwerowe:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `CHAT_PASSWORD`
- `SESSION_SECRET` (losowy sekret o długości co najmniej 32 znaków; zalecany osobny dla produkcji)

Nie dodawaj prefiksu `NEXT_PUBLIC_`. Wartości wpisuj bezpośrednio w Vercel. Nie umieszczaj ich w kodzie, repozytorium ani rozmowie.
Zmiany zmiennych wymagają ponownego wdrożenia. Dla Preview skonfiguruj osobne wartości, jeżeli chcesz testować również wdrożenia podglądowe.

### Ograniczanie prób logowania

Na Vercel przed użyciem aplikacji skonfiguruj Firewall → Configure → New Rule. Warunek: `@vercel/firewall`, Rate Limit ID: `chat-login`, limit: 5 żądań / 15 minut na IP, akcja blokowania (nie samo logowanie). Zapisz i opublikuj regułę. Nie dodawaj filtrów wyłączających część żądań z tej reguły.

Brak konfiguracji, reguły albo błąd jej sprawdzenia blokuje logowanie. Lokalny licznik procesu działa wyłącznie w trybie dev, a produkcja korzysta z Vercel Firewall. Limity Firewalla są regionalne. Na innych hostingach logowanie jest zablokowane do czasu implementacji współdzielonego limitera.

Oficjalna dokumentacja: [Rate Limiting SDK](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk), [zmienne środowiskowe](https://vercel.com/docs/environment-variables).

## Sprawdzenie po wdrożeniu

Nie uznawaj publikacji za zakończoną przed sprawdzeniem ochrony na publicznym adresie:

1. W nowym oknie prywatnym otwórz link: widoczny ekran „Wpisz hasło”, bez czatu.
2. Błędne hasło jest odrzucane, a poprawne otwiera czat; odświeżenie zachowuje sesję.
3. Cookie `chat_session` ma HttpOnly, SameSite=Strict, Secure i czas życia 8 godzin.
4. „Wyjdź” usuwa cookie i wraca do logowania; odświeżenie nadal pokazuje logowanie.
5. POST `/api/chat` bez cookie zwraca 401 i nie uruchamia modelu.
6. Limit prób logowania działa na wdrożeniu (nadmiarowe próby są odrzucane).
7. Właściciel testuje dwie kolejne wiadomości i strumieniowanie odpowiedzi — ten test może zużyć środki OpenRouter.

Testy lokalne: `npm.cmd test` (atrapy usług, bez płatnych wywołań) i `npm.cmd run build`.
