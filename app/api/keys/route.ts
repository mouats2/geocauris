import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST() {
  const rawKey = `cau_live_${crypto.randomBytes(24).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
  return NextResponse.json({ key: rawKey, hash, warning: "Afficher cette clé une seule fois puis conserver uniquement le hash en base." });
}
