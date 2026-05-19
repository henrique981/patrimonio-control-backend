const express = require('express');
const cors = require('cors');
const pool = require('./config/database');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const patrimonioRoutes = require('./routes/patrimonio');
const assuncaoRoutes = require('./routes/assuncao');
const usuariosRoutes = require('./routes/usuarios');

const app = express();

app.use(cors({
  origin: ['https://patrimonio-control-frontend.vercel.app', 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

app.get('/', (req, res) => {
  res.json({ message: 'Patrimonio Control API funcionando!' });
});

app.use('/auth', authRoutes);
app.use('/patrimonio', patrimonioRoutes);
app.use('/assuncao', assuncaoRoutes);
app.use('/usuarios', usuariosRoutes);

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
