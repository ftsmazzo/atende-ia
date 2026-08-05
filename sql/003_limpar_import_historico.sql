-- Remove mensagens jogadas no inbox pelo "Varrer histórico".
-- Inbound real do WhatsApp sempre tem id_mensagem_wa.

DELETE FROM mensagens_agente
WHERE id_mensagem_wa IS NULL
  AND direcao = 'inbound';

DELETE FROM mensagens_agente m
WHERE m.id_mensagem_wa IS NULL
  AND m.direcao = 'outbound_ia'
  AND (
    SELECT COUNT(*)
    FROM mensagens_agente x
    WHERE x.telefone = m.telefone
      AND x.id_mensagem_wa IS NULL
      AND x.direcao = 'outbound_ia'
      AND date_trunc('minute', x.created_at) = date_trunc('minute', m.created_at)
  ) >= 4;
