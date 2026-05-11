const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ============================================================
// LOGIN
// ============================================================
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
      process.env.JWT_SECARET,
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

// ============================================================
// SETUP PATRIMONIAL — cria tabelas e importa dados do LCM
// ============================================================
router.get('/setup-patrimonio', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS itens_patrimoniais (
        id SERIAL PRIMARY KEY,
        patrimonio VARCHAR(20) NOT NULL UNIQUE,
        n_serie VARCHAR(50),
        cod_material VARCHAR(20),
        nome_material VARCHAR(100) NOT NULL,
        especificacoes TEXT,
        conta_pat VARCHAR(20),
        ne VARCHAR(20),
        nl VARCHAR(20),
        unidade_opm VARCHAR(15) NOT NULL,
        valor NUMERIC(12,2),
        data_inclusao DATE,
        situacao VARCHAR(30) NOT NULL DEFAULT 'operacional'
          CHECK (situacao IN ('operacional','inservivel','descarga','inexistente','em_manutencao','extraviado','aguardando_descarga')),
        observacao TEXT,
        local_guarda VARCHAR(100),
        vtr_vinculada VARCHAR(20),
        responsavel_re VARCHAR(20),
        responsavel_nome VARCHAR(100),
        data_conferencia DATE,
        conferido_por_re VARCHAR(20),
        conferido_por_nome VARCHAR(100),
        numero_parte VARCHAR(30),
        numero_bo VARCHAR(30),
        data_ocorrencia DATE,
        descricao_ocorrencia TEXT,
        data_ultima_manutencao DATE,
        data_proxima_manutencao DATE,
        vida_util_anos INTEGER,
        empresa_manutencao VARCHAR(100),
        foto_url TEXT,
        foto_termo_url TEXT,
        data_transferencia DATE,
        opm_origem VARCHAR(15),
        data_cadastro TIMESTAMP DEFAULT NOW(),
        data_atualizacao TIMESTAMP DEFAULT NOW(),
        cadastrado_por VARCHAR(50) DEFAULT 'importacao_lcm_2026'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS armas (
        id SERIAL PRIMARY KEY,
        patrimonio VARCHAR(20) NOT NULL UNIQUE,
        n_serie VARCHAR(50),
        nome_material VARCHAR(100) NOT NULL,
        especificacoes TEXT,
        conta_pat VARCHAR(20),
        unidade_opm VARCHAR(15) NOT NULL,
        valor NUMERIC(12,2),
        data_inclusao DATE,
        fabricante VARCHAR(50),
        uge VARCHAR(10),
        situacao VARCHAR(30) NOT NULL DEFAULT 'operacional'
          CHECK (situacao IN ('operacional','inservivel','descarga','inexistente','em_manutencao','extraviado','aguardando_descarga')),
        observacao TEXT,
        local_guarda VARCHAR(100),
        detentor_re VARCHAR(20),
        detentor_nome VARCHAR(100),
        responsavel_re VARCHAR(20),
        responsavel_nome VARCHAR(100),
        data_conferencia DATE,
        numero_bo VARCHAR(30),
        numero_parte VARCHAR(30),
        foto_url TEXT,
        data_cadastro TIMESTAMP DEFAULT NOW(),
        data_atualizacao TIMESTAMP DEFAULT NOW(),
        cadastrado_por VARCHAR(50) DEFAULT 'importacao_lcm_2026'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS armas_fotos (
        id SERIAL PRIMARY KEY,
        arma_id INTEGER NOT NULL REFERENCES armas(id) ON DELETE CASCADE,
        patrimonio VARCHAR(20) NOT NULL,
        detentor_re VARCHAR(20),
        detentor_nome VARCHAR(100),
        tipo_foto VARCHAR(30) NOT NULL CHECK (tipo_foto IN ('recebimento','devolucao','termo','vistoria','ocorrencia')),
        foto_url TEXT NOT NULL,
        data_foto TIMESTAMP DEFAULT NOW(),
        observacao TEXT,
        cadastrado_por VARCHAR(50)
      )
    `);

    await client.query(`DROP TABLE IF EXISTS assuncao_vtr_fotos CASCADE`);
    await client.query(`DROP TABLE IF EXISTS assuncao_vtr CASCADE`);
    await client.query(`DROP TABLE IF EXISTS viaturas CASCADE`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS viaturas (
        id SERIAL PRIMARY KEY,
        patrimonio VARCHAR(20) NOT NULL UNIQUE,
        prefixo VARCHAR(20) NOT NULL UNIQUE,
        placa VARCHAR(10),
        tipo VARCHAR(50),
        marca VARCHAR(50),
        modelo VARCHAR(50),
        ano_fabricacao INTEGER,
        ano_modelo INTEGER,
        cor VARCHAR(30),
        chassi VARCHAR(50),
        renavam VARCHAR(20),
        combustivel VARCHAR(20) DEFAULT 'flex',
        unidade_opm VARCHAR(15) NOT NULL,
        valor NUMERIC(12,2),
        situacao VARCHAR(30) NOT NULL DEFAULT 'operacional'
          CHECK (situacao IN ('operacional','baixada','descarga')),
        observacao TEXT,
        km_atual INTEGER DEFAULT 0,
        data_cadastro TIMESTAMP DEFAULT NOW(),
        data_atualizacao TIMESTAMP DEFAULT NOW(),
        cadastrado_por VARCHAR(50) DEFAULT 'importacao_lcm_2026'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS assuncao_vtr (
        id SERIAL PRIMARY KEY,
        viatura_id INTEGER NOT NULL REFERENCES viaturas(id),
        prefixo VARCHAR(20) NOT NULL,
        policial_re VARCHAR(20) NOT NULL,
        policial_nome VARCHAR(100),
        policial_posto VARCHAR(50),
        data_hora_saida TIMESTAMP NOT NULL DEFAULT NOW(),
        km_saida INTEGER NOT NULL,
        observacao_saida TEXT,
        data_hora_retorno TIMESTAMP,
        km_retorno INTEGER,
        observacao_retorno TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','encerrada')),
        data_cadastro TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS assuncao_vtr_fotos (
        id SERIAL PRIMARY KEY,
        assuncao_id INTEGER NOT NULL REFERENCES assuncao_vtr(id) ON DELETE CASCADE,
        prefixo VARCHAR(20) NOT NULL,
        policial_re VARCHAR(20) NOT NULL,
        tipo_foto VARCHAR(30) NOT NULL CHECK (tipo_foto IN ('frente','lateral_esquerda','traseira','lateral_direita','abastecimento','troca_oleo')),
        foto_url TEXT NOT NULL,
        data_hora_foto TIMESTAMP DEFAULT NOW(),
        observacao TEXT
      )
    `);

    await client.query('COMMIT');
    res.json({ ok: true, mensagem: 'Tabelas criadas com sucesso!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false, erro: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// FIX — corrige constraint da tabela assuncao_vtr_fotos
// ============================================================
router.get('/fix-fotos-check', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE assuncao_vtr_fotos DROP CONSTRAINT IF EXISTS assuncao_vtr_fotos_tipo_foto_check`);
    await pool.query(`ALTER TABLE assuncao_vtr_fotos ADD CONSTRAINT assuncao_vtr_fotos_tipo_foto_check CHECK (tipo_foto IN ('frente','lateral_esquerda','traseira','lateral_direita','abastecimento','troca_oleo'))`);
    res.json({ ok: true, mensagem: 'Constraint atualizada!' });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// FIX — adiciona coluna valor em viaturas
// ============================================================
router.get('/add-coluna-valor-viaturas', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE viaturas ADD COLUMN IF NOT EXISTS valor NUMERIC(12,2)`);
    res.json({ ok: true, mensagem: 'Coluna valor adicionada!' });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// UPDATE VIATURAS — importa dados completos do PDF
// ============================================================
router.get('/update-viaturas', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`ALTER TABLE viaturas ADD COLUMN IF NOT EXISTS valor NUMERIC(12,2)`);
    await client.query(`DELETE FROM assuncao_vtr_fotos`);
    await client.query(`DELETE FROM assuncao_vtr`);
    await client.query(`DELETE FROM viaturas`);

    const viaturas = [
      ['225029010','I-06520','TJQ5C61','RENAULT','DUSTER ZEN 16','93YHJD209TJ356031','1459309585',2025,2026,132399.00,'operacional'],
      ['224048531','I-06560','TJS4F44','CHEVROLET','SPIN 1.8L MT LT','9BGJB7520SB183484','1408698657',2024,2024,130550.00,'operacional'],
      ['224034770','I-06510','SWU7G24','CHEVROLET','SPIN 1.8L MT','9BGJB7520SB183134','1408664183',2024,2024,130500.00,'operacional'],
      ['223036928','I-06588','SST0D74','YAMAHA','XTZ250 LANDER','9C6DG3320P0109784','1367975309',2023,2023,32100.00,'operacional'],
      ['223036929','I-06589','SUX6F51','YAMAHA','XTZ250 LANDER','9C6DG3320P0109781','1367975457',2023,2023,32100.00,'operacional'],
      ['222082897','I-06551','FHR5J93','CHEVROLET','SPIN 18L AT PREMIER','9BGJP7520PB190443','1331712936',2022,2022,120500.00,'operacional'],
      ['222082913','I-06550','GIR1D84','CHEVROLET','SPIN 18L AT PREMIER','9BGJP7520PB190224','1331711239',2022,2022,120500.00,'operacional'],
      ['222041405','I-06584','CFY0F36','YAMAHA','LANDER XTZ250','9C6DG3320N0065722','1323720186',2022,2022,33800.00,'operacional'],
      ['222041406','I-06585','FUV0D71','YAMAHA','LANDER XTZ250','9C6DG3320N0065727','1323721085',2022,2022,33800.00,'operacional'],
      ['222041407','I-06586','GFX4G62','YAMAHA','LANDER XTZ250','9C6DG3320N0065733','1323721310',2022,2022,33800.00,'operacional'],
      ['222041408','I-06587','CCU6E53','YAMAHA','LANDER XTZ250','9C6DG3320N0065730','1323721719',2022,2022,33800.00,'operacional'],
      ['222010943','I-06500','GGR1B85','CHEVROLET','SPIN 18L AT PREMIER','9BGJP7520NB178795','1292449559',2022,2022,110200.00,'operacional'],
      ['222010944','I-06534','EXO7I57','CHEVROLET','SPIN 18L AT PREMIER','9BGJP7520NB178867','1292449664',2022,2022,110200.00,'operacional'],
      ['222010945','I-06535','FIY4C36','CHEVROLET','SPIN 18L AT PREMIER','9BGJP7520NB179096','1292449990',2022,2022,110200.00,'operacional'],
      ['221038707','I-06532','GCQ8F46','RENAULT','DUSTER','93YHJD204NJ114699','1278864781',2021,2022,96000.00,'operacional'],
      ['221038708','I-06533','FYY2G97','RENAULT','DUSTER','93YHJD209NJ114567','1278818771',2021,2022,96000.00,'operacional'],
      ['221012757','I-06523','FQU0E18','RENAULT','DUSTER 16 E 4X2','93YHJD206NJ797098','1256623676',2021,2021,57450.00,'operacional'],
      ['221012785','I-06531','GDS5H96','RENAULT','DUSTER 16 E 4X2','93YHJD207NJ797076','1256619237',2021,2021,57450.00,'operacional'],
      ['221012794','I-06530','ECW0G27','RENAULT','DUSTER 16 E 4X2','93YHJD208NJ797037','1256662868',2021,2021,57450.00,'operacional'],
      ['220009408','I-06517','EJF5I29','VW','GOL PATRULHEIRO 1.6','9BWAB45U3MT002109','1231092863',2020,2020,44050.00,'operacional'],
      ['219026928','I-06522','FPU0546','VW','GOL PATRULHEIRO 1.6','9BWAB45U9LT076116','1212061095',2019,2020,44050.00,'operacional'],
      ['219002240','I-06514','CMM5193','MERCEDES-BENZ','SPRINTER FFORMA','8AC906633KE171433','1206409417',2019,2020,151300.00,'operacional'],
      ['219004066','I-06583','DJL1624','HONDA','XRE 300','9C2ND1120KR002794','1198305794',2019,2020,26000.00,'operacional'],
      ['219023464','I-06518','CUC3590','CHEVROLET','SPIN 1.8L MT LT','9BGJD7520LB152240','1212061273',2019,2020,57500.00,'operacional'],
      ['219023774','I-06515','CQU0798','CHEVROLET','SPIN 1.8L MT LT','9BGJD7520LB147028','1213051468',2019,2020,57500.00,'operacional'],
      ['219023417','SEM-PREFIXO-1','BYQ6925','CHEVROLET','SPIN 1.8L MT LT','9BGJD7520LB147565','1213673876',2019,2020,57500.00,'descarga'],
      ['219026925','SEM-PREFIXO-2','EQU1537','VW','GOL PATRULHEIRO 1.6','9BWAB45UXLT074827','1212059422',2019,2020,44050.00,'descarga'],
      ['220000033','SEM-PREFIXO-3','FZN3635','RENAULT','DUSTER 16 E 4X2','93YHSR3H5LJ194815','1221171396',2019,2020,57450.00,'descarga'],
      ['220007226','SEM-PREFIXO-4','FPJ0H96','RENAULT','DUSTER 16 E 4X2','93YHJD205MJ448416','1229266744',2020,2020,57450.00,'descarga'],
      ['215047222','SEM-PREFIXO-5','FZQ5684','CHEVROLET','SPIN 1.8L MT LT','9BGJB75E0GB133080','1066079347',2015,2015,58010.37,'descarga'],
      ['218034094','SEM-PREFIXO-6','DMM7512','CHEVROLET','SPIN 1.8L MT LT','9BGJG7520KB134030','1171385304',2018,2018,53700.00,'descarga'],
      ['218034095','SEM-PREFIXO-7','EUV2006','CHEVROLET','SPIN 1.8L MT LT','9BGJG7520KB134046','1171418245',2018,2018,53700.00,'descarga'],
      ['219004065','SEM-PREFIXO-8','DJL1562','HONDA','XRE 300','9C2ND1120KR002788','1198303678',2019,2020,26000.00,'descarga'],
      ['219007052','SEM-PREFIXO-9','CFZ4587','CHEVROLET','SPIN 1.8L MT LT','9BGJD7520LB101472','1197054542',2019,2020,49750.00,'descarga'],
      ['219007063','SEM-PREFIXO-10','BXC5874','CHEVROLET','SPIN 1.8L MT LT','9BGJD7520LB110774','1200617891',2019,2020,49750.00,'descarga'],
      ['212067345','SEM-PREFIXO-11','DJM6191','FIAT','PALIO WEEK TREKKING','9BD373184D5017466','496610767',2012,2013,42410.00,'descarga'],
      ['212067573','SEM-PREFIXO-12','BYY0349','YAMAHA','LANDER XTZ250','9C6KG0210D0055212','499429990',2012,2013,15000.00,'descarga'],
      ['212067597','SEM-PREFIXO-13','BYY0373','YAMAHA','LANDER XTZ250','9C6KG0210D0055290','499423623',2012,2013,15000.00,'descarga'],
      ['213052610','SEM-PREFIXO-14','CFY4680','VW','SPACEFOX','9BWPB45Z9E4052935','593525680',2013,2014,46000.00,'descarga'],
      ['214032090','SEM-PREFIXO-15','EEF9552','VW','SPACEFOX PAT MA','9BWPB45Z2E4148115','1012269652',2014,2014,46000.00,'descarga'],
    ];

    for (const [pat, prefixo, placa, marca, modelo, chassi, renavam, ano_fab, ano_mod, valor, situacao] of viaturas) {
      await client.query(`
        INSERT INTO viaturas (patrimonio,prefixo,placa,marca,modelo,chassi,renavam,ano_fabricacao,ano_modelo,valor,unidade_opm,situacao,km_atual,combustivel)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'606065000',$11,0,'flex')
        ON CONFLICT (patrimonio) DO UPDATE SET prefixo=EXCLUDED.prefixo,placa=EXCLUDED.placa,marca=EXCLUDED.marca,modelo=EXCLUDED.modelo,valor=EXCLUDED.valor,situacao=EXCLUDED.situacao
      `, [pat, prefixo, placa, marca, modelo, chassi, renavam, ano_fab, ano_mod, valor, situacao]);
    }

    await client.query('COMMIT');
    const r = await pool.query(`SELECT situacao, COUNT(*) FROM viaturas GROUP BY situacao`);
    res.json({ ok: true, mensagem: 'Viaturas atualizadas!', totais: r.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false, erro: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// FIX — corrige situacoes de viaturas
// ============================================================
router.get('/fix-situacao-viaturas', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE viaturas DROP CONSTRAINT IF EXISTS viaturas_situacao_check`);
    await pool.query(`ALTER TABLE viaturas ADD CONSTRAINT viaturas_situacao_check CHECK (situacao IN ('operacional','baixada','descarga'))`);
    await pool.query(`UPDATE viaturas SET situacao = 'baixada' WHERE situacao IN ('em_manutencao','inservivel','aguardando_liberacao','reserva')`);
    const r = await pool.query(`SELECT situacao, COUNT(*) FROM viaturas GROUP BY situacao`);
    res.json({ ok: true, mensagem: 'Situacoes atualizadas!', totais: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ============================================================
// TEST CLOUDINARY
// ============================================================
router.get('/test-cloudinary', async (req, res) => {
  try {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await cloudinary.api.ping();
    res.json({
      ok: true,
      cloudinary: result,
      config: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY ? 'configurado' : 'NAO CONFIGURADO',
        api_secret: process.env.CLOUDINARY_API_SECRET ? 'configurado' : 'NAO CONFIGURADO'
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
