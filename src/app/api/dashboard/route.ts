import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isAdmin } from "@/lib/access";
import { isResponse, requireUser } from "@/lib/api";
import { tables } from "@/lib/schema";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { contacts, actions, attendances, messages, contactPhone, contactName } = tables;
  const admin = isAdmin(user);

  const [kpis] = admin
    ? await query<{
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
  `)
    : await query<{
        contatos: string;
        contatos_7d: string;
        acoes: string;
        acoes_7d: string;
        humanos: string;
        mensagens_7d: string;
        conversas_ativas_7d: string;
      }>(
        `
    SELECT
      (SELECT COUNT(*)::text FROM ${attendances} WHERE operador_id = $1) AS contatos,
      '0'::text AS contatos_7d,
      '0'::text AS acoes,
      '0'::text AS acoes_7d,
      (SELECT COUNT(*)::text FROM ${attendances} WHERE operador_id = $1 AND modo = 'humano') AS humanos,
      (SELECT COUNT(*)::text FROM ${messages} m
         JOIN ${attendances} a ON a.telefone = m.telefone
        WHERE a.operador_id = $1 AND m.created_at >= NOW() - INTERVAL '7 days') AS mensagens_7d,
      (SELECT COUNT(*)::text FROM ${attendances} WHERE operador_id = $1 AND modo = 'humano') AS conversas_ativas_7d
  `,
        [user.id],
      );

  const acoesPorStatus = admin
    ? await query<{ status: string; total: string }>(`
    SELECT COALESCE(NULLIF(status, ''), '(sem status)') AS status, COUNT(*)::text AS total
    FROM ${actions}
    GROUP BY 1
    ORDER BY COUNT(*) DESC
    LIMIT 8
  `)
    : [];

  const volume = admin
    ? await query<{ dia: string; total: string }>(`
    SELECT to_char(created_at::date, 'DD/MM') AS dia, COUNT(*)::text AS total
    FROM ${messages}
    WHERE created_at >= NOW() - INTERVAL '14 days'
    GROUP BY created_at::date
    ORDER BY created_at::date
  `)
    : await query<{ dia: string; total: string }>(
        `
    SELECT to_char(m.created_at::date, 'DD/MM') AS dia, COUNT(*)::text AS total
    FROM ${messages} m
    JOIN ${attendances} a ON a.telefone = m.telefone
    WHERE a.operador_id = $1 AND m.created_at >= NOW() - INTERVAL '14 days'
    GROUP BY m.created_at::date
    ORDER BY m.created_at::date
  `,
        [user.id],
      );

  const recentes = await query<{
    telefone: string;
    nome_cliente: string | null;
    modo: string;
    operador: string | null;
    ultima: string;
    preview: string;
  }>(
    admin
      ? `
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
  `
      : `
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
    JOIN ${attendances} a ON a.telefone = m.telefone AND a.operador_id = $1
    LEFT JOIN ${contacts} c ON c.${contactPhone} = m.telefone
    LEFT JOIN usuarios_painel u ON u.id = a.operador_id
    ORDER BY m.created_at DESC
    LIMIT 12
  `,
    admin ? [] : [user.id],
  );

  return NextResponse.json({ kpis, acoesPorStatus, volume, recentes, telefone_visivel: admin });
}
