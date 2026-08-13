import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { assertConversaAccess } from "@/lib/access";
import { isResponse, requireUser } from "@/lib/api";
import { parseMemoryMessage } from "@/lib/crm";
import { tables } from "@/lib/schema";

type Params = { params: Promise<{ telefone: string }> };

type MsgRow = {
  id: number | string;
  direcao: string;
  texto: string;
  created_at: string;
  id_mensagem_wa?: string | null;
  reacao?: string | null;
  fonte: "painel" | "historico";
};

function normText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Une histórico (created_at real) com mensagens do painel (WA / humano). */
function mergeTimeline(historico: MsgRow[], painel: MsgRow[]): MsgRow[] {
  const histBuckets = new Map<string, MsgRow[]>();
  for (const msg of historico) {
    const key = `${msg.direcao}|${normText(msg.texto)}`;
    const list = histBuckets.get(key) ?? [];
    list.push(msg);
    histBuckets.set(key, list);
  }

  const used = new Set<string>();
  const merged: MsgRow[] = [];

  for (const msg of painel) {
    const key = `${msg.direcao}|${normText(msg.texto)}`;
    const bucket = histBuckets.get(key);
    const match = bucket?.shift();
    if (match) {
      used.add(`${match.id}`);
      merged.push({
        ...msg,
        // data/hora real do histórico; metadados WA/reação do painel
        created_at: match.created_at,
      });
    } else {
      merged.push(msg);
    }
  }

  for (const msg of historico) {
    if (!used.has(`${msg.id}`)) merged.push(msg);
  }

  return merged.sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
}

/** Últimas N trocas (ida ou volta), sem recorte por data. */
const MAX_TROCAS = 7;
/** Busca folgada para o merge historico+painel ainda achar pares. */
const FETCH_LIMIT = 40;

export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { telefone } = await params;
  const allowed = await assertConversaAccess(user, telefone);
  if (allowed !== true) return allowed;
  const { contacts, attendances, messages, history, contactPhone } = tables;

  const [contato] = await query(
    `SELECT * FROM ${contacts} WHERE ${contactPhone} = $1`,
    [telefone],
  );
  const [atendimento] = await query(
    `SELECT a.modo, a.operador_id, a.assumido_em, u.nome AS operador
     FROM ${attendances} a
     LEFT JOIN usuarios_painel u ON u.id = a.operador_id
     WHERE a.telefone = $1`,
    [telefone],
  );

  let painel: MsgRow[] = [];
  try {
    const rows = await query<{
      id: number;
      direcao: string;
      texto: string;
      created_at: string;
      id_mensagem_wa?: string | null;
      reacao?: string | null;
    }>(
      `SELECT id, direcao, texto, operador_id, created_at, id_mensagem_wa, reacao
       FROM ${messages}
       WHERE telefone = $1
       ORDER BY created_at DESC, id DESC
       LIMIT ${FETCH_LIMIT}`,
      [telefone],
    );
    painel = rows
      .slice()
      .reverse()
      .map((r) => ({ ...r, fonte: "painel" as const }));
  } catch {
    const rows = await query<{
      id: number;
      direcao: string;
      texto: string;
      created_at: string;
      id_mensagem_wa?: string | null;
    }>(
      `SELECT id, direcao, texto, operador_id, created_at, id_mensagem_wa
       FROM ${messages}
       WHERE telefone = $1
       ORDER BY created_at DESC, id DESC
       LIMIT ${FETCH_LIMIT}`,
      [telefone],
    );
    painel = rows
      .slice()
      .reverse()
      .map((r) => ({ ...r, fonte: "painel" as const }));
  }

  let historico: MsgRow[] = [];
  try {
    const rows = await query<{
      id: number;
      message?: unknown;
      created_at: string;
    }>(
      `SELECT id, message, created_at
       FROM ${history}
       WHERE (session_id = $1 OR session_id = $2)
       ORDER BY created_at DESC, id DESC
       LIMIT ${FETCH_LIMIT}`,
      [telefone, `${telefone}@s.whatsapp.net`],
    );
    historico = rows
      .slice()
      .reverse()
      .flatMap((row) => {
      const parsed = parseMemoryMessage(row.message);
      if (!parsed || parsed.role === "other") return [];
      const msg: MsgRow = {
        id: `h-${row.id}`,
        direcao: parsed.role === "human" ? "inbound" : "outbound_ia",
        texto: parsed.text,
        created_at: row.created_at,
        id_mensagem_wa: null,
        reacao: null,
        fonte: "historico",
      };
      return [msg];
    });
  } catch {
    historico = [];
  }

  const mensagens = mergeTimeline(historico, painel).slice(-MAX_TROCAS);

  const operadores =
    user.papel === "admin"
      ? await query(`SELECT id, nome, papel FROM usuarios_painel WHERE ativo = TRUE ORDER BY nome`)
      : [];

  const contatoSafe =
    contato && user.papel === "corretor"
      ? Object.fromEntries(
          Object.entries(contato as Record<string, unknown>).filter(([key]) => key !== contactPhone),
        )
      : (contato ?? null);

  return NextResponse.json({
    contato: contatoSafe,
    atendimento,
    mensagens,
    operadores,
    telefone_visivel: user.papel === "admin",
  });
}
