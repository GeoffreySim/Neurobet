const express = require('express');
const path = require('path');
const paymentRoutes = require('./routes/payment');
const session = require('express-session');
const paypalSdk = require('@paypal/checkout-server-sdk');
const { client: paypalClient } = require('./config/paypal');
const pool = require('./db');

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
app.get('/', async (req, res) => {
  try {
    await pool.query('UPDATE site_counter SET visits = visits + 1 WHERE id = 1');
  } catch (e) {
    console.error('Erreur incrémentation compteur visites:', e.message);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(session({
  secret: 'votre_secret_ultra_complexe',
  resave: false,
  saveUninitialized: false
}));

// Route pour afficher la page de login admin
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Route pour traiter la connexion admin
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'Basket.71') {
    req.session.isAdmin = true;
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

// Middleware de protection admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.redirect('/admin-login');
  }
}

// Protège la page admin
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/api/paypal/create-order', async (req, res) => {
  const request = new paypalSdk.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'EUR',
        value: '10.00' // À adapter selon le montant réel
      }
    }]
  });

  try {
    const order = await paypalClient().execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/api/stats', requireAdmin, async (req, res) => {
  try {
    const pool = require('./db');
    const visits = await pool.query('SELECT visits FROM site_counter WHERE id = 1');
    const users = await pool.query('SELECT COUNT(*) FROM users');
    const transactions = await pool.query('SELECT COUNT(*) FROM transactions');
    res.json({
      visits: visits.rows[0].visits,
      users: users.rows[0].count,
      transactions: transactions.rows[0].count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
}); 