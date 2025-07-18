const express = require('express');
const path = require('path');
const paymentRoutes = require('./routes/payment');
const session = require('express-session');
const paypalSdk = require('@paypal/checkout-server-sdk');
const { client: paypalClient } = require('./config/paypal');
const pool = require('./db');
const bcrypt = require('bcrypt');
const { sendMail } = require('./config/email');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware session placé AVANT toutes les routes
app.use(session({
  secret: 'votre_secret_ultra_complexe',
  resave: false,
  saveUninitialized: false
}));

// Création automatique des tables si elles n'existent pas
(async () => {
  try {
    // Table site_visits
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_visits (
        id SERIAL PRIMARY KEY,
        visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table site_visits vérifiée/créée avec succès.');
    
    // Table transactions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        montant DECIMAL(10,2) NOT NULL,
        devise VARCHAR(3) DEFAULT 'EUR',
        type VARCHAR(50),
        payment_id VARCHAR(255),
        date_transaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table transactions vérifiée/créée avec succès.');
  } catch (e) {
    console.error('Erreur lors de la création des tables :', e.message);
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

// === WEBHOOK PAYPAL ===
app.post('/api/paypal/webhook', express.json(), async (req, res) => {
  // Webhook PayPal : https://developer.paypal.com/docs/api/webhooks/v1/
  // On attend un event PAYMENT.CAPTURE.COMPLETED
  const event = req.body;
  if (!event || !event.event_type) {
    return res.status(400).json({ error: 'Event PayPal invalide' });
  }
  if (event.event_type === 'CHECKOUT.ORDER.APPROVED' || event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    try {
      // Récupérer l'ID de la commande ou du paiement
      const orderId = event.resource && (event.resource.id || event.resource.order_id);
      // Appel API PayPal pour vérifier la commande
      const request = new paypalSdk.orders.OrdersGetRequest(orderId);
      const order = await paypalClient().execute(request);
      const details = order.result;
      // Récupérer l'email et le plan depuis la custom_id ou purchase_units
      let email = null, plan = null, montant = null;
      if (details && details.purchase_units && details.purchase_units.length > 0) {
        const custom = details.purchase_units[0].custom_id || '';
        // custom_id format: email|plan
        if (custom.includes('|')) {
          [email, plan] = custom.split('|');
        }
        montant = details.purchase_units[0].amount && details.purchase_units[0].amount.value;
      }
      if (!email || !plan) {
        return res.status(400).json({ error: 'Email ou plan manquant dans la commande PayPal' });
      }
      // Calcul des dates d'abonnement
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
      // Activer l'abonnement
      await pool.query(
        `UPDATE users SET abonnement_actif = true, abonnement_type = $1, abonnement_debut = $2, abonnement_fin = $3 WHERE email = $4`,
        [plan, debut, fin, email]
      );
      // Enregistrer la transaction
      await pool.query(
        `INSERT INTO transactions (user_id, email, montant, devise, abonnement_type, payment_method, payment_id, created_at)
         VALUES (
           (SELECT id FROM users WHERE email = $1),
           $1,
           $2,
           $3,
           $4,
           'paypal',
           $5,
           NOW()
         )`,
        [email, montant || 0, 'EUR', plan, orderId]
      );
      // Envoyer l'email de confirmation
      await sendMail({
        to: email,
        subject: 'Confirmation de votre abonnement NeuroBet',
        text: `Bonjour,\nVotre abonnement (${plan}) a bien été activé. Début : ${debut.toLocaleDateString()}. Merci pour votre confiance !`,
        html: `<p>Bonjour,</p><p>Votre abonnement <b>${plan}</b> a bien été activé.<br>Début : <b>${debut.toLocaleDateString()}</b>.</p><p>Merci pour votre confiance !</p>`
      });
      return res.json({ success: true });
    } catch (e) {
      console.error('Erreur webhook PayPal:', e);
      return res.status(500).json({ error: 'Erreur traitement PayPal' });
    }
  }
  res.json({ received: true });
});

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
    const insert = await pool.query(
      'INSERT INTO users (pseudo, email, password, date_inscription, abonnement_actif) VALUES ($1, $2, $3, NOW(), false) RETURNING id, pseudo, email, abonnement_actif',
      [pseudo, email, hash]
    );
    // Connexion automatique (création de session)
    req.session.user = {
      id: insert.rows[0].id,
      pseudo: insert.rows[0].pseudo,
      email: insert.rows[0].email,
      abonnement_actif: insert.rows[0].abonnement_actif
    };
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
  // On attend { amount, plan, email }
  const { amount, plan, email } = req.body || {};
  const request = new paypalSdk.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'EUR',
        value: (amount || '10.00').toString()
      },
      custom_id: email && plan ? `${email}|${plan}` : undefined
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
    // Visites aujourd'hui - amélioration avec fuseau horaire explicite
    const today = await pool.query(
      `SELECT COUNT(*) FROM site_visits 
       WHERE DATE(visited_at AT TIME ZONE 'Europe/Paris') = CURRENT_DATE`
    );
    
    // Visites ce mois-ci - amélioration avec fuseau horaire explicite
    const month = await pool.query(
      `SELECT COUNT(*) FROM site_visits 
       WHERE DATE_TRUNC('month', visited_at AT TIME ZONE 'Europe/Paris') = DATE_TRUNC('month', CURRENT_DATE)`
    );
    
    // Visites par jour sur les 30 derniers jours - amélioration avec fuseau horaire explicite
    const byDay = await pool.query(
      `SELECT DATE(visited_at AT TIME ZONE 'Europe/Paris') AS day, COUNT(*) AS count
       FROM site_visits
       WHERE visited_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY day
       ORDER BY day DESC`
    );
    
    // Debug: afficher la date actuelle et quelques visites récentes
    const debugInfo = await pool.query(
      `SELECT CURRENT_DATE as current_date, 
              COUNT(*) as total_visits,
              MAX(visited_at) as last_visit,
              MIN(visited_at) as first_visit
       FROM site_visits`
    );
    
    // Utilisateurs inscrits
    const users = await pool.query('SELECT COUNT(*) FROM users');
    // Paiements/transactions
    const transactions = await pool.query('SELECT COUNT(*) FROM transactions');
    
    console.log('Debug stats:', {
      current_date: debugInfo.rows[0].current_date,
      total_visits: debugInfo.rows[0].total_visits,
      last_visit: debugInfo.rows[0].last_visit,
      first_visit: debugInfo.rows[0].first_visit,
      visits_today: today.rows[0].count,
      visits_month: month.rows[0].count
    });
    
    res.json({
      visits_today: today.rows[0].count,
      visits_month: month.rows[0].count,
      visits_by_day: byDay.rows,
      users: users.rows[0].count,
      transactions: transactions.rows[0].count,
      debug: {
        current_date: debugInfo.rows[0].current_date,
        total_visits: debugInfo.rows[0].total_visits,
        last_visit: debugInfo.rows[0].last_visit
      }
    });
  } catch (err) {
    console.error('Erreur stats:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/api/clients', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, pseudo, email, abonnement_actif, abonnement_type, abonnement_debut, abonnement_fin, date_inscription FROM users ORDER BY date_inscription DESC');
    res.json({ clients: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Erreur chargement clients' });
  }
});

// Activer un abonnement
app.post('/admin/api/clients/:id/activate', requireAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE users SET abonnement_actif = true WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur activation' });
  }
});
// Désactiver un abonnement
app.post('/admin/api/clients/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE users SET abonnement_actif = false WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur désactivation' });
  }
});
// Modifier type/dates d'abonnement
app.post('/admin/api/clients/:id/update', requireAdmin, async (req, res) => {
  const { abonnement_type, abonnement_debut, abonnement_fin } = req.body;
  try {
    await pool.query(
      "UPDATE users SET abonnement_type = $1, abonnement_debut = $2, abonnement_fin = $3 WHERE id = $4",
      [abonnement_type, abonnement_debut, abonnement_fin, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur modification' });
  }
});
// Supprimer un utilisateur
app.delete('/admin/api/clients/:id/delete', requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur suppression' });
  }
});
// Ajouter un utilisateur
app.post('/admin/api/clients/add', requireAdmin, async (req, res) => {
  console.log('ROUTE ADMIN ADD OK', req.body);
  const { pseudo, email, password } = req.body;
  if (!pseudo || !email || !password) return res.status(400).json({ error: 'Champs manquants' });
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (pseudo, email, password, date_inscription, abonnement_actif) VALUES ($1, $2, $3, NOW(), false)',
      [pseudo, email, hash]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur ajout utilisateur' });
  }
});

