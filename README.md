<p align="center">
  <img src="public/brand/icon-mark.png" alt="Concierge Go" height="120" />
</p>

<h1 align="center">Concierge Go</h1>
<p align="center"><strong>You ask. We handle it.</strong></p>

<p align="center">
  A Nigerian on-demand task execution platform, launching in Calabar, Cross River State.<br />
  Describe a real-world task — collect a document, verify a property, buy and confirm an item —
  and a verified local Go Agent handles it, with a transparent quote and photo/document proof.
</p>

<p align="center">
  <code>Request → Review → Quote → Pay → Assign → Execute → Proof → Confirm → Done</code>
</p>

---

This is not a courier app. The unit of work is a **task with proof**, not a package with a
tracking number.

A production-shaped MVP: real Supabase auth and Postgres with Row Level Security, real server
actions, three role-scoped apps (customer, Go Agent, operations) in one codebase. No static
mockups — every screen reads and writes through the database, and every button either does
something real or is visibly not wired up yet.

## Features

- **Customers** describe a task in plain language, get a transparent quote, pay in-app, track a
  live status timeline, message their agent, and review proof before confirming completion.
- **Go Agents** apply, get verified by operations, pick up tasks from a job board, follow a guided
  status workflow, and submit photo/document/receipt proof.
- **Operations** get a dashboard, a task queue with quote-building and agent assignment, an agent
  directory (verify/suspend), a customer directory, and a dispute-resolution queue.
- Role-based access control enforced **twice** — in the UI and independently in Postgres RLS.
- A payment abstraction with a clearly-labelled mock mode today and a real Paystack path.
- A task-interpretation abstraction with a deterministic parser today and a Claude-powered option,
  built to swap in another model provider without touching the rest of the app.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres, Auth, Storage)
· Zod · React Hook Form · Lucide icons — deployed to Vercel, no persistent server state, no
filesystem database.

## Quick start

```bash
npm install
cp .env.example .env.local     # fill in your Supabase project's keys
npx supabase db push           # run the database migrations
npm run seed                   # optional: creates demo customers, agents, and tasks
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**That's the short version.** For a complete walkthrough — creating the Supabase project from
scratch, every environment variable explained, configuring Paystack (test → live), configuring AI
task interpretation (or adding a different provider), verifying the whole workflow end to end, and
deploying to Vercel — see:

### 📘 [`docs/SETUP.md`](docs/SETUP.md) — the full setup guide

## Project structure

```
src/
  app/            Routes: (marketing) public site, (auth), (portal) customer app,
                  agent/ Go Agent app, admin/ operations app, payments/, api/
  actions/        Server actions — the only way the UI writes data
  database/       Typed read helpers — the only way the UI reads data
  services/       payments, notifications, storage, pricing, ai — swappable abstractions
  components/     ui/ (shadcn), shared/, layout/, tasks/, agent/, admin/, profile/
  lib/            auth, env, constants, validations, format, errors
  types/          database.ts (schema-shaped), domain.ts (app-shaped)
supabase/migrations/   Schema, RLS policies, storage policies, reference data
scripts/seed.ts        Demo data
docs/SETUP.md          Full setup & deployment guide
```

## Security & scope notes

Prices and payment status are always computed and verified server-side, never trusted from the
client. Agent-facing views never see full customer profiles — only what's needed to do the task.
Deliberately out of scope for this MVP: automated agent matching (today: admin-ranked candidates),
live GPS tracking, WhatsApp/SMS/email delivery, a wallet, multi-city launch, and a few others — the
seams are already in place to add them without a rewrite. See `docs/SETUP.md` for the full list.

---

<p align="center"><em>Concierge Go — Calabar, Cross River State, Nigeria.</em></p>
