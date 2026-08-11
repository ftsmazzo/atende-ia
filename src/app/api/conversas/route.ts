import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";
import { parseMemoryMessage } from "@/lib/crm";
import { tables } from "@/lib/schema";

export async function GET(request: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { searchParams } = new URL(request.url);
  const filtroRaw = searchParams.get("filtro") ?? "todas";
  // Corretor só vê o que foi encaminhado para ele.
  const filtro = user.papel === "corretor" ? "minhas" : filtroRaw;
  const q = searchParams.get("q")?.trim() ?? "";
  const { contacts, attendances, messages, history, contactPhone, contactName } = tables;

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (user.papel === "corretor" || filtro === "minhas") {
    params.push(user.id);
    where.push(`a.operador_id = $${params.length}`);
  } else if (filtro === "humano") {
    where.push(`COALESCE(a.modo, 'ia') = 'humano'`);
  } else if (filtro === "ia") {
    where.push(`COALESCE(a.modo, 'ia') = 'ia'`);
  }
  if (q) {
    params.push(`%${q}%`);
    if (user.papel === "corretor") {
      where.push(`COALESCE(c.${contactName}::text, '') ILIKE $${params.length}`);
    } else {
      where.push(
        `(x.telefone ILIKE $${params.length} OR COALESCE(c.${contactName}::text, '') ILIKE $${params.length})`,
      );
    }
  }

  // Ordem da lista: created_at do histórico + só mensagens “vivas” do painel
  // (com id WA ou enviadas por humano). Evita import antigo com NOW() subir tudo pra hoje.
  const rows = await query(
    `
    WITH hist_last AS (
      SELECT DISTINCT ON (telefone)
        regexp_replace(session_id, '@s\\.whatsapp\\.net$', '') AS telefone,
        created_at AS ultima_hist,
        message AS preview_hist
      FROM ${history}
      ORDER BY
        regexp_replace(session_id, '@s\\.whatsapp\\.net$', ''),
        created_at DESC,
        id DESC
    ),
    painel_live AS (
      SELECT DISTINCT ON (telefone)
        telefone,
        created_at AS ultima_painel,
        texto AS preview_painel,
        direcao AS direcao_painel
      FROM ${messages}
      WHERE id_mensagem_wa IS NOT NULL
         OR direcao = 'outbound_humano'
      ORDER BY telefone, created_at DESC, id DESC
    ),
    phones AS (
      SELECT telefone FROM hist_last
      UNION
      SELECT telefone FROM painel_live
    ),
    ranked AS (
      SELECT
        p.telefone,
        GREATEST(
          COALESCE(h.ultima_hist, '-infinity'::timestamptz),
          COALESCE(m.ultima_painel, '-infinity'::timestamptz)
        ) AS ultima,
        CASE
          WHEN COALESCE(m.ultima_painel, '-infinity'::timestamptz)
             > COALESCE(h.ultima_hist, '-infinity'::timestamptz)
          THEN 'painel'
          ELSE 'historico'
        END AS fonte,
        h.preview_hist,
        m.preview_painel,
        m.direcao_painel
      FROM phones p
      LEFT JOIN hist_last h ON h.telefone = p.telefone
      LEFT JOIN painel_live m ON m.telefone = p.telefone
    )
    SELECT
      x.telefone,
      c.${contactName} AS nome_cliente,
      COALESCE(a.modo, 'ia') AS modo,
      a.operador_id,
      u.nome AS operador,
      x.ultima,
      CASE
        WHEN x.fonte = 'historico' THEN COALESCE(x.preview_hist::text, '')
        ELSE COALESCE(x.preview_painel, '')
      END AS preview,
      COALESCE(x.direcao_painel, 'historico') AS direcao,
      x.fonte
    FROM ranked x
    LEFT JOIN ${contacts} c ON c.${contactPhone} = x.telefone
    LEFT JOIN ${attendances} a ON a.telefone = x.telefone
    LEFT JOIN usuarios_painel u ON u.id = a.operador_id
    WHERE ${where.join(" AND ")}
    ORDER BY ultima DESC NULLS LAST
    LIMIT 80
    `,
    params,
  );

  const conversas = rows.map((row) => {
    const previewRaw = String(row.preview ?? "");
    if (row.fonte === "historico" || previewRaw.trim().startsWith("{")) {
      try {
        const parsed = parseMemoryMessage(
          previewRaw.trim().startsWith("{") ? JSON.parse(previewRaw) : previewRaw,
        );
        if (parsed?.text) {
          return {
            ...row,
            preview: parsed.text.slice(0, 160),
            direcao: parsed.role === "human" ? "inbound" : "outbound_ia",
          };
        }
      } catch {
        const parsed = parseMemoryMessage(previewRaw);
        if (parsed?.text) {
          return {
            ...row,
            preview: parsed.text.slice(0, 160),
            direcao: parsed.role === "human" ? "inbound" : "outbound_ia",
          };
        }
      }
    }
    return row;
  });

  return NextResponse.json({ conversas });
}
