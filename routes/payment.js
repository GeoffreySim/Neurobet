const express = require('express');
const router = express.Router();
const { createCheckoutSession, handleWebhook, verifyWebhookSignature, SUBSCRIPTION_PRICES } = require('../config/stripe');

// Route pour créer une session de paiement
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan) {
      return res.status(400).json({ error: 'Plan manquant' });
    }
    const session = await createCheckoutSession(
      plan,
      `${req.protocol}://${req.get('host')}/payment/success`,
      `${req.protocol}://${req.get('host')}/payment/cancel`
    );
    res.json({ id: session.id });
  } catch (error) {
    console.error('Erreur lors de la création de la session:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la session de paiement' });
  }
});

// Route pour gérer les webhooks Stripe
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = verifyWebhookSignature(req.body, sig);
  } catch (err) {
    console.error('Erreur de signature webhook Stripe:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || (session.customer_details && session.customer_details.email);
    const plan = session.metadata && session.metadata.plan;
    let debut = new Date();
    let fin = null;
    if (plan === 'weekly') {
      fin = new Date(debut.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (plan === 'monthly') {
      fin = new Date(debut);
      fin.setMonth(fin.getMonth() + 1);
    } else if (plan === 'yearly') {
      fin = new Date(debut);
      fin.setFullYear(fin.getFullYear() + 1);
    } else if (plan === 'lifetime') {
      fin = null;
    }
    if (email && plan) {
      try {
        await require('../db').query(
          `UPDATE users SET abonnement_actif = true, abonnement_type = $1, abonnement_debut = $2, abonnement_fin = $3 WHERE email = $4`,
          [plan, debut, fin, email]
        );
        // AJOUT : insertion dans transactions
        await require('../db').query(
          `INSERT INTO transactions (user_id, email, montant, devise, abonnement_type, payment_method, payment_id, created_at)
           VALUES (
             (SELECT id FROM users WHERE email = $1),
             $1,
             $2,
             $3,
             $4,
             'stripe',
             $5,
             NOW()
           )`,
          [email, session.amount_total ? session.amount_total / 100 : 0, session.currency || 'EUR', plan, session.id]
        );
      } catch (e) {
        console.error('Erreur lors de l’activation abonnement:', e);
      }
    } else {
      console.warn('Email ou plan non trouvé dans la session Stripe');
    }
  }

  res.json({ received: true });
});

// Route pour récupérer les prix des abonnements
router.get('/prices', (req, res) => {
  res.json(SUBSCRIPTION_PRICES);
});

// Route de succès après paiement
router.get('/success', (req, res) => {
  res.send('Paiement réussi ! Vous allez être redirigé...');
});

// Route d'annulation de paiement
router.get('/cancel', (req, res) => {
  res.send('Paiement annulé. Vous allez être redirigé...');
});

module.exports = router; 