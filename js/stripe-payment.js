document.addEventListener('DOMContentLoaded', function () {
  // Associer chaque bouton à son type d'abonnement
  const plans = {
    'weekly-subscription': 'weekly',
    'monthly-subscription': 'monthly',
    'yearly-subscription': 'yearly',
    'lifetime-subscription': 'lifetime',
  };

  Object.keys(plans).forEach(function (id) {
    const card = document.getElementById(id);
    if (card) {
      const btn = card.querySelector('button.btn-nav');
      if (btn) {
        btn.addEventListener('click', function () {
          startStripeCheckout(plans[id]);
        });
      }
    }
  });
});

function startStripeCheckout(plan) {
  fetch('/api/payment/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan }),
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (session) {
      if (session.id) {
        const stripe = Stripe('pk_test_XXXXXXXXXXXXXXXXXXXXXXXX'); // Remplacer par votre clé publique Stripe
        stripe.redirectToCheckout({ sessionId: session.id });
      } else {
        alert('Erreur lors de la création de la session de paiement.');
      }
    })
    .catch(function (error) {
      alert('Erreur de connexion au serveur.');
    });
} 