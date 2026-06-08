const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, email } = req.body;
    if (!userId || !email) {
      return res.status(400).json({ error: 'userId and email are required parameters.' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    
    // Resolve Stripe Price ID
    let priceId = process.env.STRIPE_PRICE_ID;

    // Self-healing: if no custom price ID is configured, query/create it dynamically on this Stripe account
    if (!priceId || priceId === 'price_1Tg9mtHcC62WgOkjTrYcd1Oa') {
      const prices = await stripe.prices.list({
        lookup_keys: ['antigravitylifts_monthly'],
        active: true,
        limit: 1
      });

      if (prices.data.length > 0) {
        priceId = prices.data[0].id;
      } else {
        // Create product
        const product = await stripe.products.create({
          name: 'AntigravityLifts Premium',
          description: 'Unlock anti-gravity strength with unlimited custom templates, streak badges, PR tracking, and cloud sync.'
        });

        // Create price
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: 499,
          currency: 'usd',
          recurring: { interval: 'month' },
          lookup_key: 'antigravitylifts_monthly',
          transfer_lookup_key: true
        });

        priceId = price.id;
        console.log(`Self-healed: Automatically created product & price ${priceId} on Stripe account.`);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          user_id: userId,
        },
      },
      client_reference_id: userId,
      customer_email: email,
      success_url: `${origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return res.status(500).json({ error: err.message });
  }
};
