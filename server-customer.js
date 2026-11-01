import express from 'express';

function sendDatabaseError(response, operation, error) {
  console.error(`Customer ${operation} failed:`, error.message);
  response.status(503).json({ error: `Could not ${operation}. Please try again.` });
}

export function createCustomerService({ database, requireApiAuth, requireSameOriginJson }) {
  const router = express.Router();
  router.use(requireApiAuth);
  router.use((request, response, next) => {
    if (!database) {
      response.status(503).json({ error: 'Customer data requires the Supabase database to be configured.' });
      return;
    }
    next();
  });

  router.get('/profile', async (request, response) => {
    try {
      const { data, error } = await database.from('profiles')
        .select('id, display_name, avatar_url, created_at, updated_at')
        .eq('id', request.authUser.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        response.status(404).json({ error: 'Profile not found. Apply the Gaming Hub database migrations.' });
        return;
      }
      response.set('Cache-Control', 'no-store');
      response.json({ profile: data });
    } catch (error) {
      sendDatabaseError(response, 'load profile', error);
    }
  });

  router.patch('/profile', requireSameOriginJson, async (request, response) => {
    const displayName = request.body?.displayName;
    if (typeof displayName !== 'string' || displayName.trim().length < 1 ||
        displayName.trim().length > 80) {
      response.status(400).json({ error: 'Enter a display name between 1 and 80 characters.' });
      return;
    }
    try {
      const { data, error } = await database.from('gaming_hub_accounts')
        .update({ display_name: displayName.trim() })
        .eq('id', request.authUser.id)
        .select('id, email, display_name, role')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        response.status(404).json({ error: 'Account not found.' });
        return;
      }
      response.set('Cache-Control', 'no-store');
      response.json({
        profile: {
          id: data.id,
          display_name: data.display_name,
          updated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      sendDatabaseError(response, 'update profile', error);
    }
  });

  router.get('/orders', async (request, response) => {
    try {
      const { data, error } = await database.from('orders')
        .select('id, stripe_session_id, amount_total, currency, status, items, created_at')
        .eq('account_id', request.authUser.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      response.set('Cache-Control', 'no-store');
      response.json({ orders: data });
    } catch (error) {
      sendDatabaseError(response, 'load order history', error);
    }
  });

  router.get('/subscriptions', async (request, response) => {
    try {
      const { data, error } = await database.from('subscriptions')
        .select('id, plan_id, status, current_period_end, created_at')
        .eq('account_id', request.authUser.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      response.set('Cache-Control', 'no-store');
      response.json({ subscriptions: data });
    } catch (error) {
      sendDatabaseError(response, 'load subscriptions', error);
    }
  });

  return { router };
}

export function createCatalogService({ database }) {
  const router = express.Router();
  const catalogs = {
    games: {
      table: 'games',
      columns: 'id, slug, name, description, category, image_url, is_featured, sort_order',
      orderColumn: 'sort_order'
    },
    products: {
      table: 'products',
      columns: 'id, slug, name, description, category, price_pence, currency, image_url, sort_order',
      orderColumn: 'sort_order'
    },
    'subscription-plans': {
      table: 'subscription_plans',
      columns: 'id, name, description, price_pence, billing_interval, sort_order',
      orderColumn: 'sort_order'
    }
  };

  for (const [route, catalog] of Object.entries(catalogs)) {
    router.get(`/${route}`, async (request, response) => {
      if (!database) {
        response.status(503).json({ error: 'The catalog database is not configured.' });
        return;
      }
      try {
        const { data, error } = await database.from(catalog.table)
          .select(catalog.columns)
          .eq('is_active', true)
          .order(catalog.orderColumn, { ascending: true })
          .limit(200);
        if (error) throw error;
        response.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        response.json({ [route]: data });
      } catch (error) {
        sendDatabaseError(response, `load ${route}`, error);
      }
    });
  }

  return { router };
}
