-- Rodar no Adminer do EasyPanel (database pazotti).
-- Cria/atualiza o admin Rodrigo e remove o admin@local.

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

DELETE FROM usuarios_painel WHERE email = 'admin@local';
