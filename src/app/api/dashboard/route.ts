import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";
import { tables } from "@/lib/schema";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { contacts, actions, attendances, messages, contactPhone, contactName } = tables;

  const [kpis] = await query<{
    contatos: string;
    contatos_7d: string;
    acoes: string;
    acoes_7d: string;
    humanos: string;
    mensagens_7d: string;
    conversas_ativas_7d: string;
  }>(`
    SELECT
      (SELECT COUNT(*)::text FROM ${contacts}) AS contatos,
      (SELECT COUNT(*)::text FROM ${contacts} WHERE created_at >= NOW() - INTERVAL '7 days') AS contatos_7d,
      (SELECT COUNT(*)::text FROM ${actions}) AS acoes,
      (SELECT COUNT(*)::text FROM ${actions} WHERE COALESCE(updated_at, created_at) >= NOW() - INTERVAL '7 days') AS acoes_7d,
      (SELECT COUNT(*)::text FROM ${attendances} WHERE modo = 'humano') AS humanos,
      (SELECT COUNT(*)::text FROM ${messages} WHERE created_at >= NOW() - INTERVAL '7 days') AS mensagens_7d,
      (SELECT COUNT(DISTINCT telefone)::text FROM ${messages} WHERE created_at >= NOW() - INTERVAL '7 days') AS conversas_ativas_7d
  `);

  const acoesPorStatus = await query<{ status: string; total: string }>(`
    SELECT COALESCE(NULLIF(status, ''), '(sem status)') AS status, COUNT(*)::text AS total
    FROM ${actions}
    GROUP BY 1
    ORDER BY COUNT(*) DESC
    LIMIT 8
  `);

  const volume = await query<{ dia: string; total: string }>(`
    SELECT to_char(created_at::date, 'DD/MM') AS dia, COUNT(*)::text AS total
    FROM ${messages}
    WHERE created_at >= NOW() - INTERVAL '14 days'
    GROUP BY created_at::date
    ORDER BY created_at::date
  `);

  const recentes = await query<{
    telefone: string;
    nome_cliente: string | null;
    modo: string;
    operador: string | null;
    ultima: string;
    preview: string;
  }>(`
    SELECT
      m.telefone,
      c.${contactName} AS nome_cliente,
      COALESCE(a.modo, 'ia') AS modo,
      u.nome AS operador,
      m.created_at::text AS ultima,
      LEFT(m.texto, 140) AS preview
    FROM ${messages} m
    JOIN LATERAL (
      SELECT telefone, MAX(id) AS id
      FROM ${messages}
      GROUP BY telefone
    ) last ON last.id = m.id
    LEFT JOIN ${contacts} c ON c.${contactPhone} = m.telefone
    LEFT JOIN ${attendances} a ON a.telefone = m.telefone
    LEFT JOIN usuarios_painel u ON u.id = a.operador_id
    ORDER BY m.created_at DESC
    LIMIT 12
  `);

  return NextResponse.json({ kpis, acoesPorStatus, volume, recentes });
}
