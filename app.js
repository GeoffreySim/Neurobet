const express = require('express');
const path = require('path');
const paymentRoutes = require('./routes/payment');
const session = require('express-session');
const paypalSdk = require('@paypal/checkout-server-sdk');
const { client: paypalClient } = require('./config/paypal');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Création automatique de la table site_visits si elle n'existe pas
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_visits (
        id SERIAL PRIMARY KEY,
        visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table site_visits vérifiée/créée avec succès.');
  } catch (e) {
    console.error('Erreur lors de la création de la table site_visits :', e.message);
  }
})();

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
    await pool.query('INSERT INTO site_visits DEFAULT VALUES');
  } catch (e) {
    console.error('Erreur enregistrement visite:', e.message);
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
    // Visites aujourd'hui
    const today = await pool.query(
      `SELECT COUNT(*) FROM site_visits WHERE visited_at::date = CURRENT_DATE`
    );
    // Visites ce mois-ci
    const month = await pool.query(
      `SELECT COUNT(*) FROM site_visits WHERE date_trunc('month', visited_at) = date_trunc('month', CURRENT_DATE)`
    );
    // Visites par jour sur les 30 derniers jours
    const byDay = await pool.query(
      `SELECT visited_at::date AS day, COUNT(*) AS count
       FROM site_visits
       WHERE visited_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY day
       ORDER BY day DESC`
    );
    // Utilisateurs inscrits
    const users = await pool.query('SELECT COUNT(*) FROM users');
    // Paiements/transactions
    const transactions = await pool.query('SELECT COUNT(*) FROM transactions');
    res.json({
      visits_today: today.rows[0].count,
      visits_month: month.rows[0].count,
      visits_by_day: byDay.rows,
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