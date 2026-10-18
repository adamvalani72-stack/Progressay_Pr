This repository is for teaching students the foundational technologies of the web from the ground up.
```sh
npm start
```

## Authentication setup

The login and signup pages use Supabase Auth for email/password accounts and Google OAuth. To enable accounts:

1. Create a Supabase project. For the included Express server, copy `.env.example` to `.env` and set `SUPABASE_URL` to your project URL and `SUPABASE_PUBLISHABLE_KEY` to its publishable key. For static hosting without the Express API, set `projectUrl` and `publishableKey` in `auth-config.js` instead. The publishable key is safe for browser use; never use a service-role or secret key here.
2. In Supabase Authentication settings, enable email sign-in and Google as a provider. Create a Google OAuth web client and enter its client ID and client secret in the Supabase Google provider settings. Set the Google client's authorized redirect URI to the callback URL shown by Supabase.
3. Add your local site URL and deployed login/signup URLs to Supabase's allowed redirect URLs. For local testing, run `npm start` and open `http://localhost:3001/pages/login.html` or `http://localhost:3001/pages/signup.html`.
4. For Google OAuth, configure the deployed site domain in Google OAuth and Supabase before testing. Supabase email confirmation and password reset links return to the page that initiated the request.

## Subscription setup

Product orders and paid annual memberships use Stripe-hosted Checkout; card details are never collected by Gaming Hub. Checkout is disabled by default. Configure a Stripe test secret, webhook signing secret, Supabase project URL, publishable key, and server-only service-role key in `.env`, apply the SQL migration in `supabase/migrations/`, then set `STRIPE_CHECKOUT_ENABLED=true`. Keep `ENABLE_LIVE_PAYMENTS=false` while testing. A Stripe test key cannot enable live payments. Configure a Stripe webhook for `/api/stripe-webhook` with checkout completion and subscription update/deletion events.

The listed membership and catalog amounts are used only in test checkout until they are reviewed and approved. Catalog prices over Stripe's per-item limit are rejected. A successful payment is recorded in Supabase only after webhook verification.
Ultimate Peak is the top annual membership at £100,000 per year. Its all-in bundle includes Ultimate Elite, Ultimate Pro, and Ultimate benefits plus four Elite-level companion memberships.

## Gift card balances

The gaming-products page checks a gift card against the server-side `gift_cards` table. Apply the migration before using the checker. Gift card codes are normalized to uppercase and stored as SHA-256 hashes; never store plaintext codes in Supabase. Seed a card only after securely issuing it, setting `code_hash` to the SHA-256 hex digest of its uppercase code, `last_four` to its final four characters, and `initial_balance_pence`/`balance_pence` to the amount in pence. Balance lookups are rate-limited. The current device saves only the last four characters and a last-verified balance snapshot; it does not save the card code, and saved amounts are not live until checked again.

Checkout and balance lookup require server-side credentials. Do not expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, or gift card codes in browser files or source control.
