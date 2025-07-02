// Initialisation de Stripe
const stripe = Stripe('pk_test_51RaFCyGgrzhDdrFXdlp3baVtIuc1YfROuZohCtcXAt1pn6zrM2xDEKMMWpG93EUxGDDSEtukIsaXE9SG28Fb9Kjf00fszAQHFp');

// Fonction pour démarrer le processus de paiement
async function startPayment(priceId) {
  try {
    // Créer la session de paiement
    const response = await fetch('/payment/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ priceId }),
    });

    const { sessionId } = await response.json();

    // Rediriger vers la page de paiement Stripe
    const result = await stripe.redirectToCheckout({
      sessionId,
    });

    if (result.error) {
      console.error('Erreur lors de la redirection:', result.error);
      alert('Une erreur est survenue lors du processus de paiement.');
    }
  } catch (error) {
    console.error('Erreur lors du démarrage du paiement:', error);
    alert('Une erreur est survenue lors du processus de paiement.');
  }
}

// Fonction pour afficher les prix des abonnements
async function displayPrices() {
  try {
    const response = await fetch('/payment/prices');
    const prices = await response.json();

    // Mettre à jour l'interface avec les prix
    const weeklyPrice = document.getElementById('weekly-price');
    const monthlyPrice = document.getElementById('monthly-price');
    const yearlyPrice = document.getElementById('yearly-price');
    const lifetimePrice = document.getElementById('lifetime-price');

    if (weeklyPrice) {
      weeklyPrice.textContent = `${prices.weekly.amount}€/semaine`;
    }
    if (monthlyPrice) {
      monthlyPrice.textContent = `${prices.monthly.amount}€/mois`;
    }
    if (yearlyPrice) {
      yearlyPrice.textContent = `${prices.yearly.amount}€/an`;
    }
    if (lifetimePrice) {
      lifetimePrice.textContent = `${prices.lifetime.amount}€`;
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des prix:', error);
  }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  // Afficher les prix au chargement de la page
  displayPrices();

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
        const stripe = Stripe('pk_test_51RaFCyGgrzhDdrFXdlp3baVtIuc1YfROuZohCtcXAt1pn6zrM2xDEKMMWpG93EUxGDDSEtukIsaXE9SG28Fb9Kjf00fszAQHFp');
        stripe.redirectToCheckout({ sessionId: session.id });
      } else {
        alert('Erreur lors de la création de la session de paiement.');
      }
    })
    .catch(function (error) {
      alert('Erreur de connexion au serveur.');
    });
} 