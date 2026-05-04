-- CATEGORIAS
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  controla_validade BOOLEAN DEFAULT false,
  controla_km BOOLEAN DEFAULT false,
  controla_municao BOOLEAN DEFAULT false,
  controla_pressao BOOLEAN DEFAULT false,
  requer_numero_serie BOOLEAN DEFAULT false,
  estoque_minimo INT DEFAULT 0,
  intervalo_inspecao_dias INT
);

-- POLICIAIS
CREATE TABLE IF NOT EXISTS policiais (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  matricula VARCHAR(20) UNIQUE NOT NULL,
  patente VARCHAR(50),
  pin VARCHAR(4) NOT NULL,
  perfil VARCHAR(20) DEFAULT 'policial',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ITENS
CREATE TABLE IF NOT EXISTS itens (
  id SERIAL PRIMARY KEY,
  categoria_id INT REFERENCES categorias(id),
  descricao VARCHAR(150) NOT NULL,
  numero_serie VARCHAR(50),
  numero_patrimonio VARCHAR(50) UNIQUE,
  status VARCHAR(20) DEFAULT 'disponivel',
  data_validade DATE,
  data_proxima_inspecao DATE,
  pressao_atual DECIMAL(5,2),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- VIATURAS
CREATE TABLE IF NOT EXISTS viaturas (
  id SERIAL PRIMARY KEY,
  prefixo VARCHAR(20) UNIQUE NOT NULL,
  tipo VARCHAR(20) DEFAULT 'patrulha',
  modelo VARCHAR(50),
  placa VARCHAR(10),
  km_atual INT DEFAULT 0,
  km_proxima_troca_oleo INT,
  status VARCHAR(20) DEFAULT 'disponivel',
  motivo_baixa TEXT,
  qr_code VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- KITS POR VIATURA
CREATE TABLE IF NOT EXISTS kit_viaturas (
  id SERIAL PRIMARY KEY,
  viatura_id INT REFERENCES viaturas(id),
  item_id INT REFERENCES itens(id),
  quantidade INT DEFAULT 1,
  obrigatorio BOOLEAN DEFAULT true
);

-- BOLETINS DE SERVICO
CREATE TABLE IF NOT EXISTS boletins_servico (
  id SERIAL PRIMARY KEY,
  data_servico DATE NOT NULL,
  turno VARCHAR(20),
  gestor_responsavel VARCHAR(100),
  status VARCHAR(20) DEFAULT 'aberto',
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- BOLETIM VIATURAS
CREATE TABLE IF NOT EXISTS boletim_vtrs (
  id SERIAL PRIMARY KEY,
  boletim_id INT REFERENCES boletins_servico(id),
  viatura_id INT REFERENCES viaturas(id),
  policial_id INT REFERENCES policiais(id),
  tipo VARCHAR(20) DEFAULT 'patrulha',
  km_inicial INT,
  km_final INT,
  status_vtr VARCHAR(20) DEFAULT 'operando'
);

-- BOLETIM MATERIAIS
CREATE TABLE IF NOT EXISTS boletim_materiais (
  id SERIAL PRIMARY KEY,
  boletim_vtr_id INT REFERENCES boletim_vtrs(id),
  item_id INT REFERENCES itens(id),
  quantidade INT,
  numero_serie VARCHAR(50),
  numero_patrimonio VARCHAR(50),
  devolvido BOOLEAN DEFAULT false,
  quantidade_utilizada INT DEFAULT 0,
  observacao TEXT
);

-- MOVIMENTACOES
CREATE TABLE IF NOT EXISTS movimentacoes (
  id SERIAL PRIMARY KEY,
  item_id INT REFERENCES itens(id),
  policial_id INT REFERENCES policiais(id),
  tipo VARCHAR(20) NOT NULL,
  data_movimentacao TIMESTAMP DEFAULT NOW(),
  observacao TEXT,
  gestor_responsavel VARCHAR(100)
);

-- REGISTROS DE KM
CREATE TABLE IF NOT EXISTS registros_km (
  id SERIAL PRIMARY KEY,
  viatura_id INT REFERENCES viaturas(id),
  policial_id INT REFERENCES policiais(id),
  km_registrado INT NOT NULL,
  data_registro TIMESTAMP DEFAULT NOW(),
  observacao TEXT
);

-- MANUTENCOES
CREATE TABLE IF NOT EXISTS manutencoes (
  id SERIAL PRIMARY KEY,
  viatura_id INT REFERENCES viaturas(id),
  tipo VARCHAR(50),
  km_realizado INT,
  data_realizada DATE NOT NULL,
  km_proximo_alerta INT,
  observacao TEXT
);

-- ABASTECIMENTOS
CREATE TABLE IF NOT EXISTS abastecimentos (
  id SERIAL PRIMARY KEY,
  viatura_id INT REFERENCES viaturas(id),
  policial_id INT REFERENCES policiais(id),
  data_abastecimento TIMESTAMP DEFAULT NOW(),
  km_atual INT NOT NULL,
  litros DECIMAL(6,2) NOT NULL,
  valor_total DECIMAL(8,2) NOT NULL,
  posto_nome VARCHAR(100),
  foto_cupom_url TEXT,
  status VARCHAR(20) DEFAULT 'pendente',
  observacao_gestor TEXT,
  editado_por VARCHAR(100),
  editado_em TIMESTAMP
);

-- INSPECOES EPI
CREATE TABLE IF NOT EXISTS inspecoes_epi (
  id SERIAL PRIMARY KEY,
  item_id INT REFERENCES itens(id),
  data_inspecao DATE NOT NULL,
  resultado VARCHAR(20),
  proxima_inspecao DATE,
  observacao TEXT,
  inspecionado_por VARCHAR(100)
);

-- INCIDENTES EPI
CREATE TABLE IF NOT EXISTS incidentes_epi (
  id SERIAL PRIMARY KEY,
  item_id INT REFERENCES itens(id),
  policial_id INT REFERENCES policiais(id),
  data_incidente TIMESTAMP,
  tipo VARCHAR(50),
  resultado VARCHAR(30),
  relato TEXT,
  registrado_por VARCHAR(100)
);

-- ASSUNCOES VTR
CREATE TABLE IF NOT EXISTS assuncoes_vtr (
  id SERIAL PRIMARY KEY,
  viatura_id INT REFERENCES viaturas(id),
  policial_id INT REFERENCES policiais(id),
  data_inicio TIMESTAMP DEFAULT NOW(),
  data_fim TIMESTAMP,
  km_inicial INT,
  km_final INT,
  status VARCHAR(20) DEFAULT 'ativa'
);

-- CHAVES VTR
CREATE TABLE IF NOT EXISTS chaves_vtr (
  id SERIAL PRIMARY KEY,
  viatura_id INT REFERENCES viaturas(id),
  policial_id INT REFERENCES policiais(id),
  retirada_em TIMESTAMP DEFAULT NOW(),
  devolvida_em TIMESTAMP,
  recebida_por VARCHAR(100),
  gancho_cofre VARCHAR(20),
  status VARCHAR(20) DEFAULT 'retirada'
);

-- TALOES CRR CET
CREATE TABLE IF NOT EXISTS taloes_cet (
  id SERIAL PRIMARY KEY,
  viatura_id INT REFERENCES viaturas(id),
  policial_id INT REFERENCES policiais(id),
  numero_talao VARCHAR(20) NOT NULL,
  folhas_saida INT NOT NULL,
  folhas_retorno INT,
  multas_emitidas INT,
  data_uso DATE DEFAULT NOW(),
  observacao TEXT
);

-- CHECKLIST VISTORIA
CREATE TABLE IF NOT EXISTS checklists_vistoria (
  id SERIAL PRIMARY KEY,
  viatura_id INT REFERENCES viaturas(id),
  policial_id INT REFERENCES policiais(id),
  data_vistoria TIMESTAMP DEFAULT NOW(),
  lataria_ok BOOLEAN,
  pneus_ok BOOLEAN,
  combustivel VARCHAR(10),
  sirene_ok BOOLEAN,
  giroflex_ok BOOLEAN,
  extintor_ok BOOLEAN,
  triangulo_ok BOOLEAN,
  kit_primeiros_socorros_ok BOOLEAN,
  dano_preexistente BOOLEAN DEFAULT false,
  descricao_dano TEXT,
  foto_dano_url TEXT
);

-- LOG DE EDICOES
CREATE TABLE IF NOT EXISTS log_edicoes (
  id SERIAL PRIMARY KEY,
  tabela VARCHAR(50),
  registro_id INT,
  campo_alterado VARCHAR(50),
  valor_anterior TEXT,
  valor_novo TEXT,
  editado_por VARCHAR(100),
  editado_em TIMESTAMP DEFAULT NOW()
);

-- GESTOR
INSERT INTO policiais (nome, matricula, patente, pin, perfil) 
VALUES ('Gestor', 'admin', 'Gestor', '1234', 'gestor')
ON CONFLICT (matricula) DO NOTHING;

-- CATEGORIAS INICIAIS
INSERT INTO categorias (nome, requer_numero_serie, controla_municao) VALUES ('Armamento', true, true) ON CONFLICT DO NOTHING;
INSERT INTO categorias (nome, controla_validade, controla_pressao) VALUES ('EPI', true, true) ON CONFLICT DO NOTHING;
INSERT INTO categorias (nome, controla_km) VALUES ('Viatura', true) ON CONFLICT DO NOTHING;
INSERT INTO categorias (nome, estoque_minimo) VALUES ('Escritorio', 10) ON CONFLICT DO NOTHING;
