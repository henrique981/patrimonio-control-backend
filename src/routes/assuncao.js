const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dgoujj0ux',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================================
// GET /assuncao/:prefixo — dados da viatura e status atual
// ============================================================
router.get('/:prefixo', async (req, res) => {
  try {
    const { prefixo } = req.params;

    const vtr = await pool.query(
      `SELECT * FROM viaturas WHERE prefixo = $1`, [prefixo]
    );
    if (vtr.rows.length === 0) {
      return res.status(404).json({ ok: false, erro: 'Viatura não encontrada' });
    }

    // Verifica se tem assunção em aberto
    const aberta = await pool.query(
      `SELECT a.*, v.prefixo, v.marca, v.modelo, v.placa
       FROM assuncao_vtr a
       JOIN viaturas v ON v.id = a.viatura_id
       WHERE a.prefixo = $1 AND a.status = 'aberta'
       ORDER BY a.data_hora_saida DESC LIMIT 1`,
      [prefixo]
    );

    res.json({
      ok: true,
      viatura: vtr.rows[0],
      assuncao_aberta: aberta.rows[0] || null
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// POST /assuncao/:prefixo/saida — registrar saída
// ============================================================
router.post('/:prefixo/saida', async (req, res) => {
  try {
    const { prefixo } = req.params;
    const { policial_re, policial_nome, policial_posto, km_saida } = req.body;

    if (!policial_re || !km_saida) {
      return res.status(400).json({ ok: false, erro: 'RE e KM de saída são obrigatórios' });
    }

    const vtr = await pool.query(`SELECT * FROM viaturas WHERE prefixo = $1`, [prefixo]);
    if (vtr.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Viatura não encontrada' });

    if (vtr.rows[0].situacao !== 'operacional') {
      return res.status(400).json({ ok: false, erro: `Viatura está ${vtr.rows[0].situacao} — não pode ser utilizada` });
    }

    // Verifica se já tem assunção aberta
    const aberta = await pool.query(
      `SELECT id FROM assuncao_vtr WHERE prefixo = $1 AND status = 'aberta'`, [prefixo]
    );
    if (aberta.rows.length > 0) {
      return res.status(400).json({ ok: false, erro: 'Esta viatura já possui uma assunção em aberto' });
    }

    const result = await pool.query(`
      INSERT INTO assuncao_vtr
      (viatura_id, prefixo, policial_re, policial_nome, policial_posto, km_saida, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'aberta')
      RETURNING *
    `, [vtr.rows[0].id, prefixo, policial_re, policial_nome, policial_posto, km_saida]);

    // Atualiza KM da viatura
    await pool.query(`UPDATE viaturas SET km_atual = $1 WHERE prefixo = $2`, [km_saida, prefixo]);

    res.json({ ok: true, mensagem: 'Saída registrada!', assuncao: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// POST /assuncao/:prefixo/retorno — registrar retorno
// ============================================================
router.post('/:prefixo/retorno', async (req, res) => {
  try {
    const { prefixo } = req.params;
    const { km_retorno, observacao, assuncao_id } = req.body;

    if (!km_retorno || !assuncao_id) {
      return res.status(400).json({ ok: false, erro: 'KM de retorno e ID da assunção são obrigatórios' });
    }

    const result = await pool.query(`
      UPDATE assuncao_vtr SET
        km_retorno = $1,
        observacao_retorno = $2,
        data_hora_retorno = NOW(),
        status = 'encerrada'
      WHERE id = $3 AND status = 'aberta'
      RETURNING *
    `, [km_retorno, observacao, assuncao_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, erro: 'Assunção não encontrada ou já encerrada' });
    }

    // Atualiza KM da viatura
    await pool.query(`UPDATE viaturas SET km_atual = $1 WHERE prefixo = $2`, [km_retorno, prefixo]);

    res.json({ ok: true, mensagem: 'Retorno registrado!', assuncao: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// POST /assuncao/:prefixo/foto — upload de foto
// ============================================================
router.post('/:prefixo/foto', async (req, res) => {
  try {
    const { prefixo } = req.params;
    const { assuncao_id, tipo_foto, foto_base64, policial_re } = req.body;

    if (!foto_base64 || !tipo_foto || !assuncao_id) {
      return res.status(400).json({ ok: false, erro: 'foto_base64, tipo_foto e assuncao_id são obrigatórios' });
    }

    // Upload para Cloudinary
    const upload = await cloudinary.uploader.upload(foto_base64, {
      folder: `patrimonio/viaturas/${prefixo}`,
      public_id: `${assuncao_id}_${tipo_foto}_${Date.now()}`,
    });

    // Salva no banco
    await pool.query(`
      INSERT INTO assuncao_vtr_fotos
      (assuncao_id, prefixo, policial_re, tipo_foto, foto_url)
      VALUES ($1, $2, $3, $4, $5)
    `, [assuncao_id, prefixo, policial_re, tipo_foto, upload.secure_url]);

    res.json({ ok: true, url: upload.secure_url });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// GET /assuncao/:prefixo/historico — histórico de assunções
// ============================================================
router.get('/:prefixo/historico', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, 
        json_agg(f.*) FILTER (WHERE f.id IS NOT NULL) as fotos
      FROM assuncao_vtr a
      LEFT JOIN assuncao_vtr_fotos f ON f.assuncao_id = a.id
      WHERE a.prefixo = $1
      GROUP BY a.id
      ORDER BY a.data_hora_saida DESC
      LIMIT 20
    `, [req.params.prefixo]);

    res.json({ ok: true, historico: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
