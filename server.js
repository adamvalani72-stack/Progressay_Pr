import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProductCatalog, membershipPlans, validateCheckoutItems } from './commerce.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const siteUrl = (process.env.SITE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_')
  ? new Stripe(stripeKey)
  : null;
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const checkoutEnabled = process.env.STRIPE_CHECKOUT_ENABLED === 'true';
const livePaymentsEnabled = process.env.ENABLE_LIVE_PAYMENTS === 'true';
const productCatalogPromise = loadProductCatalog();
const contactRequests = new Map();
const giftCardLookups = new Map();

app.disable('x-powered-by');
app.use(function (request, response, next) {
  response.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY'
  });
  next();
});

function requireConfiguredCommerce(response) {
  if (!checkoutEnabled || !stripe || !webhookSecret || !supabase) {
    response.status(503).json({
      error: 'Checkout is not configured. Set up Stripe Checkout, its webhook, and the Supabase service role key.'
    });
    return false;
  }
  if (stripeKey.startsWith('sk_live_') && !livePaymentsEnabled) {
    response.status(503).json({ error: 'Live payments are disabled until explicitly enabled in the server environment.' });
    return false;
  }
  if (stripeKey.startsWith('sk_test_') && livePaymentsEnabled) {
    response.status(503).json({ error: 'Live payments cannot be enabled with a Stripe test key.' });
    return false;
  }
  return true;
}

function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function rateLimitContact(request) {
  const now = Date.now();
  const key = request.ip || request.socket.remoteAddress || 'unknown';
  const recent = (contactRequests.get(key) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(now);
  contactRequests.set(key, recent);
  return true;
}

function rateLimitGiftCardLookup(request) {
  const now = Date.now();
  const key = request.ip || request.socket.remoteAddress || 'unknown';
  const recent = (giftCardLookups.get(key) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 10) return false;
  recent.push(now);
  giftCardLookups.set(key, recent);
  return true;
}

app.post('/api/stripe-webhook', express.raw({ type: 'application/json', limit: '1mb' }), async function (request, response) {
  if (!stripe || !webhookSecret || !supabase) {
    response.sendStatus(503);
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(request.body, request.headers['stripe-signature'], webhookSecret);
  } catch {
    response.status(400).send('Invalid webhook signature.');
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'subscription') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const { error } = await supabase.from('memberships').upsert({
          stripe_subscription_id: subscription.id,
          stripe_customer_id: String(session.customer || ''),
          plan_id: session.metadata?.plan_id || subscription.metadata?.plan_id || '',
          customer_email: session.customer_details?.email || session.customer_email || '',
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
        }, { onConflict: 'stripe_subscription_id' });
        if (error) throw error;
      } else if (session.mode === 'payment' && session.payment_status === 'paid') {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
        const { error } = await supabase.from('orders').upsert({
          stripe_session_id: session.id,
          stripe_customer_id: String(session.customer || ''),
          customer_email: session.customer_details?.email || session.customer_email || '',
          amount_total: session.amount_total,
          currency: session.currency,
          status: 'paid',
          items: lineItems.data.map((item) => ({
            name: item.description || item.price?.product?.name || 'Product',
            quantity: item.quantity || 1,
            amount_total: item.amount_total
          })),
          shipping_details: session.shipping_details || null
        }, { onConflict: 'stripe_session_id' });
        if (error) throw error;
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const { error } = await supabase.from('memberships').update({
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
      }).eq('stripe_subscription_id', subscription.id);
      if (error) throw error;
    }
    response.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error.message);
    response.sendStatus(500);
  }
});

app.use(express.json({ limit: '10kb' }));

app.get('/api/health', function (request, response) {
  response.json({ status: 'ok' });
});

app.get('/api/auth-config', function (request, response) {
  response.set('Cache-Control', 'no-store');
  response.json({
    projectUrl: supabaseUrl,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || ''
  });
});

app.post('/api/gift-cards/balance', async function (request, response) {
  if (!supabase) {
    response.status(503).json({ error: 'Gift card balance lookup is not configured yet.' });
    return;
  }
  if (!rateLimitGiftCardLookup(request)) {
    response.status(429).json({ error: 'Too many balance checks. Please try again later.' });
    return;
  }

  const code = request.body?.code;
  if (typeof code !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(code.trim())) {
    response.status(400).json({ error: 'Enter a valid gift card code.' });
    return;
  }

  const codeHash = createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  const { data, error } = await supabase.from('gift_cards')
    .select('id, balance_pence, last_four, status, expires_at')
    .eq('code_hash', codeHash)
    .maybeSingle();
  if (error) {
    console.error('Gift card lookup failed:', error.message);
    response.status(503).json({ error: 'Gift card balance lookup failed. Please try again later.' });
    return;
  }
  if (!data || data.status !== 'active' ||
      (data.expires_at && new Date(data.expires_at).getTime() < Date.now())) {
    response.status(404).json({ error: 'This gift card could not be verified. Check the code and try again.' });
    return;
  }
  response.set('Cache-Control', 'no-store');
  response.json({
    cardId: data.id,
    lastFour: data.last_four,
    balancePence: Number(data.balance_pence),
    currency: 'GBP',
    checkedAt: new Date().toISOString()
  });
});

