import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 3001);
const siteUrl = (process.env.SITE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const subscriptionPlans = {
  basic: { name: 'Basic', amount: 199 },
  standard: { name: 'Standard', amount: 1099 },
  premium: { name: 'Premium', amount: 19900 },
  vip: { name: 'VIP', amount: 100000 }
};

app.use(express.json({ limit: '10kb' }));

app.get('/api/health', function (request, response) {
  response.json({ stripeConfigured: Boolean(stripe) });
});

app.post('/api/create-checkout-session', async function (request, response) {
  if (!stripe) {
    response.status(503).json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to the server environment.' });
    return;
  }

  const plan = subscriptionPlans[request.body && request.body.plan];
  const email = String(request.body && request.body.email || '').trim();
  if (!plan || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    response.status(400).json({ error: 'Choose a valid plan and enter a valid email address.' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: plan.amount,
          recurring: { interval: 'year' },
          product_data: { name: `Gaming Hub ${plan.name} annual membership` }
        },
        quantity: 1
      }],
      metadata: { plan: request.body.plan },
      subscription_data: { metadata: { plan: request.body.plan } },
      success_url: `${siteUrl}/pages/subscriptions.html?plan=${request.body.plan}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pages/subscriptions.html?plan=${request.body.plan}&checkout=cancelled`
    });

    response.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout session creation failed:', error.message);
    response.status(502).json({ error: 'Secure checkout could not be started. Check the Stripe test key and try again.' });
  }
});

app.get('/api/checkout-session', async function (request, response) {
  if (!stripe) {
    response.status(503).json({ error: 'Stripe is not configured on the server.' });
    return;
  }

  const sessionId = String(request.query.session_id || '');
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    response.status(400).json({ error: 'Invalid checkout session.' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== 'subscription' || session.status !== 'complete' || !session.subscription) {
      response.json({ active: false });
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    response.json({ active: ['active', 'trialing'].includes(subscription.status) });
  } catch (error) {
    console.error('Stripe Checkout session verification failed:', error.message);
    response.status(502).json({ error: 'Could not verify the checkout session.' });
  }
});

app.use(function (request, response, next) {
  if (['/server.js', '/package.json', '/package-lock.json'].includes(request.path)) {
    response.sendStatus(404);
    return;
  }
  next();
});

app.use(express.static(rootDirectory, { dotfiles: 'deny' }));

app.listen(port, function () {
  console.log(`Gaming Hub is running at ${siteUrl}`);
});