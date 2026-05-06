const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// ============================================================
// ITENS PATRIMONIAIS
// ============================================================

// GET /patrimonio/itens — listar todos com filtros
router.get('/itens', async (req, res) => {
  try {
    const { unidade_opm, situacao, nome_material, search } = req.query;
    let query = `SELECT * FROM itens_patrimoniais WHERE 1=1`;
    const params = [];
    let i = 1;

    if (unidade_opm) { query += ` AND unidade_opm = $${i++}`; params.push(unidade_opm); }
    if (situacao)    { query += ` AND situacao = $${i++}`;    params.push(situacao); }
    if (nome_material) { query += ` AND nome_material ILIKE $${i++}`; params.push(`%${nome_material}%`); }
    if (search)      { query += ` AND (nome_material ILIKE $${i} OR patrimonio ILIKE $${i} OR n_serie ILIKE $${i})`; params.push(`%${search}%`); i++; }

    query += ` ORDER BY nome_material, patrimonio`;

    const result = await pool.query(query, params);
    res.json({ ok: true, total: result.rows.length, dados: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /patrimonio/itens/:patrimonio — buscar um item
router.get('/itens/:patrimonio', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM itens_patrimoniais WHERE patrimonio = $1`,
      [req.params.patrimonio]
    );
    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Item não encontrado' });
    res.json({ ok: true, dado: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /patrimonio/itens — inserir novo item
router.post('/itens', async (req, res) => {
  try {
    const {
      patrimonio, n_serie, cod_material, nome_material, especificacoes,
      conta_pat, ne, nl, unidade_opm, valor, data_inclusao,
      situacao, observacao, local_guarda, vtr_vinculada,
      responsavel_re, responsavel_nome
    } = req.body;

    if (!patrimonio || !nome_material || !unidade_opm) {
      return res.status(400).json({ ok: false, erro: 'Campos obrigatórios: patrimonio, nome_material, unidade_opm' });
    }

    const result = await pool.query(`
      INSERT INTO itens_patrimoniais
      (patrimonio, n_serie, cod_material, nome_material, especificacoes,
       conta_pat, ne, nl, unidade_opm, valor, data_inclusao,
       situacao, observacao, local_guarda, vtr_vinculada,
       responsavel_re, responsavel_nome)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *
    `, [patrimonio, n_serie, cod_material, nome_material, especificacoes,
        conta_pat, ne, nl, unidade_opm, valor, data_inclusao,
        situacao || 'operacional', observacao, local_guarda, vtr_vinculada,
        responsavel_re, responsavel_nome]);

    res.status(201).json({ ok: true, mensagem: 'Item inserido com sucesso!', dado: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ ok: false, erro: 'Patrimônio já cadastrado' });
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PUT /patrimonio/itens/:patrimonio — atualizar item
router.put('/itens/:patrimonio', async (req, res) => {
  try {
    const campos = [
      'n_serie','cod_material','nome_material','especificacoes','conta_pat',
      'ne','nl','unidade_opm','valor','data_inclusao','situacao','observacao',
      'local_guarda','vtr_vinculada','responsavel_re','responsavel_nome',
      'data_conferencia','conferido_por_re','conferido_por_nome',
      'numero_parte','numero_bo','data_ocorrencia','descricao_ocorrencia',
      'data_ultima_manutencao','data_proxima_manutencao','vida_util_anos',
      'empresa_manutencao','foto_url','foto_termo_url',
      'data_transferencia','opm_origem'
    ];

    const updates = [];
    const params = [];
    let i = 1;

    for (const campo of campos) {
      if (req.body[campo] !== undefined) {
        updates.push(`${campo} = $${i++}`);
        params.push(req.body[campo]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ ok: false, erro: 'Nenhum campo para atualizar' });

    params.push(req.params.patrimonio);
    const result = await pool.query(`
      UPDATE itens_patrimoniais SET ${updates.join(', ')}
      WHERE patrimonio = $${i}
      RETURNING *
    `, params);

    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Item não encontrado' });
    res.json({ ok: true, mensagem: 'Item atualizado com sucesso!', dado: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// DELETE /patrimonio/itens/:patrimonio — excluir item
router.delete('/itens/:patrimonio', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM itens_patrimoniais WHERE patrimonio = $1 RETURNING *`,
      [req.params.patrimonio]
    );
    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Item não encontrado' });
    res.json({ ok: true, mensagem: 'Item excluído com sucesso!', dado: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// ARMAS
// ============================================================

// GET /patrimonio/armas — listar todas
router.get('/armas', async (req, res) => {
  try {
    const { situacao, fabricante, search } = req.query;
    let query = `SELECT * FROM armas WHERE 1=1`;
    const params = [];
    let i = 1;

    if (situacao)   { query += ` AND situacao = $${i++}`;   params.push(situacao); }
    if (fabricante) { query += ` AND fabricante = $${i++}`; params.push(fabricante); }
    if (search)     { query += ` AND (nome_material ILIKE $${i} OR patrimonio ILIKE $${i} OR n_serie ILIKE $${i} OR detentor_re ILIKE $${i})`; params.push(`%${search}%`); i++; }

    query += ` ORDER BY nome_material, patrimonio`;

    const result = await pool.query(query, params);
    res.json({ ok: true, total: result.rows.length, dados: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /patrimonio/armas/:patrimonio — buscar uma arma
router.get('/armas/:patrimonio', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM armas WHERE patrimonio = $1`,
      [req.params.patrimonio]
    );
    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Arma não encontrada' });
    res.json({ ok: true, dado: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /patrimonio/armas — inserir nova arma
router.post('/armas', async (req, res) => {
  try {
    const {
      patrimonio, n_serie, nome_material, especificacoes,
      conta_pat, unidade_opm, valor, data_inclusao,
      fabricante, uge, situacao, observacao,
      detentor_re, detentor_nome, local_guarda
    } = req.body;

    if (!patrimonio || !nome_material || !unidade_opm) {
      return res.status(400).json({ ok: false, erro: 'Campos obrigatórios: patrimonio, nome_material, unidade_opm' });
    }

    const result = await pool.query(`
      INSERT INTO armas
      (patrimonio, n_serie, nome_material, especificacoes, conta_pat,
       unidade_opm, valor, data_inclusao, fabricante, uge,
       situacao, observacao, detentor_re, detentor_nome, local_guarda)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [patrimonio, n_serie, nome_material, especificacoes, conta_pat,
        unidade_opm, valor, data_inclusao, fabricante, uge,
        situacao || 'operacional', observacao, detentor_re, detentor_nome, local_guarda]);

    res.status(201).json({ ok: true, mensagem: 'Arma inserida com sucesso!', dado: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ ok: false, erro: 'Patrimônio já cadastrado' });
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PUT /patrimonio/armas/:patrimonio — atualizar arma
router.put('/armas/:patrimonio', async (req, res) => {
  try {
    const campos = [
      'n_serie','nome_material','especificacoes','conta_pat','unidade_opm',
      'valor','data_inclusao','fabricante','uge','situacao','observacao',
      'local_guarda','vtr_vinculada','detentor_re','detentor_nome',
      'responsavel_re','responsavel_nome','data_conferencia',
      'conferido_por_re','conferido_por_nome','numero_bo','numero_parte',
      'data_ocorrencia','descricao_ocorrencia','data_ultima_manutencao',
      'data_proxima_manutencao','vida_util_anos','empresa_manutencao',
      'foto_url','foto_termo_url','data_transferencia','opm_origem'
    ];

    const updates = [];
    const params = [];
    let i = 1;

    for (const campo of campos) {
      if (req.body[campo] !== undefined) {
        updates.push(`${campo} = $${i++}`);
        params.push(req.body[campo]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ ok: false, erro: 'Nenhum campo para atualizar' });

    params.push(req.params.patrimonio);
    const result = await pool.query(`
      UPDATE armas SET ${updates.join(', ')}
      WHERE patrimonio = $${i}
      RETURNING *
    `, params);

    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Arma não encontrada' });
    res.json({ ok: true, mensagem: 'Arma atualizada com sucesso!', dado: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// DELETE /patrimonio/armas/:patrimonio — excluir arma
router.delete('/armas/:patrimonio', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM armas WHERE patrimonio = $1 RETURNING *`,
      [req.params.patrimonio]
    );
    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Arma não encontrada' });
    res.json({ ok: true, mensagem: 'Arma excluída com sucesso!', dado: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// VIATURAS
// ============================================================

// GET /patrimonio/viaturas — listar todas
router.get('/viaturas', async (req, res) => {
  try {
    const { situacao, unidade_opm } = req.query;
    let query = `SELECT * FROM viaturas WHERE 1=1`;
    const params = [];
    let i = 1;

    if (situacao)    { query += ` AND situacao = $${i++}`;    params.push(situacao); }
    if (unidade_opm) { query += ` AND unidade_opm = $${i++}`; params.push(unidade_opm); }

    query += ` ORDER BY prefixo`;

    const result = await pool.query(query, params);
    res.json({ ok: true, total: result.rows.length, dados: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /patrimonio/viaturas/:prefixo — buscar uma viatura
router.get('/viaturas/:prefixo', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM viaturas WHERE prefixo = $1`,
      [req.params.prefixo]
    );
    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Viatura não encontrada' });
    res.json({ ok: true, dado: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /patrimonio/viaturas — inserir nova viatura
router.post('/viaturas', async (req, res) => {
  try {
    const {
      patrimonio, prefixo, placa, tipo, marca, modelo,
      ano_fabricacao, ano_modelo, cor, chassi, renavam,
      combustivel, unidade_opm, situacao, km_atual, observacao
    } = req.body;

    if (!patrimonio || !prefixo || !unidade_opm) {
      return res.status(400).json({ ok: false, erro: 'Campos obrigatórios: patrimonio, prefixo, unidade_opm' });
    }

    const result = await pool.query(`
      INSERT INTO viaturas
      (patrimonio, prefixo, placa, tipo, marca, modelo,
       ano_fabricacao, ano_modelo, cor, chassi, renavam,
       combustivel, unidade_opm, situacao, km_atual, observacao)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [patrimonio, prefixo, placa, tipo, marca, modelo,
        ano_fabricacao, ano_modelo, cor, chassi, renavam,
        combustivel || 'gasolina', unidade_opm,
        situacao || 'operacional', km_atual || 0, observacao]);

    res.status(201).json({ ok: true, mensagem: 'Viatura inserida com sucesso!', dado: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ ok: false, erro: 'Patrimônio ou prefixo já cadastrado' });
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PUT /patrimonio/viaturas/:prefixo — atualizar viatura
router.put('/viaturas/:prefixo', async (req, res) => {
  try {
    const campos = [
      'patrimonio','placa','tipo','marca','modelo','ano_fabricacao','ano_modelo',
      'cor','chassi','renavam','combustivel','unidade_opm','situacao','observacao',
      'km_atual','km_ultima_revisao','km_proxima_revisao',
      'data_ultima_revisao','data_proxima_revisao',
      'data_ultima_manutencao','data_proxima_manutencao','empresa_manutencao',
      'numero_parte','numero_bo','data_ocorrencia','descricao_ocorrencia',
      'liberada_por_re','data_liberacao','foto_url'
    ];

    const updates = [];
    const params = [];
    let i = 1;

    for (const campo of campos) {
      if (req.body[campo] !== undefined) {
        updates.push(`${campo} = $${i++}`);
        params.push(req.body[campo]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ ok: false, erro: 'Nenhum campo para atualizar' });

    params.push(req.params.prefixo);
    const result = await pool.query(`
      UPDATE viaturas SET ${updates.join(', ')}
      WHERE prefixo = $${i}
      RETURNING *
    `, params);

    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Viatura não encontrada' });
    res.json({ ok: true, mensagem: 'Viatura atualizada com sucesso!', dado: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// DELETE /patrimonio/viaturas/:prefixo — excluir viatura
router.delete('/viaturas/:prefixo', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM viaturas WHERE prefixo = $1 RETURNING *`,
      [req.params.prefixo]
    );
    if (result.rows.length === 0) return res.status(404).json({ ok: false, erro: 'Viatura não encontrada' });
    res.json({ ok: true, mensagem: 'Viatura excluída com sucesso!', dado: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// RESUMO GERAL — GET /patrimonio/resumo
// ============================================================
router.get('/resumo', async (req, res) => {
  try {
    const itens     = await pool.query(`SELECT situacao, COUNT(*) as total FROM itens_patrimoniais GROUP BY situacao`);
    const armas     = await pool.query(`SELECT situacao, COUNT(*) as total FROM armas GROUP BY situacao`);
    const viaturas  = await pool.query(`SELECT situacao, COUNT(*) as total FROM viaturas GROUP BY situacao`);
    const valor     = await pool.query(`SELECT SUM(valor) as total FROM itens_patrimoniais`);
    const valorArmas = await pool.query(`SELECT SUM(valor) as total FROM armas`);

    res.json({
      ok: true,
      resumo: {
        itens_patrimoniais: itens.rows,
        armas: armas.rows,
        viaturas: viaturas.rows,
        valor_total_itens: parseFloat(valor.rows[0].total || 0).toFixed(2),
        valor_total_armas: parseFloat(valorArmas.rows[0].total || 0).toFixed(2)
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
