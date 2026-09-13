# Concierge Go — Complete Setup Guide

This is the exhaustive, step-by-step version. If you just want the short version, see the main
[`README.md`](../README.md) in the project root. This document walks through **everything**:
installing dependencies, setting up Supabase from scratch, running migrations, configuring
Paystack (test and live), configuring the AI task-interpretation layer for whichever provider you
use, seeding demo data, verifying the app end to end, and deploying to Vercel.

Follow it top to bottom the first time. After that, jump to whichever section you need from the
table of contents.

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Get the code](#2-get-the-code)
3. [Install dependencies (npm)](#3-install-dependencies-npm)
4. [Create a Supabase project](#4-create-a-supabase-project)
5. [Configure environment variables](#5-configure-environment-variables)
6. [Run the database migrations](#6-run-the-database-migrations)
7. [Start the app locally](#7-start-the-app-locally)
8. [Create your first accounts](#8-create-your-first-accounts)
9. [Seed demo data (optional)](#9-seed-demo-data-optional)
10. [Verify everything end to end](#10-verify-everything-end-to-end)
11. [Configure Paystack (payments)](#11-configure-paystack-payments)
12. [Configure AI task interpretation](#12-configure-ai-task-interpretation)
13. [Configure outbound email / SMS (optional)](#13-configure-outbound-email--sms-optional)
14. [Production build](#14-production-build)
15. [Deploy to Vercel](#15-deploy-to-vercel)
16. [Post-deploy checklist](#16-post-deploy-checklist)
17. [Troubleshooting](#17-troubleshooting)
18. [Security checklist before going live](#18-security-checklist-before-going-live)
19. [Appendix A: Security considerations](#appendix-a-security-considerations)
20. [Appendix B: Future improvements](#appendix-b-future-improvements)

---

## 1. Prerequisites

Install these before you start:

| Tool | Minimum version | Check with |
|---|---|---|
| Node.js | 18.18 (20 LTS recommended) | `node -v` |
| npm | 9+ (ships with Node) | `npm -v` |
| Git | any recent version | `git --version` |

Accounts you'll need:

- A **Supabase** account — free tier is enough. [supabase.com](https://supabase.com)
- A **Paystack** account — only if you want real payments instead of the built-in mock mode.
  [paystack.com](https://paystack.com)
- An **Anthropic** account — only if you want AI-powered task interpretation instead of the
  built-in deterministic parser (which needs nothing and works out of the box).
  [console.anthropic.com](https://console.anthropic.com)

You do **not** need Paystack or Anthropic to run the app. Both have a working fallback with zero
configuration (mock payments, deterministic task parsing).

---

## 2. Get the code

If you received this as a `.zip`, extract it and open a terminal in the extracted folder (the
folder containing `package.json`).

If it's a Git repository:

```bash
git clone <your-repo-url> concierge-go
cd concierge-go
```

---

## 3. Install dependencies (npm)

This project uses **npm**, not yarn or pnpm — stick to npm so the lockfile (`package-lock.json`)
stays consistent.

```bash
npm install
```

This installs everything: Next.js, React, Tailwind, Supabase's JS client, Zod, Radix UI primitives,
`tsx` (used to run the seed script), and `dotenv`. It takes a minute or two. You should see a
`node_modules/` folder appear afterward — nothing else to do here.

If `npm install` fails outright, it's almost always one of:
- Node version too old → check `node -v`, upgrade if under 18.18.
- A corporate proxy/VPN blocking the npm registry → configure `npm config set proxy` or switch
  networks.
- A stale lockfile conflict → delete `node_modules` and `package-lock.json`, run `npm install`
  again (only do this if `package-lock.json` wasn't provided intentionally).

---

## 4. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account — GitHub sign-in
   is fastest).
2. Click **New Project**.
3. Fill in:
   - **Name**: anything, e.g. `concierge-go`
   - **Database password**: generate a strong one and **save it somewhere** (you may need it later
     if you ever connect a direct Postgres client — the app itself never needs it).
   - **Region**: pick whatever is closest to your users (e.g. an EU or US region close to Nigeria —
     Supabase doesn't have an African region yet, so pick the lowest-latency one available to you).
   - **Pricing plan**: Free is fine for development and a small pilot.
4. Click **Create new project**. This takes 1–2 minutes while Supabase provisions the database.
5. Once it's ready, you'll land on the project dashboard.

### 4.1 Get your API keys

1. In the left sidebar, go to **Project Settings** (gear icon) → **API**.
2. You'll see three values you need:
   - **Project URL** — looks like `https://abcdefghijk.supabase.co`. This becomes
     `NEXT_PUBLIC_SUPABASE_URL`.
   - **anon / public key** — a long JWT string under "Project API keys". This becomes
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **service_role key** — also under "Project API keys", marked **secret**. This becomes
     `SUPABASE_SERVICE_ROLE_KEY`. **Never share this, never commit it, never put it in a
     `NEXT_PUBLIC_` variable.** It bypasses every security rule in the database.

Keep this tab open — you'll paste these into `.env.local` in the next section.

### 4.2 Configure auth redirect URLs

1. Still in the dashboard, go to **Authentication** → **URL Configuration**.
2. Set **Site URL** to `http://localhost:3000` for now (you'll add your production URL later, in
   [section 16](#16-post-deploy-checklist)).
3. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/auth/callback
   ```
   This is the page that finishes email confirmation and password-reset links. Without this exact
   entry, clicking those email links will fail with a redirect error.
4. Click **Save**.

### 4.3 Email confirmations (optional but recommended to leave on)

Under **Authentication** → **Providers** → **Email**, "Confirm email" is on by default. Leave it
on — the app has a working confirmation flow. Supabase's default email templates work fine for
development; for production you'll eventually want to customize them under **Authentication** →
**Email Templates**, but that's optional polish, not a requirement.

---

## 5. Configure environment variables

1. In the project root, copy the example file:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` in your editor and fill in each value. Here is every single variable,
   explained:

### Required — the app will not start correctly without these

| Variable | Where it comes from | Example |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Section 4.1 above | `https://abcdefghijk.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Section 4.1 above | `eyJhbGciOi...` (long JWT) |
| `SUPABASE_SERVICE_ROLE_KEY` | Section 4.1 above | `eyJhbGciOi...` (long JWT, different from anon) |

### Payments

| Variable | Notes |
|---|---|
| `PAYMENT_MODE` | `mock` (default — no real money, clearly labelled dev flow) or `paystack` |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Only needed if `PAYMENT_MODE=paystack`. See [section 11](#11-configure-paystack-payments) |
| `PAYSTACK_SECRET_KEY` | Only needed if `PAYMENT_MODE=paystack`. Same section |

Leave `PAYMENT_MODE=mock` and the two Paystack fields blank to start — you can flip this later
without touching any other code.

### AI task interpretation

| Variable | Notes |
|---|---|
| `AI_PROVIDER` | `deterministic` (default, no key needed) or `anthropic`. See [section 12](#12-configure-ai-task-interpretation) |
| `AI_API_KEY` | Only needed if `AI_PROVIDER=anthropic` |
| `AI_MODEL` | Optional. Leave blank to use the built-in default model |

Leave `AI_PROVIDER=deterministic` and the rest blank to start — the app works fully without any AI
key, using a rules-based parser.

### Application

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev. Used to build payment-callback links, password-reset links, and Open Graph URLs. **Must exactly match** the URL you're actually running on, protocol included |
| `NEXT_PUBLIC_SUPPORT_PHONE` | Shown on the public site and the account-suspended page. Use E.164 format, e.g. `+2347065582830` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Shown in the same places |

### Outbound notification channels (optional)

| Variable | Notes |
|---|---|
| `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM` | Leave all blank — notifications stay in-app only. See [section 13](#13-configure-outbound-email--sms-optional) if you want to wire a real provider in |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID` | Same as above |

### Seeding

| Variable | Notes |
|---|---|
| `SEED_PASSWORD` | The password every demo account created by `npm run seed` will share. Change this from the default before sharing a seeded environment with anyone |
| `SEED_ADMIN_EMAIL` | The email address of the one admin account the seed script creates |

3. Save the file. **Never commit `.env.local`** — it's already in `.gitignore`, but double-check
   before pushing to a public repo.

---

## 6. Run the database migrations

The database schema, security policies, storage buckets, and reference data (cities, task
categories) all live in `supabase/migrations/`, in five files that must run in order. There are
two ways to apply them.

### Option A — Supabase CLI (recommended)

1. Install the CLI if you don't have it:
   ```bash
   npm install -g supabase
   ```
2. Log in (this opens a browser window):
   ```bash
   npx supabase login
   ```
3. Link this project folder to your Supabase project. You'll find your **project ref** in the
   Supabase dashboard URL (`https://supabase.com/dashboard/project/<project-ref>`) or under
   **Project Settings** → **General**:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
   It will ask for your database password (the one you set in step 4, or you can reset it from
   **Project Settings** → **Database**).
4. Push the migrations:
   ```bash
   npx supabase db push
   ```
   You'll see each migration file listed as it applies:
   ```
   Applying migration 20260101000000_initial_schema.sql...
   Applying migration 20260101000001_functions_triggers.sql...
   Applying migration 20260101000002_rls_policies.sql...
   Applying migration 20260101000003_storage.sql...
   Applying migration 20260101000004_reference_data.sql...
   Finished supabase db push.
   ```
5. Verify it worked: in the Supabase dashboard, go to **Table Editor**. You should see tables like
   `profiles`, `tasks`, `agents`, `task_quotes`, etc. Go to **Storage** — you should see three
   buckets: `avatars`, `task-attachments`, `task-proofs`.

### Option B — SQL Editor (no CLI)

If you can't install the CLI, do it manually:

1. In the Supabase dashboard, go to **SQL Editor** → **New query**.
2. Open `supabase/migrations/20260101000000_initial_schema.sql` in your code editor, copy the
   entire contents, paste into the SQL Editor, and click **Run**.
3. Repeat for each file **in this exact order** (the order matters — later files depend on earlier
   ones):
   1. `20260101000000_initial_schema.sql`
   2. `20260101000001_functions_triggers.sql`
   3. `20260101000002_rls_policies.sql`
   4. `20260101000003_storage.sql`
   5. `20260101000004_reference_data.sql`
4. Verify the same way as Option A (Table Editor + Storage tab).

If any file errors partway through, read the error message — it will usually be either "already
exists" (you ran it twice; usually safe to ignore for the failed statement, but check) or a
genuine syntax issue. If you're unsure, drop the project and start a fresh one rather than
debugging a half-applied schema — it's free and faster.

---

## 7. Start the app locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the landing page with the
"You ask. We handle it." hero. If the page errors instead, check:

- Is `.env.local` filled in with real Supabase values (not the placeholder text from
  `.env.example`)?
- Did the migrations actually run (section 6)?
- Check the terminal running `npm run dev` for the actual error — it's almost always more specific
  than what shows in the browser.

---

## 8. Create your first accounts

The app has three roles, and only one of them has a public sign-up form for each of two flows:

### Customer

1. Go to `/sign-up`, fill in the form, submit.
2. If email confirmations are on (the default), check the inbox for that address for a
   confirmation link, click it — it lands on `/auth/callback`, then redirects you to `/dashboard`.

### Go Agent

1. Go to `/sign-up/agent`, fill in the form, submit, confirm the email the same way.
2. You'll land on `/agent/verification` — every new agent starts unverified and cannot see tasks
   until an admin approves them.

### Admin (operations)

There is **deliberately no public sign-up** for this role. Create one by promoting an existing
account:

1. Sign up as a normal customer first (or use one of your test accounts).
2. In the Supabase dashboard, go to **SQL Editor** → **New query**, and run:
   ```sql
   update public.profiles set role = 'admin' where email = 'your-email@example.com';
   ```
3. Sign out and back in on the app. You'll now be able to reach `/admin`.

(If you use `npm run seed` instead — see the next section — an admin account is created for you
automatically.)

---

## 9. Seed demo data (optional)

If you want the app populated with realistic-looking data instead of starting completely empty:

```bash
npm run seed
```

This creates 3 customers, 3 Go Agents (2 already verified, 1 pending), 8 tasks spanning most of
the workflow, 3 quotes, a payment, a review, a dispute, and a handful of notifications — plus one
admin account (`SEED_ADMIN_EMAIL` from your `.env.local`). Every account it creates shares the
same password: whatever you set as `SEED_PASSWORD` in `.env.local` (default: `ConciergeGo!2026`).

The exact accounts created are printed to your terminal at the end of the run — copy them from
there.

Re-running `npm run seed` is safe: it deletes the previous batch of demo accounts first (anything
flagged `is_demo = true`), so you never end up with duplicates.

`npm run seed:reset` does the same thing (the reset is unconditional either way).

---

## 10. Verify everything end to end

Once you have accounts (seeded or created manually), walk through this checklist to confirm the
whole workflow actually works on your setup:

- [ ] **Sign in as a customer.** Land on `/dashboard`.
- [ ] **Request a task** at `/tasks/new`. Fill it in, submit. You should see "Your request has
      been received" and land on the task detail page with status "Submitted".
- [ ] **Sign in as admin** (a second browser or an incognito window is easiest, since sessions are
      per-browser). Go to `/admin/tasks`, find the task you just created, open it.
- [ ] **Send a quote.** Fill in the quote form, submit. Status should move to "Quoted".
- [ ] **Back as the customer**, refresh the task page — you should see the quote breakdown and an
      "Accept quote" button. Accept it. Status moves to "Awaiting payment".
- [ ] **Pay.** Click "Pay now" — with `PAYMENT_MODE=mock` (the default), you land on a page that
      says outright it's a development flow, with "Simulate successful payment" / "Simulate failed
      payment" buttons. Click success. Status moves to "Paid".
- [ ] **Back as admin**, open the task again — an "Assign a Go Agent" panel should appear listing
      your verified agents ranked by area/rating/workload. Assign one.
- [ ] **Sign in as that agent.** You should see the task on `/agent` and be able to click through
      the workflow buttons ("I'm on my way" → "I've arrived" → "Start the task" → "Submit for
      customer confirmation"), uploading proof when prompted.
- [ ] **Back as the customer**, the task should now show "Awaiting your confirmation" with the
      proof visible. Confirm completion (optionally rate the agent). Status moves to "Completed".
- [ ] **Notifications.** Check the bell icon in the header at each step above — you should see an
      entry for each transition.
- [ ] **Messaging.** From the task detail page (either side), send a message and confirm it shows
      up for the other party after a refresh.

If every box above works, your setup is fully correct end to end.

---

## 11. Configure Paystack (payments)

The app ships in **mock mode** by default — no signup, no keys, nothing to configure, and it's
clearly labelled as a development flow everywhere it appears. Switch to real payments whenever
you're ready.

### 11.1 Get test keys

1. Create a Paystack account at [paystack.com](https://paystack.com) (or sign in).
2. In the Paystack dashboard, go to **Settings** → **API Keys & Webhooks**.
3. By default you're in **Test Mode** (toggle in the top-right of the dashboard) — stay there
   first. Copy:
   - **Public Key** (starts with `pk_test_...`) → `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
   - **Secret Key** (starts with `sk_test_...`) → `PAYSTACK_SECRET_KEY`

### 11.2 Update your environment

In `.env.local`:

```
PAYMENT_MODE=paystack
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxx
```

Restart `npm run dev` after changing environment variables — Next.js does not hot-reload `.env*`
files.

### 11.3 Set up the webhook (recommended, works alongside the browser flow)

1. Still in **Settings** → **API Keys & Webhooks**, find the **Webhook URL** field.
2. Set it to `https://your-domain.com/api/webhooks/paystack` (use your actual deployed URL — this
   won't work with `localhost` unless you tunnel it, e.g. with `ngrok`, which is optional for
   local testing).
3. Save.

Note honestly: the primary, always-correct payment confirmation path is the customer's browser
being redirected to `/payments/callback` after paying, which always carries their session and
triggers server-side verification directly against Paystack. The webhook is a second, independent
signal and is safely idempotent, but its verification call was written for a signed-in caller —
see the note in the main README's "Future improvements" section if you want to harden this with a
dedicated service-role webhook verification path before relying on the webhook alone.

### 11.4 Test a real (test-mode) payment

1. With `PAYMENT_MODE=paystack` set, run through a task to the payment step (section 10 above).
2. Clicking "Pay now" should redirect you to an actual Paystack checkout page.
3. Use one of [Paystack's published test cards](https://paystack.com/docs/payments/test-payments/)
   — as of writing, a common one is card number `4084 0840 8408 4081`, any future expiry, CVV
   `408`, PIN `0000`, OTP `123456` (Paystack's docs are the source of truth if this changes).
4. After paying, you're redirected back to `/payments/callback`, which verifies the transaction and
   shows you "Payment received."

### 11.5 Going live

1. In the Paystack dashboard, complete their business verification (required before you can accept
   real money).
2. Switch the dashboard toggle to **Live Mode** and copy the **live** public/secret keys
   (`pk_live_...` / `sk_live_...`).
3. In your **production** environment variables (in Vercel, not `.env.local`), replace the test
   keys with the live ones.
4. Update the webhook URL to your production domain if you haven't already.
5. Do one small real transaction yourself before announcing launch.

---

## 12. Configure AI task interpretation

When a customer types a task description, `interpretTask()` (in `src/services/ai/index.ts`) turns
it into structured data for operations: category, a short summary, suggested actions, complexity,
whether proof is required, and a suggested urgency. This is **advisory only** — an admin always
reviews and prices the task themselves; nothing here auto-approves or auto-prices anything.

### 12.1 Default: no configuration needed

Leave `AI_PROVIDER=deterministic` (or just delete the line — that's the default). This uses a
rules-based parser in `src/services/ai/deterministic.ts` that matches keywords against the seven
task categories. It needs no API key, costs nothing, and always responds instantly. This is enough
to run the entire app, including in production, if you don't want an AI dependency at all.

### 12.2 Using Anthropic (Claude)

This is the only model provider wired up out of the box.

1. Create an account at [console.anthropic.com](https://console.anthropic.com).
2. Go to **API Keys**, click **Create Key**, copy it (starts with `sk-ant-...`). You'll need
   billing set up on the account for the key to actually work.
3. In `.env.local`:
   ```
   AI_PROVIDER=anthropic
   AI_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. Optional — override the model (defaults to a current Claude model chosen for cost/speed on this
   small classification task):
   ```
   AI_MODEL=claude-sonnet-5
   ```
   Any valid Claude model string from
   [Anthropic's model list](https://docs.claude.com/en/docs/about-claude/models) works here.
5. Restart `npm run dev`.
6. Safety net built in: this call has an 8-second timeout, and if it errors, times out, or returns
   something that doesn't match the expected schema, the app **automatically falls back** to the
   deterministic parser rather than failing the customer's task submission. You will never see a
   broken request because of an AI outage.

There is no separate "toggle" beyond these two environment variables — set `AI_PROVIDER=anthropic`
and a valid `AI_API_KEY`, and every new task submission from that point on is interpreted by
Claude instead of the rules parser.

### 12.3 Using a different provider (OpenAI, Gemini, a local model, etc.)

Not wired up today, but the abstraction is built for exactly this. To add one:

1. Create a new file, e.g. `src/services/ai/openai.ts`, implementing the same shape as
   `src/services/ai/anthropic.ts` — a function that takes the same `InterpretTaskInput` and returns
   a `TaskInterpretation` (see `src/services/ai/types.ts` for the exact shape).
2. In `src/services/ai/index.ts`, add a branch:
   ```ts
   if (provider === 'openai') {
     try {
       return await openaiInterpreter.interpret(input)
     } catch (error) {
       logError('ai.interpretTask.fallback', error, { provider })
     }
   }
   ```
3. In `src/lib/env.ts`, extend whatever type/validation backs `AI_PROVIDER` to accept `'openai'` as
   well as `'deterministic'` and `'anthropic'`.
4. Set `AI_PROVIDER=openai` and whatever key variable you choose in your environment.

The rest of the app (task creation, the admin quote screen, everything downstream) doesn't change
at all — it only ever calls `interpretTask()` and reads the result.

---

## 13. Configure outbound email / SMS (optional)

Right now, all notifications (quote ready, payment received, agent assigned, etc.) are created as
in-app notifications only (the bell icon) — nothing is emailed or texted, regardless of what's in
`EMAIL_*` / `SMS_*`. Those variables exist as a placeholder for wiring in a real provider later;
they are read by `src/services/notifications/` but there is no provider implementation behind them
yet. If you want real email/SMS delivery, that's genuine new work (pick a provider — Resend,
Postmark, Termii, Africa's Talking, etc. — and implement a sender in that services folder,
following the same "swap in a real implementation behind an existing interface" pattern used for
payments and AI). Leave these blank until you're ready to do that; the app works completely
normally without it.

---

## 14. Production build

Before deploying anywhere, confirm the app actually builds:

```bash
npm run build
```

This runs the full Next.js production build: TypeScript type-checking, ESLint, and static/page
generation. It should end with a route table and no errors. If it fails, fix whatever it reports
before deploying — Vercel will hit the exact same failure.

To run the production build locally afterward:

```bash
npm run start
```

---

## 15. Deploy to Vercel

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts (link to a new or existing Vercel project). It will deploy immediately using
whatever environment variables you set in step 15.2 below — set those first, or the first deploy
will be broken.

### Option B — Vercel dashboard (recommended for a first deploy)

1. Push your code to GitHub (see the short `README.md` if you need the two-file version for that).
2. Go to [vercel.com](https://vercel.com), sign in, click **Add New** → **Project**.
3. Import your GitHub repository. Vercel auto-detects Next.js — leave the build settings as
   default (`npm run build`, output directory auto-detected).
4. **Before the first deploy**, add every environment variable from your `.env.local` under
   **Environment Variables**:
   - Copy each `NEXT_PUBLIC_*` variable as-is.
   - Copy `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, `AI_API_KEY` etc. — these stay
     server-only in Vercel the same way they do locally; Vercel does not expose non-`NEXT_PUBLIC_`
     variables to the browser.
   - Set `NEXT_PUBLIC_APP_URL` to your **actual Vercel URL**, e.g.
     `https://concierge-go.vercel.app` (or your custom domain once you have one) — not
     `localhost`.
5. Click **Deploy**.

### 15.1 After the first deploy

Your app is now live at the Vercel URL, but auth redirects and payment callbacks still point at
`localhost` until you update Supabase and Paystack:

1. **Supabase** → **Authentication** → **URL Configuration**:
   - Add `https://your-vercel-url.vercel.app/auth/callback` to **Redirect URLs** (keep the
     localhost one too if you still develop locally).
   - Update **Site URL** to the production URL, or leave both if Supabase's UI allows multiple.
2. **Paystack** (if using live payments) → update the webhook URL to
   `https://your-vercel-url.vercel.app/api/webhooks/paystack`.
3. Redeploy if you changed any Vercel environment variable (Vercel doesn't require a redeploy for
   env var changes on most plans, but it's the safest way to be sure — trigger one from the
   dashboard's **Deployments** tab if in doubt).

---

## 16. Post-deploy checklist

- [ ] Visit the production URL — landing page loads.
- [ ] Sign up as a fresh customer on production, confirm the email link works (it should redirect
      correctly now that `/auth/callback` is registered for the production domain).
- [ ] Repeat the [full verification checklist](#10-verify-everything-end-to-end) against
      production, not just localhost.
- [ ] If using live Paystack, do one small real transaction yourself before telling anyone else the
      site is live.
- [ ] Promote your real admin account (section 8) — don't leave `SEED_ADMIN_EMAIL`'s demo admin as
      your only admin in a production environment; either change its password immediately or
      promote a real account and downgrade/remove the seeded one.

---

## 17. Troubleshooting

**"Invalid API key" or Supabase calls failing entirely**
Double-check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are copied exactly,
with no trailing whitespace, and that you restarted `npm run dev` after editing `.env.local`.

**Sign-up works but the confirmation email link gives an error**
The redirect URL isn't registered. Re-check section 4.2 (or 16 for production) — the URL must
match **exactly**, including `http` vs `https` and the trailing `/auth/callback` path.

**Tasks/agents/admin pages show "Unauthorized" or redirect unexpectedly**
Role-based access is enforced by the database (Row Level Security), not just the UI. Confirm the
account's `role` column in `profiles` is what you expect (SQL Editor:
`select id, email, role from public.profiles;`).

**File uploads fail**
Confirm the migrations in section 6 actually ran — specifically
`20260101000003_storage.sql`, which creates the `avatars`, `task-attachments`, and `task-proofs`
buckets and their access policies. Check **Storage** in the Supabase dashboard.

**`npm run seed` fails with a missing-env error**
It needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (not just
Vercel — the seed script runs on your machine, reading `.env.local` directly).

**Payments stuck on "Confirming your payment"**
In mock mode this shouldn't happen — check you clicked "Simulate successful payment", not just
navigated away. In Paystack mode, check the Paystack dashboard's transaction log for that
reference; if Paystack shows it succeeded but the app disagrees, check your server logs around
`verifyPaymentAction` for the actual error.

**Build fails on Vercel but works locally**
Almost always a missing environment variable in the Vercel project settings — re-check step 15,
item 4. Vercel's build logs will name the missing variable if `src/lib/env.ts` throws on it.

---

## 18. Security checklist before going live

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set only in Vercel's server environment variables, never in
      a `NEXT_PUBLIC_` variable, never committed to Git.
- [ ] Same for `PAYSTACK_SECRET_KEY` and `AI_API_KEY`.
- [ ] `PAYMENT_MODE=paystack` with **live** keys, not test keys, before accepting real customers.
- [ ] `SEED_PASSWORD` changed from the default, or the seeded demo accounts removed entirely from
      any environment real customers can reach.
- [ ] Your one true admin account uses a strong, unique password, not the seed password.
- [ ] Supabase's **Site URL** and **Redirect URLs** only list domains you actually control.
- [ ] You've read [Appendix A](#appendix-a-security-considerations) below so you know what the
      app already enforces versus what's still on you to configure correctly (the items above).

---

## Appendix A: Security considerations

What the codebase already enforces, independent of anything in this guide:

- **Two enforcement layers.** Every table has Row Level Security; the server actions and database
  read helpers also check the caller's role before touching Supabase. Neither layer trusts the
  other — a bug in one doesn't expose data through the other.
- **Prices are never client-supplied.** Quotes are computed and stored server-side; payment
  amounts come from the stored quote, not from a form field.
- **Payment status is server-verified only**, whether the flow is mock or Paystack — the browser
  can request a payment but cannot mark one as paid.
- **Agents see less than admins.** Task-participant queries go through a `SECURITY DEFINER`
  function that returns only what an assigned agent needs (name, phone, area) — never a customer's
  full profile.
- **Minimal identity data.** Agent verification intentionally does not collect ID numbers, BVN, or
  bank details in this MVP.
- **Secrets never reach the client.** The service-role key is imported only in files marked
  `server-only`, which fails the build if a client component ever imports one.
- **Uploads are validated** for type and size before they reach Storage, and Storage policies key
  access off task/profile ownership, not merely "is logged in."

What's still on you (covered in the [checklist above](#18-security-checklist-before-going-live)):
keeping the service-role and secret keys out of version control and `NEXT_PUBLIC_` variables,
using live Paystack keys only when you mean to, rotating the seed password, and keeping your admin
account credentials strong.

## Appendix B: Future improvements

Deliberately out of scope for this MVP, with the seams already in place to add each one without a
rewrite:

- Automated agent matching (today: an admin-ranked candidate list, not automatic)
- Live GPS tracking and Google Maps integration
- WhatsApp / SMS / email delivery of notifications (the notification service already lists these
  as channels — see [section 13](#13-configure-outbound-email--sms-optional) — just no provider
  implementation behind them yet)
- Flutterwave and Nigerian bank-transfer reconciliation as alternatives to Paystack
- A customer wallet
- Business and family accounts, recurring tasks
- AI-powered pricing (today: AI only interprets/categorises, never prices)
- Multi-city launch — the `cities` table already lists five more Nigerian cities beyond Calabar,
  just not marked "live" yet
- Analytics and a referral system
- A dedicated service-role Paystack webhook verification path, independent of the browser callback
  (see the note in [section 11.3](#113-set-up-the-webhook-recommended-works-alongside-the-browser-flow))
