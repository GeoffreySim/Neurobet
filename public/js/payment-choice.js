document.addEventListener('DOMContentLoaded', function () {
  let selectedPlan = 'weekly'; // Par défaut, la première offre est sélectionnée
  let selectedPaymode = null;

  // Sélection de l'offre
  document.querySelectorAll('.abo-card-choice').forEach(card => {
    card.addEventListener('click', function () {
      document.querySelectorAll('.abo-card-choice').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedPlan = card.id.replace('-subscription', '');
      // Reset paiement
      document.querySelectorAll('.pay-card-choice').forEach(c => c.classList.remove('active'));
      selectedPaymode = null;
      document.getElementById('stripe-pay-section').style.display = 'none';
    });
  });

  // Sélection du moyen de paiement
  document.querySelectorAll('.pay-card-choice').forEach(card => {
    card.addEventListener('click', function () {
      if (!selectedPlan) {
        alert('Sélectionnez d\'abord une formule d\'abonnement.');
        return;
      }
      document.querySelectorAll('.pay-card-choice').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedPaymode = card.dataset.paymode;
      if (selectedPaymode === 'card') {
        document.getElementById('stripe-pay-section').style.display = 'block';
        document.getElementById('paypal-pay-section').style.display = 'none';
        document.getElementById('crypto-pay-section').style.display = 'none';
      } else if (selectedPaymode === 'paypal') {
        document.getElementById('stripe-pay-section').style.display = 'none';
        document.getElementById('paypal-pay-section').style.display = 'block';
        document.getElementById('crypto-pay-section').style.display = 'none';
        renderPayPalButton(selectedPlan);
      } else if (selectedPaymode === 'crypto') {
        document.getElementById('stripe-pay-section').style.display = 'none';
        document.getElementById('paypal-pay-section').style.display = 'none';
        document.getElementById('crypto-pay-section').style.display = 'block';
      } else {
        document.getElementById('stripe-pay-section').style.display = 'none';
        document.getElementById('paypal-pay-section').style.display = 'none';
        document.getElementById('crypto-pay-section').style.display = 'none';
      }
    });
  });

  // Fonction pour afficher le bouton PayPal avec le bon montant
  function renderPayPalButton(plan) {
    // Détruire le bouton précédent si besoin
    const container = document.getElementById('paypal-button-container');
    container.innerHTML = '';
    // Définir le montant selon l'offre
    const prices = {
      weekly: 9,
      monthly: 29,
      yearly: 299,
      lifetime: 499
    };
    const amount = prices[plan] || 9;
    // Rendre le bouton PayPal
    paypal.Buttons({
      style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'paypal' },
      createOrder: function(data, actions) {
        return actions.order.create({
          purchase_units: [{ amount: { value: amount.toString(), currency_code: 'EUR' } }]
        });
      },
      onApprove: function(data, actions) {
        return actions.order.capture().then(function(details) {
          window.location.href = '/payment/success';
        });
      },
      onCancel: function(data) {
        window.location.href = '/payment/cancel';
      },
      onError: function(err) {
        alert('Erreur PayPal : ' + err);
      }
    }).render('#paypal-button-container');
  }

  // Paiement Stripe
  document.getElementById('stripe-pay-btn').addEventListener('click', function () {
    if (!selectedPlan) {
      alert('Sélectionnez une formule d\'abonnement.');
      return;
    }
    fetch('/api/payment/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan: selectedPlan }),
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
  });

  // Paiement Crypto Coinbase Commerce
  document.getElementById('crypto-pay-btn').addEventListener('click', function () {
    if (!selectedPlan) {
      alert('Sélectionnez une formule d\'abonnement.');
      return;
    }
    const links = {
      weekly: 'https://commerce.coinbase.com/checkout/6a1da534-5117-441c-b800-45e2e6e39ee9',
      monthly: 'https://commerce.coinbase.com/checkout/5bc194d2-52d4-4c1d-ab6d-deec9d9c3071',
      yearly: 'https://commerce.coinbase.com/checkout/d7987c28-c519-4a03-8fef-c4a55c5cfbdd',
      lifetime: 'https://commerce.coinbase.com/checkout/d6c60277-2b75-4b7d-b4df-a79613c2765a'
    };
    const url = links[selectedPlan] || links.weekly;
    window.location.href = url;
  });

  // Sélectionne la première offre par défaut
  document.querySelector('.abo-card-choice').classList.add('active');

  document.getElementById('stripe-pay-btn').textContent = 'Payer';
}); 