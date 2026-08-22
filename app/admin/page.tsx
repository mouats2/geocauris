"use client";

import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { AdminPanel, ImoleKey } from "../../components/AdminPanel";
import { firebaseAuth } from "../../lib/firebase";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "oliviergnacadja693@gmail.com";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => onAuthStateChanged(firebaseAuth, (next) => { setUser(next); setChecking(false); }), []);
  if (checking) return <div className="auth-loading">Chargement de l’administration...</div>;
  if (!user) return <AdminLogin />;
  if (user.email !== ADMIN_EMAIL) return <main className="auth-shell"><section className="auth-card"><div className="auth-copy"><p className="kicker">Accès refusé</p><h1>Espace administrateur.</h1><p>Ce lien est réservé au compte administrateur GeoCauris.</p></div><button className="auth-submit" onClick={() => signOut(firebaseAuth)}>Se déconnecter</button></section></main>;
  return <AdminWorkspace user={user} />;
}

function AdminLogin() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await signInWithEmailAndPassword(firebaseAuth, email, password); } catch { setError("Email ou mot de passe administrateur incorrect."); } finally { setBusy(false); } }
  return <main className="auth-shell"><div className="auth-brand"><span className="wordmark-mark">G</span><strong>GeoCauris · Admin</strong></div><section className="auth-card"><div className="auth-copy"><p className="kicker">Accès sécurisé</p><h1>Administration.</h1><p>Gérez le pool Imọlẹ, les seuils et les réserves serveur.</p></div><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Mot de passe<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="form-error">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? "Connexion..." : "Ouvrir l’administration"}</button></form></section></main>;
}

function AdminWorkspace({ user }: { user: User }) {
  const [keys, setKeys] = useState<ImoleKey[]>([]);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ label: "", rawKey: "", startingBalance: "", alertThreshold: "" });
  async function refresh() { const token = await user.getIdToken(); const response = await fetch("/api/admin/imole-keys", { headers: { Authorization: `Bearer ${token}` } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? "Impossible de charger les clés."); setKeys(data.keys ?? []); }
  useEffect(() => { refresh().catch((error) => setNotice(error.message)); }, [user]);
  async function add(event: FormEvent) { event.preventDefault(); const token = await user.getIdToken(); const response = await fetch("/api/admin/imole-keys", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...form, startingBalance: Number(form.startingBalance), alertThreshold: Number(form.alertThreshold || 0) }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { setNotice(data.error ?? "Impossible d’ajouter la clé."); return; } setForm({ label: "", rawKey: "", startingBalance: "", alertThreshold: "" }); setNotice("Clé ajoutée dans le pool sécurisé."); await refresh(); }
  async function update(id: string, action: "recharge" | "toggle", amount?: number) { const token = await user.getIdToken(); const response = await fetch("/api/admin/imole-keys", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id, action, amount }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { setNotice(data.error ?? "Impossible de mettre à jour la clé."); return; } setNotice("Clé mise à jour."); await refresh(); }
  return <main className="app-shell"><header className="topbar"><a className="wordmark" href="/admin"><span className="wordmark-mark">G</span><span>GeoCauris · Admin</span></a><div className="profile"><span className="online" /><span>ADMIN</span><button onClick={() => signOut(firebaseAuth)}>Quitter</button></div></header><div className="page">{notice && <div className="notice">{notice}<button onClick={() => setNotice("")}>Fermer</button></div>}<AdminPanel keys={keys} form={form} setForm={setForm} onSubmit={add} onUpdate={update} /></div></main>;
}
