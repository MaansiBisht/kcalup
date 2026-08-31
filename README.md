# Kcalup

Photo to calories in under 15 seconds. Mobile-first web app.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), TypeScript, Tailwind v4 |
| Auth / DB / Storage | Supabase (Postgres + RLS) |
| AI | Anthropic SDK pointed at any Messages-compatible provider |
| Validation | Zod |
| Host | Vercel |

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

### Environment

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `AI_API_KEY` | Your AI provider key |
| `AI_BASE_URL` | Omit for Anthropic direct; for Command Code use `https://api.commandcode.ai/provider` |
| `AI_MODEL` | e.g. `claude-sonnet-5` |

**Command Code gotchas**, verified against the live API on 2026-08-31:

- The Anthropic SDK appends `/v1/messages` itself, so `AI_BASE_URL` must stop at `/provider`. Ending it in `/v1` yields `/v1/v1/messages` and a 404.
- Their `/messages` endpoint serves **Claude models only**. OSS models such as `minimax/minimax-m3-free` live on `/chat/completions` in OpenAI format and cannot be reached through the Anthropic SDK.
- Both endpoints require their paid **Provider** plan. A Go plan returns `upgrade_required` and is CLI-only.

A missing required variable throws at startup by name rather than failing later as a confusing 500.

### Database

Run the migrations in order against your Supabase project (SQL editor or `supabase db push`):

1. `supabase/migrations/0001_init.sql` — tables, RLS policies, the signup trigger, the `log_meal` function
2. `supabase/migrations/0002_storage.sql` — the private `meal-images` bucket and its per-user path policies

## How the photo loop works

```
phone ──image──▶ Supabase Storage        (direct upload, signed by the user's session)
  │
  └──storage key──▶ /api/analyze ──▶ AI provider
                         │
                         ▼
                    Zod validation ──▶ editable review sheet ──▶ log_meal()
```

The image never passes through an API route. The route receives only the storage key, checks it starts with the caller's user id, then hands the model a 5-minute signed read URL.

Photos are downscaled client-side to a 1280px long edge before upload — cheaper on upload, storage and latency at once.

## Security model

Authorization lives in Postgres, not in application code:

- Every table has RLS `using (user_id = auth.uid())`. A client cannot send a `user_id` that works.
- `food_items` inherits ownership through its meal; `storage.objects` through the `{user_id}/` path prefix.
- `local_date` is computed server-side inside `log_meal` from the profile's timezone. The client never sends a date.
- Rate limits: ~30 analyses/hour and ~100/day per user, counted from the `ai_calls` table. The daily cap is what protects the AI balance from a stuck retry loop.

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm test           # unit tests
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

### Tests

`npm test` runs the pure-logic suite: timezone/`local_date` boundaries, Zod parsing of malformed AI output, and nutrition math.

`tests/rls.test.ts` proves the security model but needs a real database, so it skips unless you point it at a non-production project:

```bash
RLS_TEST_URL=... RLS_TEST_ANON_KEY=... \
RLS_TEST_USER_A_EMAIL=... RLS_TEST_USER_A_PASSWORD=... \
RLS_TEST_USER_B_EMAIL=... RLS_TEST_USER_B_PASSWORD=... npm test
```

## Installing to the home screen

The manifest makes the site installable — no service worker, because installability does not need one.

- **Android Chrome** — real app icon, and long-press shows the "Add food" shortcut, which opens straight into the camera via `/?action=photo`.
- **iOS Safari** — installs and launches standalone, but ignores `shortcuts`. One tap from the icon to the photo button.
- **Desktop** — installs from the omnibox.

An OS home-screen *widget* is not possible from a browser on either platform. See PLAN.md for what would be required.

## Design

Tokens live in `@theme` in `src/app/globals.css`, so components stay pure Tailwind utilities (`bg-forest`, `rounded-card`, `text-muted`) with no hand-written CSS.
