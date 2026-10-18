import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const stripeMaximumUnitAmount = 99_999_999n;

export const membershipPlans = Object.freeze({
  basic: { name: 'Basic', pricePence: 999n },
  standard: { name: 'Standard', pricePence: 2_999n },
  premium: { name: 'Premium', pricePence: 7_999n },
  vip: { name: 'VIP', pricePence: 39_999n },
  galactic: { name: 'Galactic', pricePence: 50_000n },
  'galactic-plus': { name: 'Galactic Plus', pricePence: 100_000n },
  'galactic-plus-plus': { name: 'Galactic Plus Plus', pricePence: 1_000_000n },
  ultimate: { name: 'Ultimate', pricePence: 2_500_000n },
  'ultimate-pro': { name: 'Ultimate Pro', pricePence: 5_000_000n },
  'ultimate-elite': { name: 'Ultimate Elite', pricePence: 7_500_000n },
  'ultimate-peak': { name: 'Ultimate Peak', pricePence: 10_000_000n }
});

function decodeHtmlAttribute(value) {
  return value.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
}

function readAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decodeHtmlAttribute(match[1]) : null;
}

export function poundsToPence(value) {
  const amount = String(value).trim().replace(/,/g, '');
  const match = amount.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error('Invalid GBP amount in product catalog.');
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0');
}

export async function loadProductCatalog() {
  const html = await readFile(path.join(rootDirectory, 'pages/gaming-products.html'), 'utf8');
  const products = new Map();

  for (const [tag] of html.matchAll(/<button\b[^>]*\badd-to-cart\b[^>]*>/gi)) {
    const name = readAttribute(tag, 'data-name');
    const rawPrice = readAttribute(tag, 'data-price');
    const rawPricePence = readAttribute(tag, 'data-price-pence');
    if (!name || (!rawPrice && !rawPricePence)) continue;
    if (products.has(name)) throw new Error(`Duplicate product name in catalog: ${name}`);

    const pricePence = rawPricePence === null
      ? poundsToPence(rawPrice)
      : BigInt(rawPricePence);
    products.set(name, { name, pricePence });
  }

  if (products.size === 0) throw new Error('The product catalog is empty.');
  return products;
}

export function validateCheckoutItems(items, catalog, { subscriptions = false } = {}) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    throw new Error('Choose between 1 and 20 items to check out.');
  }

  return items.map((item) => {
    if (!item || typeof item.name !== 'string' || !Number.isInteger(item.quantity) ||
        item.quantity < 1 || item.quantity > 10) {
      throw new Error('The cart contains an invalid item or quantity.');
    }

    const product = catalog.get(item.name);
    if (!product) throw new Error('The cart contains an unavailable product.');
    if (product.pricePence <= 0n || product.pricePence > stripeMaximumUnitAmount) {
      throw new Error(`Checkout is unavailable for ${product.name} until its price is reviewed.`);
    }
    return {
      name: product.name,
      quantity: item.quantity,
      pricePence: Number(product.pricePence),
      type: subscriptions ? 'subscription' : 'product'
    };
  });
}
