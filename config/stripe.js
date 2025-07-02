require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Configuration des webhooks
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Configuration des prix des abonnements
const SUBSCRIPTION_PRICES = {
  weekly: {
    id: 'price_1RalOVGgrzhDdrFX0Ii9bIhB',
    amount: 9.99,
    currency: 'eur',
    interval: 'week'
  },
  monthly: {
    id: 'price_1RalTZGgrzhDdrFX0FnT20Kw',
    amount: 29.99,
    currency: 'eur',
    interval: 'month'
  },
  yearly: {
    id: 'price_1RalURGgrzhDdrFX9bHvuB1i',
    amount: 299.99,
    currency: 'eur',
    interval: 'year'
  },
  lifetime: {
    id: 'price_1RalV1GgrzhDdrFXrsy6gWi1',
    amount: 499.99,
    currency: 'eur',
    oneTime: true
  }
};

// Fonction pour créer une session de paiement
async function createCheckoutSession(priceId, successUrl, cancelUrl) {
  try {
    const price = SUBSCRIPTION_PRICES[priceId];
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      mode: price.oneTime ? 'payment' : 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return session;
  } catch (error) {
    console.error('Erreur lors de la création de la session:', error);
    throw error;
  }
}

// Fonction pour vérifier la signature du webhook
function verifyWebhookSignature(payload, signature) {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      WEBHOOK_SECRET
    );
    return event;
  } catch (error) {
    console.error('Erreur de signature du webhook:', error);
    throw error;
  }
}

// Fonction pour gérer les webhooks
async function handleWebhook(event) {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        // Gérer le paiement réussi
        const session = event.data.object;
        await handleSuccessfulPayment(session);
        break;
      case 'customer.subscription.updated':
        // Gérer la mise à jour de l'abonnement
        const subscription = event.data.object;
        await handleSubscriptionUpdate(subscription);
        break;
      case 'customer.subscription.deleted':
        // Gérer l'annulation de l'abonnement
        const deletedSubscription = event.data.object;
        await handleSubscriptionCancellation(deletedSubscription);
        break;
    }
  } catch (error) {
    console.error('Erreur lors du traitement du webhook:', error);
    throw error;
  }
}

// Fonction pour gérer un paiement réussi
async function handleSuccessfulPayment(session) {
  try {
    // Récupérer les détails de la session
    const sessionDetails = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['customer', 'subscription']
    });

    // Log des informations importantes
    console.log('Paiement réussi:', {
      sessionId: session.id,
      customerId: sessionDetails.customer?.id,
      subscriptionId: sessionDetails.subscription?.id,
      amount: session.amount_total,
      currency: session.currency,
      status: session.status
    });

    // TODO: Mettre à jour votre base de données avec les informations du paiement
    // - Mettre à jour le statut de l'abonnement de l'utilisateur
    // - Enregistrer les détails de la transaction
    // - Envoyer un email de confirmation
  } catch (error) {
    console.error('Erreur lors du traitement du paiement réussi:', error);
    throw error;
  }
}

// Fonction pour gérer la mise à jour d'un abonnement
async function handleSubscriptionUpdate(subscription) {
  try {
    console.log('Abonnement mis à jour:', {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });

    // TODO: Mettre à jour votre base de données
    // - Mettre à jour le statut de l'abonnement
    // - Gérer les renouvellements
    // - Gérer les échecs de paiement
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'abonnement:', error);
    throw error;
  }
}

// Fonction pour gérer l'annulation d'un abonnement
async function handleSubscriptionCancellation(subscription) {
  try {
    console.log('Abonnement annulé:', {
      subscriptionId: subscription.id,
      status: subscription.status,
      canceledAt: new Date(subscription.canceled_at * 1000)
    });

    // TODO: Mettre à jour votre base de données
    // - Marquer l'abonnement comme annulé
    // - Désactiver l'accès aux fonctionnalités premium
    // - Envoyer un email de confirmation d'annulation
  } catch (error) {
    console.error('Erreur lors de l\'annulation de l\'abonnement:', error);
    throw error;
  }
}

module.exports = {
  stripe,
  SUBSCRIPTION_PRICES,
  createCheckoutSession,
  handleWebhook,
  verifyWebhookSignature
}; 