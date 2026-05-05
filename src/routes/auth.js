const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
require('dotenv').config();

router.post('/login', async (req, res) => {
  const { matricula, pin } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM policiais WHERE matricula = $1 AND pin = $2 AND ativo = true',
      [matricula, pin]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Matricula ou PIN incorretos.' });
    }
    const usuario = result.rows[0];
    const token = jwt.sign(
      { id: usuario.id, matricula: usuario.matricula, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
        patente: usuario.patente,
        perfil: usuario.perfil,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
