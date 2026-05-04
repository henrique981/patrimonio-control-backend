const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8');

pool.query(sql)
  .then(() => {
    console.log('Banco de dados criado com sucesso!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Erro ao criar banco:', err.message);
    process.exit(1);
  });
