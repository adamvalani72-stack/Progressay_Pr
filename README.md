This repository is for teaching students the foundational technologies of the web from the ground up.
```sh
npm start
```

## Authentication setup

The Gaming Hub server handles email/password accounts. Passwords are stored as unique-salt scrypt hashes, never as plain text. Accounts have a server-assigned `member` or `owner` role; public sign-up always creates a member. `adamvalani72@gmail.com` is the designated owner account. During local development, account records and game best scores use SQLite. In a hosted deployment, they use Supabase Postgres. Session cookies are HTTP-only and same-site; the member games page and account progress API require a valid signed-in session. Game best scores sync when the same account signs in on another device.

Run Node.js 22.5 or newer and `npm start`, then open `http://localhost:3001/pages/signup.html` to create an account or `http://localhost:3001/pages/login.html` to sign in. The local SQLite database is outside the public website directory in `GAMING_HUB_DATA_DIR` (by default, a `.gaming-hub-data` directory alongside the repository). The server creates the directory with owner-only permissions and the database file with mode `0600`.

## Data center deployment

The Render blueprint in `render.yaml` deploys the Node app and requires Supabase and Stripe credentials; account and progress data use Supabase instead of the app instance's temporary disk. Before deploying, apply both `supabase/migrations/20261018000000_commerce.sql` and `supabase/migrations/20261025000000_gaming_hub_accounts.sql` to your Supabase project. Create the Render service from the blueprint and enter `SUPABASE_URL`, the server-only `SUPABASE_SERVICE_ROLE_KEY`, a Stripe test-mode `STRIPE_SECRET_KEY`, and the endpoint's `STRIPE_WEBHOOK_SECRET` in Render's secret environment settings. Do not use the Supabase anon key as the service role setting or expose any server key to the browser. Render supplies the HTTPS origin automatically; set `SITE_URL` only if you use a custom domain, and make it that exact HTTPS origin. Set `REQUIRE_REMOTE_DATABASE=true` on other hosts to prevent accidental local-only account storage. Existing `accounts.json` and SQLite account/progress records are imported into Supabase at startup without overwriting existing cloud accounts or higher scores.

Outside local development, Gaming Hub requires `SITE_URL` (or the hosting provider's external URL setting) to be the exact public HTTPS origin; the server refuses an HTTP production URL and marks session cookies Secure. Configure the hosting proxy to redirect HTTP to HTTPS. In cloud mode, sessions are stored as SHA-256 token hashes in Supabase and survive app restarts. Local-only sessions remain in memory and are invalidated when the server restarts. Email verification and password recovery are not implemented yet.

These accounts are managed by the Gaming Hub server and can be used from browsers connecting to it. Do not expose `GAMING_HUB_DATA_DIR` or its contents through a web server or public backup.

## Gaming Hub AI

Gaming Hub AI is available in the signed-in member games page. It supports OpenAI, Gemini, Anthropic Claude, and Ollama. Configure at least one provider on the Gaming Hub server in `.env`, setting both the provider's model ID and (for hosted services) API key:

| Provider | Required settings |
| --- | --- |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Google Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Anthropic Claude | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| Ollama | `OLLAMA_MODEL`; optionally set `OLLAMA_BASE_URL` if Ollama is not at `http://127.0.0.1:11434` |

Use a model ID available to your provider account or installed in Ollama. API keys are only read by the server and are never sent to the browser. Do not paste keys into chat or commit them. Restart Gaming Hub after changing `.env`. Hosted AI providers receive the chat messages needed to generate replies; Gaming Hub does not save chat history. Ollama can keep model inference on infrastructure you operate.

## Subscription setup

Product orders and paid annual memberships use Stripe-hosted Checkout; card details are never collected by Gaming Hub. For local testing, set a Stripe test secret, webhook signing secret, Supabase project URL, and server-only service-role key in `.env`, apply both SQL migrations in `supabase/migrations/`, then set `STRIPE_CHECKOUT_ENABLED=true`. Run `stripe listen --forward-to localhost:3001/api/stripe-webhook` and put the CLI's signing secret in `STRIPE_WEBHOOK_SECRET` for local webhook testing. For a hosted deployment, create a Stripe webhook endpoint at `https://YOUR_DOMAIN/api/stripe-webhook`, enable `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`, then save that endpoint's signing secret in Render. Keep `ENABLE_LIVE_PAYMENTS=false` while testing; a Stripe test key cannot enable live payments, and a live key is blocked unless live payments are explicitly enabled.

The listed membership and catalog amounts are used only in test checkout until they are reviewed and approved. Catalog prices over Stripe's per-item limit are rejected. A successful payment is recorded in Supabase only after webhook verification.
Ultimate Peak is the top annual membership at £25,000 per year. Its all-in bundle includes Ultimate Elite, Ultimate Pro, and Ultimate benefits plus four Elite-level companion memberships.

## Gift card balances

The gaming-products page checks a gift card against the server-side `gift_cards` table. Apply the migration before using the checker. Gift card codes are normalized to uppercase and stored as SHA-256 hashes; never store plaintext codes in Supabase. Seed a card only after securely issuing it, setting `code_hash` to the SHA-256 hex digest of its uppercase code, `last_four` to its final four characters, and `initial_balance_pence`/`balance_pence` to the amount in pence. Balance lookups are rate-limited. The current device saves only the last four characters and a last-verified balance snapshot; it does not save the card code, and saved amounts are not live until checked again.

Checkout and balance lookup require server-side credentials. Do not expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, or gift card codes in browser files or source control.
