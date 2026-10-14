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

This project uses a front-end demo subscription flow and does not integrate with Stripe or any payment gateway. Open `http://localhost:3001/pages/subscriptions.html` after starting the site to review the annual plans.

The Free plan costs £0 and has no payment step. Basic, Standard, Premium, VIP, Galactic, Galactic Plus, Galactic Plus Plus, and Ultimate are paid annual membership tiers, from £9.99 to £25,000 per year. Ultimate is presented as the all-inclusive top tier, with priority access and support, a member concierge, event invitations, and exclusive status. The membership checkout is a demo and does not create accounts or process payments.
