import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";
import { extractCrmFromTexts, isBadName, mergeCrm, parseMemoryMessage, type ContatoCrm } from "@/lib/crm";
import { tables } from "@/lib/schema";

type Params = { params: Promise<{ telefone: string }> };

async function upsertContato(data: ContatoCrm) {
  const { contacts, contactPhone, contactName } = tables;
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
      data.telefone,
      data.nome_cliente ?? null,
      data.perfil_cliente ?? null,
      data.preferencia_local ?? null,
      data.compra_comalguem ?? null,
      data.tipo_renda ?? null,
      data.renda_bruta ?? null,
    ],
  );
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { telefone } = await params;
  const body = (await request.json()) as Partial<ContatoCrm>;
  await upsertContato({
    telefone,
    nome_cliente: body.nome_cliente,
    perfil_cliente: body.perfil_cliente,
    preferencia_local: body.preferencia_local,
    compra_comalguem: body.compra_comalguem,
    tipo_renda: body.tipo_renda,
    renda_bruta: body.renda_bruta === undefined || body.renda_bruta === null
      ? null
      : Number(body.renda_bruta),
  });
  return NextResponse.json({ ok: true });
}

export async function POST(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { telefone } = await params;
  const { contacts, contactPhone, messages, history } = tables;

  const painelMsgs = await query<{ direcao: string; texto: string }>(
    `SELECT direcao, texto FROM ${messages} WHERE telefone = $1 ORDER BY id ASC`,
    [telefone],
  );

  let historico: HistoriaSafe[] = [];
  try {
    const rows = await query<{ message?: unknown; mensagem?: unknown }>(
      `SELECT * FROM ${history} WHERE session_id = $1 OR session_id = $2 ORDER BY 1 ASC`,
      [telefone, `${telefone}@s.whatsapp.net`],
    );
    historico = rows
      .map((row) => parseMemoryMessage(row.message ?? row.mensagem))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  } catch {
    historico = [];
  }

  for (const item of historico) {
    const direcao = item.role === "ai" ? "outbound_ia" : item.role === "human" ? "inbound" : null;
    if (!direcao) continue;
    await query(
      `INSERT INTO ${messages} (telefone, direcao, texto, instancia)
       SELECT $1, $2, $3, $4
       WHERE NOT EXISTS (
         SELECT 1 FROM ${messages}
         WHERE telefone = $1 AND direcao = $2 AND texto = $3
       )`,
      [telefone, direcao, item.text.slice(0, 8000), process.env.EVOLUTION_INSTANCE ?? null],
    );
  }

  const [contato] = await query<Record<string, unknown>>(
    `SELECT * FROM ${contacts} WHERE ${contactPhone} = $1`,
    [telefone],
  );
  const textos = [
    ...historico.filter((m) => m.role === "human").map((m) => m.text),
    ...painelMsgs.filter((m) => m.direcao === "inbound").map((m) => m.texto),
  ];
  const extracted = extractCrmFromTexts(telefone, textos);
  if (isBadName(extracted.nome_cliente) && typeof contato?.nome_cliente === "string") {
    extracted.nome_cliente = contato.nome_cliente as string;
  }
  const merged = mergeCrm(
    contato
      ? {
          telefone,
          nome_cliente: (contato.nome_cliente as string) ?? null,
          perfil_cliente: (contato.perfil_cliente as string) ?? null,
          preferencia_local: (contato.preferencia_local as string) ?? null,
          compra_comalguem: (contato.compra_comalguem as string) ?? null,
          tipo_renda: (contato.tipo_renda as string) ?? null,
          renda_bruta: contato.renda_bruta == null ? null : Number(contato.renda_bruta),
        }
      : null,
    extracted,
  );
  await upsertContato(merged);
  return NextResponse.json({ ok: true, contato: merged, importadas: historico.length });
}

type HistoriaSafe = NonNullable<ReturnType<typeof parseMemoryMessage>>;
