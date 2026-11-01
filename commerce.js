const stripeMaximumUnitAmount = 99_999_999n;

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
