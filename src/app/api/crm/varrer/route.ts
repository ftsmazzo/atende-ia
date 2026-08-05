import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";
import { extractCrmFromTexts, mergeCrm, parseMemoryMessage } from "@/lib/crm";
import { tables } from "@/lib/schema";

export async function POST() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.papel !== "admin") {
    return NextResponse.json({ error: "Apenas admin pode varrer o CRM" }, { status: 403 });
  }

  const { contacts, contactPhone, contactName, messages, history } = tables;
  let sessions: string[] = [];
  try {
    const rows = await query<{ session_id: string }>(
      `SELECT DISTINCT session_id FROM ${history}`,
    );
    sessions = rows.map((r) => String(r.session_id || "").replace(/@s\.whatsapp\.net$/, "")).filter(Boolean);
  } catch {
    const rows = await query<{ telefone: string }>(`SELECT DISTINCT telefone FROM ${messages}`);
    sessions = rows.map((r) => r.telefone);
  }

  let atualizados = 0;
  for (const telefone of [...new Set(sessions)]) {
    const painelMsgs = await query<{ direcao: string; texto: string }>(
      `SELECT direcao, texto FROM ${messages} WHERE telefone = $1 ORDER BY id ASC`,
      [telefone],
    );
    let historico = painelMsgs.map((m) => ({
      role: m.direcao === "outbound_ia" ? "ai" : m.direcao === "inbound" ? "human" : "other",
      text: m.texto,
    }));
    try {
      const rows = await query<{ message?: unknown; mensagem?: unknown }>(
        `SELECT * FROM ${history} WHERE session_id = $1 OR session_id = $2`,
        [telefone, `${telefone}@s.whatsapp.net`],
      );
      const parsed = rows
        .map((row) => parseMemoryMessage(row.message ?? row.mensagem))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (parsed.length) historico = parsed;
    } catch {
      /* histórico opcional */
    }

    const [contato] = await query<Record<string, unknown>>(
      `SELECT * FROM ${contacts} WHERE ${contactPhone} = $1`,
      [telefone],
    );
    const extracted = extractCrmFromTexts(
      telefone,
      historico.filter((m) => m.role === "human").map((m) => m.text),
    );
    const merged = mergeCrm(
      contato
        ? {
            telefone,
            nome_cliente: (contato[contactName] as string) ?? (contato.nome_cliente as string) ?? null,
            perfil_cliente: (contato.perfil_cliente as string) ?? null,
            preferencia_local: (contato.preferencia_local as string) ?? null,
            compra_comalguem: (contato.compra_comalguem as string) ?? null,
            tipo_renda: (contato.tipo_renda as string) ?? null,
            renda_bruta: contato.renda_bruta == null ? null : Number(contato.renda_bruta),
          }
        : null,
      extracted,
    );
    await query(
      `INSERT INTO ${contacts} (
          ${contactPhone}, ${contactName}, perfil_cliente, preferencia_local,
          compra_comalguem, tipo_renda, renda_bruta, updated_at
        )
       VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
       ON CONFLICT (${contactPhone}) DO UPDATE SET
         ${contactName} = COALESCE(NULLIF(EXCLUDED.${contactName}, ''), ${contacts}.${contactName}),
         perfil_cliente = COALESCE(NULLIF(EXCLUDED.perfil_cliente, ''), ${contacts}.perfil_cliente),
         preferencia_local = COALESCE(NULLIF(EXCLUDED.preferencia_local, ''), ${contacts}.preferencia_local),
         compra_comalguem = COALESCE(NULLIF(EXCLUDED.compra_comalguem, ''), ${contacts}.compra_comalguem),
         tipo_renda = COALESCE(NULLIF(EXCLUDED.tipo_renda, ''), ${contacts}.tipo_renda),
         renda_bruta = COALESCE(EXCLUDED.renda_bruta, ${contacts}.renda_bruta),
         updated_at = NOW()`,
      [
        telefone,
        merged.nome_cliente ?? null,
        merged.perfil_cliente ?? null,
        merged.preferencia_local ?? null,
        merged.compra_comalguem ?? null,
        merged.tipo_renda ?? null,
        merged.renda_bruta ?? null,
      ],
    );
    atualizados += 1;
  }

  return NextResponse.json({ ok: true, atualizados });
}
