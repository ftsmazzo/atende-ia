-- Tabelas do painel (genéricas — um database por cliente)
-- As tabelas de CRM do cliente (contatos / ações) continuam as dele;
-- aponte os nomes via env no app (CONTACTS_TABLE, ACTIONS_TABLE, ...).

CREATE TABLE IF NOT EXISTS usuarios_painel (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'corretor' CHECK (papel IN ('admin', 'corretor')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atendimentos_agente (
  telefone TEXT PRIMARY KEY,
  modo TEXT NOT NULL DEFAULT 'ia' CHECK (modo IN ('ia', 'humano')),
  operador_id INTEGER REFERENCES usuarios_painel(id) ON DELETE SET NULL,
  assumido_em TIMESTAMPTZ,
  devolvido_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensagens_agente (
  id BIGSERIAL PRIMARY KEY,
  telefone TEXT NOT NULL,
  direcao TEXT NOT NULL CHECK (direcao IN ('inbound', 'outbound_ia', 'outbound_humano')),
  texto TEXT NOT NULL DEFAULT '',
  id_mensagem_wa TEXT UNIQUE,
  instancia TEXT,
  operador_id INTEGER REFERENCES usuarios_painel(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_telefone_created
  ON mensagens_agente (telefone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_created
  ON mensagens_agente (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_atendimentos_modo
  ON atendimentos_agente (modo);

INSERT INTO usuarios_painel (nome, email, senha_hash, papel, ativo)
VALUES (
  'Rodrigo Pazotti',
  'rodrigovazpazotti@gmail.com',
  '$2b$10$1JSmXCH/gRlJZSc.tfrsfOy3BnU9CCi3IoKIJ/Ze0e.3V/z1MriBy',
  'admin',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  nome = EXCLUDED.nome,
  senha_hash = EXCLUDED.senha_hash,
  papel = EXCLUDED.papel,
  ativo = TRUE;

-- login: rodrigovazpazotti@gmail.com / p@zotti2026!
DELETE FROM usuarios_painel WHERE email = 'admin@local';
