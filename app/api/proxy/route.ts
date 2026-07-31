import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer cau_")) return NextResponse.json({ error: { message: "Clé API GeoCauris invalide", type: "authentication_error" } }, { status: 401 });
  const masterKey = process.env.IMOLE_MASTER_API_KEY;
  const baseUrl = process.env.IMOLE_API_BASE_URL;
  if (!masterKey || !baseUrl) return NextResponse.json({ error: { message: "Le fournisseur IA n'est pas encore configuré côté serveur", type: "configuration_error" } }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: { message: "Corps JSON invalide", type: "invalid_request_error" } }, { status: 400 });

  // TODO production: hash lookup, atomic credit reservation, usage reconciliation and audit log.
  const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/responses`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${masterKey}`, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const responseText = await upstream.text();
  return new NextResponse(responseText, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
}
