const express = require('express');
const path = require('path');
const paymentRoutes = require('./routes/payment');
const session = require('express-session');
const paypalSdk = require('@paypal/checkout-server-sdk');
const { client: paypalClient } = require('./config/paypal');
const pool = require('./db');
const bcrypt = require('bcrypt');

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

// Route d'inscription (API)
app.post('/register', async (req, res) => {
  const { pseudo, email, password } = req.body;
  if (!pseudo || !email || !password) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  try {
    // Vérifie si l'email existe déjà
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }
    // Hash du mot de passe
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (pseudo, email, password, date_inscription, abonnement_actif) VALUES ($1, $2, $3, NOW(), false)',
      [pseudo, email, hash]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Erreur inscription:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de connexion (API)
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  try {
    const result = await pool.query('SELECT id, pseudo, email, password, abonnement_actif FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    // Crée la session utilisateur côté serveur
    req.session.user = {
      id: user.id,
      pseudo: user.pseudo,
      email: user.email,
      abonnement_actif: user.abonnement_actif
    };
    res.json({ success: true });
  } catch (e) {
    console.error('Erreur connexion:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rediriger / vers index.html
app.get('/', async (req, res) => {
  console.log('Route / appelée');
  try {
    await pool.query('INSERT INTO site_visits DEFAULT VALUES');
    console.log('Visite insérée');
  } catch (e) {
    console.error('Erreur enregistrement visite:', e);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Servir les fichiers statiques APRÈS la route '/'
app.use(express.static('public'));

// Route de test pour vérifier la connexion à la base
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, now: result.rows[0].now });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
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

// Middleware pour protéger l'accès aux pronos (clients payants uniquement, durée prise en compte)
async function requirePaidUser(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.email) {
    return res.redirect('/login.html');
  }
  try {
    const result = await pool.query(
      'SELECT abonnement_actif, abonnement_fin, abonnement_type FROM users WHERE email = $1',
      [req.session.user.email]
    );
    const user = result.rows[0];
    const now = new Date();
    if (
      user &&
      user.abonnement_actif &&
      (
        user.abonnement_type === 'lifetime' ||
        (user.abonnement_fin && now < new Date(user.abonnement_fin))
      )
    ) {
      return next();
    }
    // Si expiré, on désactive l'abonnement
    await pool.query(
      'UPDATE users SET abonnement_actif = false WHERE email = $1',
      [req.session.user.email]
    );
  } catch (e) {
    console.error('Erreur vérification abonnement:', e);
  }
  res.redirect('/payment.html');
}

// Exemple : protège la page des pronos
app.get('/pronos', requirePaidUser, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pronos.html'));
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
}); 