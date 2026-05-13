const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dgoujj0ux',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// GET /assuncao/:prefixo
router.get('/:prefixo', async (req, res) => {
  try {
    const vtr = await pool.query(`SELECT * FROM viaturas WHERE prefixo = $1`, [req.params.prefixo]);
    if (vtr.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Viatura nao encontrada' });
    const aberta = await pool.query(
      `SELECT * FROM assuncao_vtr WHERE prefixo = $1 AND status = 'aberta' ORDER BY data_hora_saida DESC LIMIT 1`,
      [req.params.prefixo]
    );
    res.json({ ok: true, viatura: vtr.rows[0], assuncao_aberta: aberta.rows[0] || null });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /assuncao/:prefixo/saida
router.post('/:prefixo/saida', async (req, res) => {
  try {
    const { prefixo } = req.params;
    const { policial_re, policial_nome, policial_posto, km_saida } = req.body;
    if (!policial_re || !km_saida) return res.status(400).json({ ok: false, erro: 'RE e KM de saida sao obrigatorios' });
    const vtr = await pool.query(`SELECT * FROM viaturas WHERE prefixo = $1`, [prefixo]);
    if (vtr.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Viatura nao encontrada' });
    if (vtr.rows[0].situacao !== 'operacional') return res.status(400).json({ ok: false, erro: `Viatura esta ${vtr.rows[0].situacao}` });
    const aberta = await pool.query(`SELECT id FROM assuncao_vtr WHERE prefixo = $1 AND status = 'aberta'`, [prefixo]);
    if (aberta.rows.length > 0) return res.status(400).json({ ok: false, erro: 'Viatura ja possui assuncao em aberto' });
    const result = await pool.query(`
      INSERT INTO assuncao_vtr (viatura_id,prefixo,policial_re,policial_nome,policial_posto,km_saida,status)
      VALUES ($1,$2,$3,$4,$5,$6,'aberta') RETURNING *
    `, [vtr.rows[0].id, prefixo, policial_re, policial_nome, policial_posto, km_saida]);
    await pool.query(`UPDATE viaturas SET km_atual = $1 WHERE prefixo = $2`, [km_saida, prefixo]);
    res.json({ ok: true, mensagem: 'Saida registrada!', assuncao: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /assuncao/:prefixo/retorno
router.post('/:prefixo/retorno', async (req, res) => {
  try {
    const { prefixo } = req.params;
    const { km_retorno, observacao, assuncao_id } = req.body;
    if (!km_retorno || !assuncao_id) return res.status(400).json({ ok: false, erro: 'KM e ID sao obrigatorios' });
    const result = await pool.query(`
      UPDATE assuncao_vtr SET km_retorno=$1, observacao_retorno=$2, data_hora_retorno=NOW(), status='encerrada'
      WHERE id=$3 AND status='aberta' RETURNING *
    `, [km_retorno, observacao, assuncao_id]);
    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Assuncao nao encontrada ou ja encerrada' });
    await pool.query(`UPDATE viaturas SET km_atual = $1 WHERE prefixo = $2`, [km_retorno, prefixo]);
    res.json({ ok: true, mensagem: 'Retorno registrado!', assuncao: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /assuncao/:prefixo/foto
router.post('/:prefixo/foto', async (req, res) => {
  try {
    const { prefixo } = req.params;
    const { assuncao_id, tipo_foto, foto_base64, policial_re } = req.body;
    if (!foto_base64 || !tipo_foto || !assuncao_id) return res.status(400).json({ ok: false, erro: 'foto_base64, tipo_foto e assuncao_id sao obrigatorios' });
    const upload = await cloudinary.uploader.upload(foto_base64, {
      folder: `patrimonio/viaturas/${prefixo}`,
      public_id: `${assuncao_id}_${tipo_foto}_${Date.now()}`,
    });
    await pool.query(`
      INSERT INTO assuncao_vtr_fotos (assuncao_id,prefixo,policial_re,tipo_foto,foto_url)
      VALUES ($1,$2,$3,$4,$5)
    `, [assuncao_id, prefixo, policial_re, tipo_foto, upload.secure_url]);
    res.json({ ok: true, url: upload.secure_url });
  } catch (err) {
    console.error('ERRO FOTO:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /assuncao/:prefixo/historico
router.get('/:prefixo/historico', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*,
        COALESCE(json_agg(
          json_build_object('id',f.id,'tipo_foto',f.tipo_foto,'foto_url',f.foto_url,'data_hora_foto',f.data_hora_foto)
          ORDER BY f.data_hora_foto
        ) FILTER (WHERE f.id IS NOT NULL), '[]') as fotos
      FROM assuncao_vtr a
      LEFT JOIN assuncao_vtr_fotos f ON f.assuncao_id = a.id
      WHERE a.prefixo = $1
      GROUP BY a.id
      ORDER BY a.data_hora_saida DESC
      LIMIT 50
    `, [req.params.prefixo]);
    res.json({ ok: true, historico: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PUT /assuncao/registro/:id — editar registro pelo gestor
router.put('/registro/:id', async (req, res) => {
  try {
    const { policial_re, policial_nome, km_saida, km_retorno, observacao_saida, observacao_retorno } = req.body;
    const result = await pool.query(`
      UPDATE assuncao_vtr SET
        policial_re = COALESCE($1, policial_re),
        policial_nome = COALESCE($2, policial_nome),
        km_saida = COALESCE($3, km_saida),
        km_retorno = COALESCE($4, km_retorno),
        observacao_saida = COALESCE($5, observacao_saida),
        observacao_retorno = COALESCE($6, observacao_retorno)
      WHERE id = $7 RETURNING *
    `, [policial_re, policial_nome, km_saida, km_retorno, observacao_saida, observacao_retorno, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Registro nao encontrado' });
    res.json({ ok: true, mensagem: 'Registro atualizado!', assuncao: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// DELETE /assuncao/foto/:id — excluir foto
router.delete('/foto/:id', async (req, res) => {
  try {
    const foto = await pool.query(`SELECT * FROM assuncao_vtr_fotos WHERE id = $1`, [req.params.id]);
    if (foto.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Foto nao encontrada' });
    // Extrair public_id do Cloudinary da URL
    const url = foto.rows[0].foto_url;
    const parts = url.split('/');
    const publicId = parts.slice(parts.indexOf('patrimonio')).join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
    await pool.query(`DELETE FROM assuncao_vtr_fotos WHERE id = $1`, [req.params.id]);
    res.json({ ok: true, mensagem: 'Foto excluida!' });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /assuncao/relatorio/viaturas — dados para PDF
router.get('/relatorio/viaturas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT prefixo, placa, marca, modelo, km_atual, situacao
      FROM viaturas
      WHERE unidade_opm = '606065000'
      ORDER BY
        CASE situacao WHEN 'operacional' THEN 1 WHEN 'baixada' THEN 2 WHEN 'descarga' THEN 3 ELSE 4 END,
        prefixo
    `);
    res.json({ ok: true, viaturas: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
