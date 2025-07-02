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
  
  try {
    // Vérifier la signature du webhook
    const event = verifyWebhookSignature(req.body, sig);
    
    // Traiter l'événement
    await handleWebhook(event);
    
    res.json({ received: true });
  } catch (error) {
    console.error('Erreur lors du traitement du webhook:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
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