const express = require('express');
const cors = require('cors');
const pool = require('./config/database');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const patrimonioRoutes = require('./routes/patrimonio');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Patrimônio Control API funcionando!' });
});

app.use('/auth', authRoutes);
app.use('/patrimonio', patrimonioRoutes);

app.get('/setup', async (req, res) => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'config/database.sql'), 'utf8');
    await pool.query(sql);
    res.json({ message: 'Banco de dados criado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
