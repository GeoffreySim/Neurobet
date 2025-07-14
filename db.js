const { Pool } = require('pg');

// Log de la chaîne de connexion (sans le mot de passe)
if (process.env.DATABASE_URL) {
  const safeUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@');
  console.log('DATABASE_URL utilisée :', safeUrl);
} else {
  console.warn('DATABASE_URL non définie !');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool; 