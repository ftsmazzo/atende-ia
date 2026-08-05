import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";
import { tables } from "@/lib/schema";

export async function GET(request: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { searchParams } = new URL(request.url);
  const filtro = searchParams.get("filtro") ?? "todas";
  const q = searchParams.get("q")?.trim() ?? "";
  const { contacts, attendances, messages, contactPhone, contactName } = tables;

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filtro === "humano") where.push(`COALESCE(a.modo, 'ia') = 'humano'`);
  if (filtro === "ia") where.push(`COALESCE(a.modo, 'ia') = 'ia'`);
  if (filtro === "minhas") {
    params.push(user.id);
    where.push(`a.operador_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(m.telefone ILIKE $${params.length} OR COALESCE(c.${contactName}::text, '') ILIKE $${params.length})`);
  }

  const rows = await query(
    `
    SELECT
      m.telefone,
      c.${contactName} AS nome_cliente,
      COALESCE(a.modo, 'ia') AS modo,
      a.operador_id,
      u.nome AS operador,
      m.created_at AS ultima,
      LEFT(m.texto, 160) AS preview,
      m.direcao
    FROM ${messages} m
    JOIN (
      SELECT telefone, MAX(id) AS id
      FROM ${messages}
      GROUP BY telefone
    ) last ON last.id = m.id
    LEFT JOIN ${contacts} c ON c.${contactPhone} = m.telefone
    LEFT JOIN ${attendances} a ON a.telefone = m.telefone
    LEFT JOIN usuarios_painel u ON u.id = a.operador_id
    WHERE ${where.join(" AND ")}
    ORDER BY m.created_at DESC
    LIMIT 80
    `,
    params,
  );

  return NextResponse.json({ conversas: rows });
}
