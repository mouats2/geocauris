import { NextResponse } from "next/server";

type Message = { role?: string; content?: string | { type?: string; text?: string }[] };

function textFromMessages(messages: Message[]) {
  return messages.map((message) => {
    const content = Array.isArray(message.content)
      ? message.content.map((part) => part.text ?? "").join("\n")
      : message.content ?? "";
    return `${message.role ?? "user"}: ${content}`;
  }).join("\n\n");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) return NextResponse.json({ error: { message: "messages doit être un tableau", type: "invalid_request_error" } }, { status: 400 });
  const requestedModel = String(body.model ?? "gpt-5.6-luna");
  const modelAliases: Record<string, string> = {
    "gpt-5.6-luna": "gpt-5.6-luna",
    "gpt-5.6-terra": "gpt-5.6-terra",
    "gpt-5.6-sol": "gpt-5.6-sol",
    "glm-5.2": "glm-5.2",
    "nemotron-3-120b-a12b": "nemotron-3-120b-a12b",
  };
  const model = modelAliases[requestedModel.toLowerCase()];
  if (!model) return NextResponse.json({ error: { message: `Modèle non disponible: ${requestedModel}. Utilisez gpt-5.6-luna.`, type: "invalid_request_error", code: "model_not_found" } }, { status: 400 });
  const upstream = await fetch(new URL("/api/proxy", request.url), {
    method: "POST",
    headers: { authorization: request.headers.get("authorization") ?? "", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      input: textFromMessages(body.messages),
      reasoning_effort: body.reasoning_effort ?? "medium",
    }),
  });
  const raw = await upstream.text();
  if (!upstream.ok) {
    let error: unknown = { message: raw || "Erreur du fournisseur IA", type: "upstream_error" };
    try { error = JSON.parse(raw).error ?? error; } catch { /* réponse non JSON */ }
    return NextResponse.json({ error }, { status: upstream.status });
  }
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: { message: "Réponse fournisseur invalide", type: "upstream_error" } }, { status: 502 }); }
  const content = payload.output_text ?? payload.output?.map((item: any) => item.content?.map((part: any) => part.text ?? "").join("")).join("\n") ?? payload.response ?? payload.content ?? "";
  const usage = payload.usage ?? {};
  return NextResponse.json({ id: `chatcmpl-${crypto.randomUUID()}`, object: "chat.completion", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, message: { role: "assistant", content: String(content) }, finish_reason: "stop" }], usage: { prompt_tokens: Number(usage.input_tokens ?? 0), completion_tokens: Number(usage.output_tokens ?? 0), total_tokens: Number(usage.input_tokens ?? 0) + Number(usage.output_tokens ?? 0) } }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
