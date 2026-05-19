const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'patrimonio5cia6bpmi2026';

// ============================================================
// SETUP — cria tabela de usuários e gestor padrão
// ============================================================
router.get('/setup-usuarios', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios_dashboard (
        id SERIAL PRIMARY KEY,
        re VARCHAR(20) NOT NULL UNIQUE,
        nome VARCHAR(100) NOT NULL,
        patente VARCHAR(50),
        email VARCHAR(100),
        senha_hash VARCHAR(255) NOT NULL,
        perfil VARCHAR(20) NOT NULL DEFAULT 'operador' CHECK (perfil IN ('gestor','operador')),
        ativo BOOLEAN DEFAULT true,
        primeiro_acesso BOOLEAN DEFAULT true,
        data_cadastro TIMESTAMP DEFAULT NOW(),
        data_ultimo_acesso TIMESTAMP
      )
    `);

    // Gestor padrão
    const hash = await bcrypt.hash('5Cia6BPMI', 10);
    await pool.query(`
      INSERT INTO usuarios_dashboard (re, nome, patente, email, senha_hash, perfil, primeiro_acesso)
      VALUES ('Gestor5Ciadm', 'Gestor 5a CIA PM', 'Gestor', 'hssantos@policiamilitar.sp.gov.br', $1, 'gestor', false)
      ON CONFLICT (re) DO NOTHING
    `, [hash]);

    res.json({ ok: true, mensagem: 'Tabela de usuarios criada! Gestor padrao configurado.' });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// LOGIN
// ============================================================
router.post('/login-dashboard', async (req, res) => {
  try {
    const { re, senha } = req.body;
    if (!re || !senha) return res.status(400).json({ ok: false, erro: 'RE e senha sao obrigatorios' });

    const result = await pool.query(
      `SELECT * FROM usuarios_dashboard WHERE re = $1 AND ativo = true`, [re]
    );
    if (result.rows.length === 0) return res.status(401).json({ ok: false, erro: 'RE ou senha incorretos' });

    const usuario = result.rows[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) return res.status(401).json({ ok: false, erro: 'RE ou senha incorretos' });

    // Atualiza ultimo acesso
    await pool.query(`UPDATE usuarios_dashboard SET data_ultimo_acesso = NOW() WHERE id = $1`, [usuario.id]);

    const token = jwt.sign(
      { id: usuario.id, re: usuario.re, nome: usuario.nome, perfil: usuario.perfil },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      ok: true,
      token,
      usuario: {
        id: usuario.id,
        re: usuario.re,
        nome: usuario.nome,
        patente: usuario.patente,
        perfil: usuario.perfil,
        primeiro_acesso: usuario.primeiro_acesso
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// TROCAR SENHA
// ============================================================
router.post('/trocar-senha', async (req, res) => {
  try {
    const { re, senha_atual, nova_senha } = req.body;
    if (!re || !senha_atual || !nova_senha) return res.status(400).json({ ok: false, erro: 'Todos os campos sao obrigatorios' });
    if (nova_senha.length < 6) return res.status(400).json({ ok: false, erro: 'Senha deve ter pelo menos 6 caracteres' });

    const result = await pool.query(`SELECT * FROM usuarios_dashboard WHERE re = $1`, [re]);
    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Usuario nao encontrado' });

    const senhaCorreta = await bcrypt.compare(senha_atual, result.rows[0].senha_hash);
    if (!senhaCorreta) return res.status(401).json({ ok: false, erro: 'Senha atual incorreta' });

    const hash = await bcrypt.hash(nova_senha, 10);
    await pool.query(`UPDATE usuarios_dashboard SET senha_hash = $1, primeiro_acesso = false WHERE re = $2`, [hash, re]);

    res.json({ ok: true, mensagem: 'Senha alterada com sucesso!' });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// LISTAR USUÁRIOS (só gestor)
// ============================================================
router.get('/usuarios', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, re, nome, patente, email, perfil, ativo, data_cadastro, data_ultimo_acesso FROM usuarios_dashboard ORDER BY nome`
    );
    res.json({ ok: true, usuarios: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// CADASTRAR USUÁRIO (só gestor)
// ============================================================
router.post('/usuarios', async (req, res) => {
  try {
    const { re, nome, patente, email, perfil } = req.body;
    if (!re || !nome) return res.status(400).json({ ok: false, erro: 'RE e nome sao obrigatorios' });

    // Senha inicial = RE
    const hash = await bcrypt.hash(re, 10);
    const result = await pool.query(`
      INSERT INTO usuarios_dashboard (re, nome, patente, email, senha_hash, perfil, primeiro_acesso)
      VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id, re, nome, patente, email, perfil
    `, [re, nome, patente, email, hash, perfil || 'operador']);

    res.status(201).json({ ok: true, mensagem: 'Usuario cadastrado! Senha inicial = RE', usuario: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ ok: false, erro: 'RE ja cadastrado' });
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// ATUALIZAR USUÁRIO
// ============================================================
router.put('/usuarios/:id', async (req, res) => {
  try {
    const { nome, patente, email, perfil, ativo } = req.body;
    const result = await pool.query(`
      UPDATE usuarios_dashboard SET
        nome = COALESCE($1, nome),
        patente = COALESCE($2, patente),
        email = COALESCE($3, email),
        perfil = COALESCE($4, perfil),
        ativo = COALESCE($5, ativo)
      WHERE id = $6 RETURNING id, re, nome, patente, email, perfil, ativo
    `, [nome, patente, email, perfil, ativo, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Usuario nao encontrado' });
    res.json({ ok: true, mensagem: 'Usuario atualizado!', usuario: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// RESETAR SENHA (gestor reseta para RE)
// ============================================================
router.post('/usuarios/:id/resetar-senha', async (req, res) => {
  try {
    const user = await pool.query(`SELECT re FROM usuarios_dashboard WHERE id = $1`, [req.params.id]);
    if (user.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Usuario nao encontrado' });
    const hash = await bcrypt.hash(user.rows[0].re, 10);
    await pool.query(`UPDATE usuarios_dashboard SET senha_hash = $1, primeiro_acesso = true WHERE id = $2`, [hash, req.params.id]);
    res.json({ ok: true, mensagem: 'Senha resetada para o RE do usuario' });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