app.post('/api/checkout-session', async function (request, response) {
  if (!requireConfiguredCommerce(response)) return;
  if (!isValidEmail(request.body?.email)) {
    response.status(400).json({ error: 'Enter a valid email address for your order.' });
    return;
  }

  try {
    const catalog = await productCatalogPromise;
    const items = validateCheckoutItems(request.body.items, catalog);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      automatic_payment_methods: { enabled: true },
      customer_email: request.body.email.trim(),
      line_items: items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: 'gbp',
          unit_amount: item.pricePence,
          product_data: { name: item.name }
        }
      })),
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['GB', 'US', 'CA', 'AU', 'DE'] },
      success_url: `${siteUrl}/pages/gaming-products.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pages/gaming-products.html?checkout=cancelled`,
      metadata: { kind: 'product' }
    });
    response.json({ url: session.url });
  } catch (error) {
    const status = /cart|product|price|item|quantity|choose/i.test(error.message) ? 400 : 502;
    response.status(status).json({ error: status === 400 ? error.message : 'Could not start secure checkout. Please try again.' });
  }
});

app.post('/api/membership-checkout', async function (request, response) {
  if (!requireConfiguredCommerce(response)) return;
  const planId = request.body?.planId;
  const plan = membershipPlans[planId];
  if (!plan) {
    response.status(400).json({ error: 'Choose a valid paid membership plan.' });
    return;
  }
  if (!isValidEmail(request.body?.email)) {
    response.status(400).json({ error: 'Enter a valid email address for your membership.' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      automatic_payment_methods: { enabled: true },
      customer_email: request.body.email.trim(),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: Number(plan.pricePence),
          recurring: { interval: 'year' },
          product_data: { name: `${plan.name} Gaming Hub membership` }
        }
      }],
      success_url: `${siteUrl}/pages/subscriptions.html?plan=${encodeURIComponent(planId)}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pages/subscriptions.html?plan=${encodeURIComponent(planId)}&checkout=cancelled`,
      metadata: { kind: 'membership', plan_id: planId },
      subscription_data: { metadata: { plan_id: planId } }
    });
    response.json({ url: session.url });
  } catch (error) {
    console.error('Membership checkout could not be created:', error.message);
    response.status(502).json({ error: 'Could not start secure checkout. Please try again.' });
  }
});

app.get('/api/checkout-session/:id', async function (request, response) {
  if (!stripe || !/^[a-zA-Z0-9_]{10,255}$/.test(request.params.id)) {
    response.status(404).json({ error: 'Checkout session not found.' });
    return;
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(request.params.id);
    response.json({
      status: session.status,
      paymentStatus: session.payment_status,
      mode: session.mode,
      planId: session.metadata?.plan_id || null
    });
  } catch {
    response.status(404).json({ error: 'Checkout session not found.' });
  }
});

app.post('/api/contact', async function (request, response) {
  if (!supabase) {
    response.status(503).json({ error: 'Contact messages are temporarily unavailable. Please email adamvalani72@gmail.com.' });
    return;
  }
  if (!rateLimitContact(request)) {
    response.status(429).json({ error: 'Too many messages. Please try again later.' });
    return;
  }

  const { name, email, message, company } = request.body || {};
  if (company) {
    response.json({ received: true });
    return;
  }
  if (typeof name !== 'string' || name.trim().length < 1 || name.length > 80 ||
      !isValidEmail(email) || typeof message !== 'string' || message.trim().length < 1 || message.length > 1000) {
    response.status(400).json({ error: 'Enter a name, a valid email address, and a message under 1,000 characters.' });
    return;
  }

  const { error } = await supabase.from('contact_messages').insert({
    name: name.trim(),
    email: email.trim(),
    message: message.trim()
  });
  if (error) {
    console.error('Contact message could not be saved:', error.message);
    response.status(503).json({ error: 'Your message could not be saved. Please try again later.' });
    return;
  }
  response.status(201).json({ received: true });
});

app.get('/api/reviews', async function (request, response) {
  if (!supabase) {
    response.status(503).json({ error: 'Reviews are temporarily unavailable.' });
    return;
  }
  const { data, error } = await supabase.from('reviews')
    .select('id, display_name, rating, review, verified_purchase, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) {
    response.status(503).json({ error: 'Reviews are temporarily unavailable.' });
    return;
  }
  response.json({ reviews: data });
});

app.post('/api/reviews', async function (request, response) {
  if (!supabase) {
    response.status(503).json({ error: 'Review submissions are temporarily unavailable.' });
    return;
  }
  const authorization = request.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) {
    response.status(401).json({ error: 'Sign in to submit a review.' });
    return;
  }
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user) {
    response.status(401).json({ error: 'Sign in again to submit a review.' });
    return;
  }

  const { rating, review } = request.body || {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 ||
      typeof review !== 'string' || review.trim().length < 10 || review.length > 1000) {
    response.status(400).json({ error: 'Choose a rating and write a review between 10 and 1,000 characters.' });
    return;
  }
  const displayName = String(userData.user.user_metadata?.display_name || userData.user.email || 'Gaming Hub member')
    .slice(0, 80);
  const { error } = await supabase.from('reviews').insert({
    user_id: userData.user.id,
    display_name: displayName,
    rating,
    review: review.trim(),
    status: 'pending'
  });
  if (error) {
    response.status(503).json({ error: 'Your review could not be submitted. Please try again.' });
    return;
  }
  response.status(201).json({ submitted: true });
});

app.use(function (request, response, next) {
  if (['/server.js', '/package.json', '/package-lock.json', '/commerce.js'].includes(request.path)) {
    response.sendStatus(404);
    return;
  }
  next();
});

app.use(express.static(rootDirectory, { dotfiles: 'deny' }));

app.listen(port, function () {
  console.log(`Gaming Hub is running at ${siteUrl}`);
});
