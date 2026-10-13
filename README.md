This repository is for teaching students the foundational technologies of the web from the ground up.
``   ``
python3 -m http.server 3000

## Authentication setup

The login and signup pages use Supabase Auth for email/password accounts and Google OAuth. Authentication does not work until you connect a Supabase project:

1. Create a Supabase project and copy its Project URL and publishable key into `auth-config.js`. The publishable/anon key is intended for browser use; never put a service-role or secret key in this file.
2. In Supabase Authentication settings, enable email sign-in and Google as a provider. Create a Google OAuth web client and enter its client ID and client secret in the Supabase Google provider settings. Set the Google client's authorized redirect URI to the callback URL shown by Supabase.
3. Add the local site URL and deployed login/signup URLs to Supabase's allowed redirect URLs. For local testing, run the server above and open `http://localhost:3000/pages/login.html` or `http://localhost:3000/pages/signup.html`.
4. For Google OAuth, configure the deployed site domain in Google OAuth and Supabase before testing. Supabase email confirmation and password reset links return to the page that initiated the request.

## Subscription setup

This project uses a front-end demo subscription flow and does not integrate with Stripe or any payment gateway. Open `http://localhost:3001/pages/subscriptions.html` after starting the site to review the annual plans.

The Basic, Standard, Premium, VIP, Galactic, and Galactic Plus plans are annual membership tiers. The current demo pricing ladder runs from £9.99 for Basic to £1,000 for Galactic Plus per year.