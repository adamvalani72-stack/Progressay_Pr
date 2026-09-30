This repository is for teaching students the foundational technologies of the web from the ground up.
``   ``
python3 -m http.server 3000

## Authentication setup

The login and signup pages use Supabase Auth for email/password accounts and Google OAuth. Authentication does not work until you connect a Supabase project:

1. Create a Supabase project and copy its Project URL and publishable key into `auth-config.js`. The publishable/anon key is intended for browser use; never put a service-role or secret key in this file.
2. In Supabase Authentication settings, enable email sign-in and Google as a provider. Create a Google OAuth web client and enter its client ID and client secret in the Supabase Google provider settings. Set the Google client's authorized redirect URI to the callback URL shown by Supabase.
3. Add the local site URL and deployed login/signup URLs to Supabase's allowed redirect URLs. For local testing, run the server above and open `http://localhost:3000/pages/login.html` or `http://localhost:3000/pages/signup.html`.
4. For Google OAuth, configure the deployed site domain in Google OAuth and Supabase before testing. Supabase email confirmation and password reset links return to the page that initiated the request.

## Subscription checkout setup

Subscription checkout uses Stripe Checkout in subscription mode. Copy `.env.example` to `.env`, replace `STRIPE_SECRET_KEY` with a Stripe test-mode secret key, then run `npm install` and `npm start`. Open `http://localhost:3001/pages/subscriptions.html`. The secret key stays on the server and must never be added to browser JavaScript or committed. Set `SITE_URL` to the deployed site origin for production. Switch to a live Stripe key only after configuring and testing the live account.

The Basic, Standard, Premium, and VIP plans are annual Stripe subscriptions. Galactic is offered as custom pricing because its displayed amount exceeds Stripe's supported checkout amount. Successful checkout is verified against Stripe when the customer returns to the site.