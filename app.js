const express = require('express');
const path = require('path');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3000;

// Routes de succès/annulation Stripe AVANT le static
app.get('/payment/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment-success.html'));
});
app.get('/payment/cancel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment-cancel.html'));
});

// Pour parser le JSON
app.use(express.json());
// Pour parser le raw body sur les webhooks Stripe
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
// Routes API paiement
app.use('/api/payment', paymentRoutes);
// Servir les fichiers statiques (HTML, CSS, JS, images...)
app.use(express.static(path.join(__dirname, 'public')));
// Rediriger / vers index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
}); 