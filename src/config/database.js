const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco:', err);
  } else {
    console.log('Banco de dados conectado com sucesso!');
  }
});

module.exports = pool;