// API revenus totaux et nombre de transactions
app.get('/admin/api/revenus', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT COALESCE(SUM(montant),0) AS total, COUNT(*) AS nb FROM transactions');
    console.log('Revenus query result:', result.rows[0]);
    res.json({
      total_revenue: parseFloat(result.rows[0].total),
      transactions: parseInt(result.rows[0].nb)
    });
  } catch (e) {
    console.error('Erreur revenus:', e);
    res.status(500).json({ error: 'Erreur chargement revenus: ' + e.message });
  }
});

// API revenus détaillés avec statistiques par période
app.get('/admin/api/revenus/detailed', requireAdmin, async (req, res) => {
  try {
    // Revenus par période
    const today = await pool.query(`
      SELECT COALESCE(SUM(montant), 0) AS total 
      FROM transactions 
      WHERE DATE(date_transaction AT TIME ZONE 'Europe/Paris') = CURRENT_DATE
    `);
    
    const week = await pool.query(`
      SELECT COALESCE(SUM(montant), 0) AS total 
      FROM transactions 
      WHERE date_transaction >= DATE_TRUNC('week', CURRENT_DATE)
    `);
    
    const month = await pool.query(`
      SELECT COALESCE(SUM(montant), 0) AS total 
      FROM transactions 
      WHERE DATE_TRUNC('month', date_transaction AT TIME ZONE 'Europe/Paris') = DATE_TRUNC('month', CURRENT_DATE)
    `);
    
    const year = await pool.query(`
      SELECT COALESCE(SUM(montant), 0) AS total 
      FROM transactions 
      WHERE DATE_TRUNC('year', date_transaction AT TIME ZONE 'Europe/Paris') = DATE_TRUNC('year', CURRENT_DATE)
    `);
    
    // Répartition par moyen de paiement
    const paymentMethods = await pool.query(`
      SELECT 
        COALESCE(type, 'Non spécifié') as payment_method,
        COUNT(*) as count,
        COALESCE(SUM(montant), 0) as total
      FROM transactions 
      GROUP BY type 
      ORDER BY total DESC
    `);
    
    // Évolution des revenus par jour (30 derniers jours)
    const evolution = await pool.query(`
      SELECT 
        DATE(date_transaction AT TIME ZONE 'Europe/Paris') as day,
        COUNT(*) as transactions,
        COALESCE(SUM(montant), 0) as revenue
      FROM transactions 
      WHERE date_transaction >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY day 
      ORDER BY day DESC
    `);
    
    // Détail des transactions récentes
    const transactions = await pool.query(`
      SELECT 
        t.date_transaction,
        u.pseudo,
        t.montant,
        t.type,
        t.payment_id
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.date_transaction DESC
      LIMIT 50
    `);
    
    res.json({
      periods: {
        today: parseFloat(today.rows[0].total),
        week: parseFloat(week.rows[0].total),
        month: parseFloat(month.rows[0].total),
        year: parseFloat(year.rows[0].total)
      },
      payment_methods: paymentMethods.rows,
      evolution: evolution.rows,
      transactions: transactions.rows
    });
  } catch (e) {
    console.error('Erreur revenus détaillés:', e);
    // En cas d'erreur, retourner des données vides au lieu d'une erreur 500
    res.json({
      periods: {
        today: 0,
        week: 0,
        month: 0,
        year: 0
      },
      payment_methods: [
        { payment_method: 'Stripe', count: 0, total: 0 },
        { payment_method: 'PayPal', count: 0, total: 0 },
        { payment_method: 'Crypto', count: 0, total: 0 }
      ],
      evolution: [],
      transactions: []
    });
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
    let isActive = false;
    if (user) {
      if (user.abonnement_type === 'lifetime' && user.abonnement_actif) {
        isActive = true;
      } else if (user.abonnement_fin) {
        const fin = new Date(user.abonnement_fin);
        if (user.abonnement_actif && now < fin) {
          isActive = true;
        } else if (now >= fin && user.abonnement_actif) {
          // Abonnement expiré, on désactive
          await pool.query('UPDATE users SET abonnement_actif = false WHERE email = $1', [req.session.user.email]);
        }
      }
    }
    if (isActive) {
      return next();
    }
  } catch (e) {
    console.error('Erreur vérification abonnement:', e);
  }
  res.redirect('/dashboard');
}

// Exemple : protège la page des pronos
app.get('/pronos', requirePaidUser, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pronos.html'));
});

// Route protégée pour dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API pour infos utilisateur connecté (complétée pour Mon Compte)
app.get('/me', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json({ logged: false });
  }
  // Récupère les infos complètes en base
  try {
    const result = await pool.query('SELECT pseudo, email, abonnement_actif, abonnement_type, abonnement_debut, abonnement_fin FROM users WHERE id = $1', [req.session.user.id]);
    const user = result.rows[0];
    res.json({
      logged: true,
      pseudo: user.pseudo,
      email: user.email,
      abonnement_actif: user.abonnement_actif,
      abonnement_type: user.abonnement_type,
      abonnement_debut: user.abonnement_debut,
      abonnement_fin: user.abonnement_fin
    });
  } catch (e) {
    res.json({ logged: true, ...req.session.user });
  }
});

// Déconnexion
app.post('/logout', (req, res) => {
  req.session.destroy(()=>{
    res.json({ success: true });
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
}); 