import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isResponse, requireUser } from "@/lib/api";
import { tables } from "@/lib/schema";

type Params = { params: Promise<{ telefone: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { telefone } = await params;
  const { contacts, actions, attendances, messages, contactPhone } = tables;

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
  let mensagens: Record<string, unknown>[] = [];
  try {
    mensagens = await query(
      `SELECT id, direcao, texto, operador_id, created_at, id_mensagem_wa, reacao
       FROM ${messages}
       WHERE telefone = $1
       ORDER BY created_at ASC, id ASC
       LIMIT 400`,
      [telefone],
    );
  } catch {
    mensagens = await query(
      `SELECT id, direcao, texto, operador_id, created_at, id_mensagem_wa
       FROM ${messages}
       WHERE telefone = $1
       ORDER BY created_at ASC, id ASC
       LIMIT 400`,
      [telefone],
    );
  }
  const acoes = await query(
    `SELECT * FROM ${actions} WHERE ${tables.actionPhone} = $1 ORDER BY 1 DESC LIMIT 20`,
    [telefone],
  );
  const operadores = await query(
    `SELECT id, nome, papel FROM usuarios_painel WHERE ativo = TRUE ORDER BY nome`,
  );

  return NextResponse.json({ contato, atendimento, mensagens, acoes, operadores });
}
