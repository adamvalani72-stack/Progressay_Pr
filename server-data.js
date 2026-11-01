import express from 'express';
import { createHash, randomBytes } from 'node:crypto';

const pageSizeDefault = 25;
const pageSizeMaximum = 100;
const giftCardMaximumBalancePence = 99_999_999;

const collections = {
  accounts: {
    table: 'gaming_hub_accounts',
    columns: 'id, email, display_name, role, created_at',
    searchColumn: 'email',
    filterColumn: 'role',
    filterValues: ['member', 'owner']
  },
  profiles: {
    table: 'profiles',
    columns: 'id, display_name, avatar_url, created_at, updated_at',
    searchColumn: 'display_name'
  },
  games: {
    table: 'games',
    columns: 'id, slug, name, description, category, image_url, is_featured, is_active, sort_order, created_at, updated_at',
    searchColumn: 'name',
    filterColumn: 'is_active',
    filterValues: ['true', 'false']
  },
  products: {
    table: 'products',
    columns: 'id, slug, name, description, category, price_pence, currency, image_url, is_active, sort_order, created_at, updated_at',
    searchColumn: 'name',
    filterColumn: 'is_active',
    filterValues: ['true', 'false']
  },
  'subscription-plans': {
    table: 'subscription_plans',
    columns: 'id, name, description, price_pence, billing_interval, is_active, sort_order, created_at, updated_at',
    searchColumn: 'name',
    filterColumn: 'is_active',
    filterValues: ['true', 'false']
  },
  orders: {
    table: 'orders',
    columns: 'id, stripe_session_id, customer_email, amount_total, currency, status, items, created_at',
    searchColumn: 'customer_email',
    filterColumn: 'status'
  },
  memberships: {
    table: 'memberships',
    columns: 'id, stripe_subscription_id, customer_email, plan_id, status, current_period_end, created_at',
    searchColumn: 'customer_email',
    filterColumn: 'status'
  },
  'gift-cards': {
    table: 'gift_cards',
    columns: 'id, last_four, initial_balance_pence, balance_pence, status, expires_at, created_at',
    filterColumn: 'status',
    filterValues: ['active', 'disabled', 'redeemed']
  },
  'contact-messages': {
    table: 'contact_messages',
    columns: 'id, name, email, message, created_at',
    searchColumn: 'email'
  },
  reviews: {
    table: 'reviews',
    columns: 'id, display_name, rating, review, status, verified_purchase, created_at',
    searchColumn: 'display_name',
    filterColumn: 'status',
    filterValues: ['pending', 'approved', 'rejected']
  }
};

function parsePagination(query) {
  const rawLimit = query.limit ?? String(pageSizeDefault);
  const rawOffset = query.offset ?? '0';
  if (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit) ||
      typeof rawOffset !== 'string' || !/^\d+$/.test(rawOffset)) {
    return null;
  }
  const limit = Number(rawLimit);
  const offset = Number(rawOffset);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > pageSizeMaximum ||
      !Number.isSafeInteger(offset) || offset > 1_000_000) {
    return null;
  }
  return { limit, offset };
}

function isValidSearch(value) {
  return typeof value === 'string' && value.length <= 100 &&
    /^[a-zA-Z0-9@._+ -]*$/.test(value);
}

