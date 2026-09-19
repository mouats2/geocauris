import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ object: "list", data: [
    { id: "gpt-5.6-luna", object: "model", owned_by: "geocauris" },
    { id: "gpt-5.6-terra", object: "model", owned_by: "geocauris" },
    { id: "gpt-5.6-sol", object: "model", owned_by: "geocauris" },
    { id: "glm-5.2", object: "model", owned_by: "geocauris" },
    { id: "nemotron-3-120b-a12b", object: "model", owned_by: "geocauris" },
  ] });
}
