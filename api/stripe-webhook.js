const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to get raw request body for Stripe signature validation
const getRawBody = async (readable) => {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const signature = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const { type, data } = event;

  try {
    if (type === 'checkout.session.completed') {
      const session = data.object;
      const userId = session.client_reference_id;
      const subscriptionId = session.subscription;

      if (!userId) {
        console.warn('Checkout Session completed without a client_reference_id');
        return res.status(200).json({ received: true });
      }

      // Retrieve full subscription details from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      const subData = {
        id: subscription.id,
        user_id: userId,
        status: subscription.status,
        price_id: subscription.items.data[0].price.id,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
      };

      const { error } = await supabase.from('subscriptions').upsert(subData);
      if (error) throw error;
      console.log(`Successfully logged new subscription ${subscription.id} for user ${userId}`);
    } 
    
    else if (type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
      const subscription = data.object;
      const userId = subscription.metadata.user_id;

      if (!userId) {
        // If metadata doesn't have it, look up Stripe customer or retrieve client_reference_id
        console.warn(`Subscription ${subscription.id} updated/deleted without user_id in metadata.`);
        return res.status(200).json({ received: true });
      }

      const subData = {
        id: subscription.id,
        user_id: userId,
        status: subscription.status,
        price_id: subscription.items.data[0].price.id,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
      };

      const { error } = await supabase.from('subscriptions').upsert(subData);
      if (error) throw error;
      console.log(`Successfully updated subscription ${subscription.id} for user ${userId} to status ${subscription.status}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error handling webhook event:', err);
    return res.status(500).send(`Database Error: ${err.message}`);
  }
};

// Disable Vercel's default JSON body parser for raw buffer extraction
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
