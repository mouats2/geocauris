import crypto from "crypto";

export async function verifyFirebaseToken(token: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("FIREBASE_API_KEY_MISSING");
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }), cache: "no-store" });
  if (!response.ok) throw new Error("UNAUTHORIZED");
  const payload = await response.json();
  const user = payload.users?.[0];
  if (!user?.localId || !user.email) throw new Error("UNAUTHORIZED");
  return { uid: String(user.localId), email: String(user.email) };
}

export async function requireAdmin(request: Request) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const decoded = await verifyFirebaseToken(bearer.slice(7));
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "oliviergnacadja693@gmail.com";
  if (decoded.email !== adminEmail) throw new Error("FORBIDDEN");
  return decoded;
}

export async function requireUser(request: Request) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  return verifyFirebaseToken(bearer.slice(7));
}

function encryptionKey() {
  const value = process.env.IMOLE_KEYS_ENCRYPTION_KEY;
  if (!value) throw new Error("IMOLE_KEYS_ENCRYPTION_KEY_MISSING");
  return crypto.createHash("sha256").update(value).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}