function isValidRecordId(value) {
  return /^[a-f0-9]{32}$/.test(value) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isValidSlug(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isValidCatalogImage(value) {
  return value === null || value === undefined ||
    (typeof value === 'string' && value.startsWith('/img/') &&
      !value.split('/').includes('..') && !value.includes('\\') &&
      !/[?#\u0000-\u001f]/.test(value) && value.length <= 500);
}

function catalogRow(kind, body) {
  const needsCategory = kind !== 'subscription-plans';
  if (!body || !isValidSlug(body.slug) ||
      typeof body.name !== 'string' || body.name.trim().length < 1 ||
      body.name.trim().length > (kind === 'subscription-plans' ? 80 : 200) ||
      typeof body.description !== 'string' || body.description.length > 2000 ||
      (needsCategory && (typeof body.category !== 'string' ||
        body.category.trim().length < 1 || body.category.trim().length > 60)) ||
      !isValidCatalogImage(body.imageUrl) ||
      (body.isActive !== undefined && typeof body.isActive !== 'boolean') ||
      (body.sortOrder !== undefined &&
        (!Number.isSafeInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 10000))) {
    return null;
  }
  const common = {
    name: body.name.trim(),
    description: body.description.trim(),
    is_active: body.isActive !== false,
    sort_order: body.sortOrder ?? 0,
    updated_at: new Date().toISOString()
  };
  if (kind === 'games') {
    if (typeof body.isFeatured !== 'boolean') return null;
    return {
      ...common,
      slug: body.slug,
      category: body.category.trim(),
      image_url: body.imageUrl || null,
      is_featured: body.isFeatured
    };
  }
  if (kind === 'products') {
    const price = typeof body.pricePence === 'number' && Number.isSafeInteger(body.pricePence)
      ? String(body.pricePence)
      : body.pricePence;
    if (typeof price !== 'string' || !/^\d{1,42}$/.test(price)) return null;
    return {
      ...common,
      slug: body.slug,
      category: body.category.trim(),
      image_url: body.imageUrl || null,
      price_pence: price,
      currency: 'GBP'
    };
  }
  if (kind === 'subscription-plans') {
    const price = typeof body.pricePence === 'number' && Number.isSafeInteger(body.pricePence)
      ? body.pricePence
      : typeof body.pricePence === 'string' && /^\d{1,8}$/.test(body.pricePence)
        ? Number(body.pricePence)
        : NaN;
    if (!Number.isSafeInteger(price) || price < 0 || price > 99_999_999 ||
        body.billingInterval !== 'year') return null;
    return {
      id: body.slug,
      name: body.name.trim(),
      description: body.description.trim(),
      price_pence: price,
      billing_interval: 'year',
      is_active: body.isActive !== false,
      sort_order: body.sortOrder ?? 0,
      updated_at: new Date().toISOString()
    };
  }
  return null;
}

function sendDatabaseError(response, operation, error) {
  console.error(`Admin ${operation} failed:`, error.message);
  response.status(503).json({ error: `Could not ${operation}. Please try again.` });
}

export function createDataService({ database, requireOwner, requireSameOriginJson }) {
  const router = express.Router();
  router.use(requireOwner);

  router.use((request, response, next) => {
    if (!database) {
      response.status(503).json({
        error: 'Data management requires the Supabase database to be configured on this server.'
      });
      return;
    }
    next();
  });

  router.get('/overview', async (request, response) => {
    try {
      const entries = await Promise.all(Object.entries(collections).map(async ([name, collection]) => {
        const { count, error } = await database.from(collection.table)
          .select('id', { count: 'exact', head: true });
        if (error) throw error;
        return [name, count ?? 0];
      }));
      response.set('Cache-Control', 'no-store');
      response.json({ counts: Object.fromEntries(entries) });
    } catch (error) {
      sendDatabaseError(response, 'load data overview', error);
    }
  });

  for (const [name, collection] of Object.entries(collections)) {
    router.get(`/${name}`, async (request, response) => {
      const pagination = parsePagination(request.query);
      if (!pagination || (request.query.q !== undefined &&
          (!collection.searchColumn || !isValidSearch(request.query.q))) ||
          (request.query.status !== undefined &&
            (!collection.filterColumn ||
              (collection.filterValues && !collection.filterValues.includes(request.query.status))))) {
        response.status(400).json({ error: 'Enter valid pagination, search, or filter values.' });
        return;
      }

      try {
        let query = database.from(collection.table)
          .select(collection.columns, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(pagination.offset, pagination.offset + pagination.limit - 1);
        if (request.query.q) {
          query = query.ilike(collection.searchColumn, `%${request.query.q}%`);
        }
        if (request.query.status) {
          query = query.eq(collection.filterColumn,
            collection.filterColumn === 'is_active' ? request.query.status === 'true' : request.query.status);
        }
        const { data, count, error } = await query;
        if (error) throw error;
        response.set('Cache-Control', 'no-store');
        response.json({
          items: data,
          pagination: { ...pagination, total: count ?? 0 }
        });
      } catch (error) {
        sendDatabaseError(response, `load ${name}`, error);
      }
    });
  }

  for (const kind of ['games', 'products', 'subscription-plans']) {
    const table = kind === 'subscription-plans' ? 'subscription_plans' : kind;
    router.post(`/${kind}`, requireSameOriginJson, async (request, response) => {
      const row = catalogRow(kind, request.body);
      if (!row) {
        response.status(400).json({ error: `Enter valid ${kind} data, including its slug, name, description, and any required price or category.` });
        return;
      }
      try {
        const { data, error } = await database.from(table).insert(row)
          .select(collections[kind].columns).single();
        if (error) throw error;
        response.status(201).json({ item: data });
      } catch (error) {
        sendDatabaseError(response, `create ${kind.slice(0, -1)}`, error);
      }
    });

    router.patch(`/${kind}/:id`, requireSameOriginJson, async (request, response) => {
      const validId = kind === 'subscription-plans'
        ? isValidSlug(request.params.id)
        : isValidRecordId(request.params.id);
      const row = catalogRow(kind, request.body);
      if (!validId || !row ||
          (kind === 'subscription-plans' && request.body.slug !== request.params.id)) {
        response.status(400).json({ error: `Enter a valid ${kind} ID and valid catalog data.` });
        return;
      }
      delete row.id;
      try {
        const { data, error } = await database.from(table).update(row)
          .eq('id', request.params.id)
          .select(collections[kind].columns).maybeSingle();
        if (error) throw error;
        if (!data) {
          response.status(404).json({ error: `${kind} entry not found.` });
          return;
        }
        response.json({ item: data });
      } catch (error) {
        sendDatabaseError(response, `update ${kind.slice(0, -1)}`, error);
      }
    });

    router.delete(`/${kind}/:id`, requireSameOriginJson, async (request, response) => {
      const validId = kind === 'subscription-plans'
        ? isValidSlug(request.params.id)
        : isValidRecordId(request.params.id);
      if (!validId) {
        response.status(400).json({ error: `Enter a valid ${kind} ID.` });
        return;
      }
      try {
        const { data, error } = await database.from(table)
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', request.params.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          response.status(404).json({ error: `${kind} entry not found.` });
          return;
        }
        response.json({ archived: true });
      } catch (error) {
        sendDatabaseError(response, `archive ${kind.slice(0, -1)}`, error);
      }
    });
  }

  router.patch('/accounts/:id', requireSameOriginJson, async (request, response) => {
    if (!isValidRecordId(request.params.id) ||
        typeof request.body?.displayName !== 'string' ||
        request.body.displayName.trim().length < 1 ||
        request.body.displayName.trim().length > 80) {
      response.status(400).json({ error: 'Enter a valid account ID and display name of 1–80 characters.' });
      return;
    }
    try {
      const { data, error } = await database.from('gaming_hub_accounts')
        .update({ display_name: request.body.displayName.trim() })
        .eq('id', request.params.id)
        .eq('role', 'member')
        .select('id, email, display_name, role, created_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        response.status(404).json({ error: 'Member account not found. Owner accounts cannot be edited here.' });
        return;
      }
      response.json({ account: data });
    } catch (error) {
      sendDatabaseError(response, 'update account', error);
    }
  });

  router.delete('/accounts/:id', requireSameOriginJson, async (request, response) => {
    if (!isValidRecordId(request.params.id)) {
      response.status(400).json({ error: 'Enter a valid account ID.' });
      return;
    }
    try {
      const { data, error } = await database.from('gaming_hub_accounts')
        .delete()
        .eq('id', request.params.id)
        .eq('role', 'member')
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        response.status(404).json({ error: 'Member account not found. Owner accounts cannot be deleted here.' });
        return;
      }
      response.json({ deleted: true });
    } catch (error) {
      sendDatabaseError(response, 'delete account', error);
    }
  });

  router.patch('/reviews/:id', requireSameOriginJson, async (request, response) => {
    const status = request.body?.status;
    if (!isValidRecordId(request.params.id) || !['approved', 'rejected'].includes(status)) {
      response.status(400).json({ error: 'Choose an existing review and set its status to approved or rejected.' });
      return;
    }
    try {
      const { data, error } = await database.from('reviews')
        .update({ status })
        .eq('id', request.params.id)
        .select(collections.reviews.columns)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        response.status(404).json({ error: 'Review not found.' });
        return;
      }
      response.json({ review: data });
    } catch (error) {
      sendDatabaseError(response, 'update review', error);
    }
  });

  router.patch('/gift-cards/:id', requireSameOriginJson, async (request, response) => {
    const status = request.body?.status;
    if (!isValidRecordId(request.params.id) ||
        !['active', 'disabled', 'redeemed'].includes(status)) {
      response.status(400).json({ error: 'Choose an existing gift card and a valid status.' });
      return;
    }
    try {
      const { data, error } = await database.from('gift_cards')
        .update({ status })
        .eq('id', request.params.id)
        .select(collections['gift-cards'].columns)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        response.status(404).json({ error: 'Gift card not found.' });
        return;
      }
      response.json({ giftCard: data });
    } catch (error) {
      sendDatabaseError(response, 'update gift card', error);
    }
  });

  router.post('/gift-cards', requireSameOriginJson, async (request, response) => {
    const balancePence = request.body?.balancePence;
    const expiresAt = request.body?.expiresAt;
    if (!Number.isSafeInteger(balancePence) || balancePence < 1 ||
        balancePence > giftCardMaximumBalancePence ||
        (expiresAt !== undefined &&
          (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt)) ||
            Date.parse(expiresAt) <= Date.now()))) {
      response.status(400).json({ error: 'Enter a positive balance up to £999,999.99 and an optional future expiry date.' });
      return;
    }

    const code = `GH-${randomBytes(16).toString('hex').toUpperCase()}`;
    const codeHash = createHash('sha256').update(code).digest('hex');
    try {
      const { data, error } = await database.from('gift_cards')
        .insert({
          code_hash: codeHash,
          last_four: code.slice(-4),
          initial_balance_pence: balancePence,
          balance_pence: balancePence,
          status: 'active',
          expires_at: expiresAt || null
        })
        .select(collections['gift-cards'].columns)
        .single();
      if (error) throw error;
      response.status(201).json({ giftCard: data, code });
    } catch (error) {
      sendDatabaseError(response, 'create gift card', error);
    }
  });

  router.delete('/contact-messages/:id', requireSameOriginJson, async (request, response) => {
    if (!isValidRecordId(request.params.id)) {
      response.status(400).json({ error: 'Enter a valid contact message ID.' });
      return;
    }
    try {
      const { data, error } = await database.from('contact_messages')
        .delete()
        .eq('id', request.params.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        response.status(404).json({ error: 'Contact message not found.' });
        return;
      }
      response.json({ deleted: true });
    } catch (error) {
      sendDatabaseError(response, 'delete contact message', error);
    }
  });

  return { router };
}
