"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { ChartLineUp, Coins, UsersThree, ShieldCheck, ActivityIcon } from "@phosphor-icons/react";
import { AdminPanel, ImoleKey } from "../../components/AdminPanel";
import { firebaseAuth } from "../../lib/firebase";

const ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "oliviergnacadja693@gmail.com";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth, (next) => {
        setUser(next);
        setChecking(false);
      }),
    [],
  );
  if (checking)
    return (
      <div className="auth-loading">Chargement de l’administration...</div>
    );
  if (!user) return <AdminLogin />;
  if (user.email !== ADMIN_EMAIL)
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-copy">
            <p className="kicker">Accès refusé</p>
            <h1>Espace administrateur.</h1>
            <p>Ce lien est réservé au compte administrateur GeoCauris.</p>
          </div>
          <button className="auth-submit" onClick={() => signOut(firebaseAuth)}>
            Se déconnecter
          </button>
        </section>
      </main>
    );
  return <AdminWorkspace user={user} />;
}

function AdminLogin() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch {
      setError("Email ou mot de passe administrateur incorrect.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <div className="auth-brand">
        <span className="wordmark-mark">G</span>
        <strong>GeoCauris · Admin</strong>
      </div>
      <section className="auth-card">
        <div className="auth-copy">
          <p className="kicker">Accès sécurisé</p>
          <h1>Administration.</h1>
          <p>Gérez le pool Imọlẹ, les seuils et les réserves serveur.</p>
        </div>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? "Connexion..." : "Ouvrir l’administration"}
          </button>
        </form>
      </section>
    </main>
  );
}

function AdminWorkspace({ user }: { user: User }) {
  const [keys, setKeys] = useState<ImoleKey[]>([]);
  const [notice, setNotice] = useState("");
  const [metrics, setMetrics] = useState({ users: 0, usage: 0, cauris: 0, transactions: 0 });
  const [section, setSection] = useState<"overview" | "pool">("overview");
  const [form, setForm] = useState({
    label: "",
    rawKey: "",
    startingBalance: "",
    alertThreshold: "",
  });
  async function refresh() {
    const token = await user.getIdToken();
    const response = await fetch("/api/admin/imole-keys", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.error ?? "Impossible de charger les clés.");
    setKeys(data.keys ?? []);
  }
  useEffect(() => {
    refresh().catch((error) => setNotice(error.message));
  }, [user]);
  async function loadMetrics() {
    const token = await user.getIdToken();
    const response = await fetch("/api/admin/metrics", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Impossible de charger les métriques.");
    setMetrics(data.metrics);
  }
  useEffect(() => {
    loadMetrics().catch((error) => setNotice(error.message));
  }, [user]);
  async function add(event: FormEvent) {
    event.preventDefault();
    const token = await user.getIdToken();
    const response = await fetch("/api/admin/imole-keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        startingBalance: Number(form.startingBalance),
        alertThreshold: Number(form.alertThreshold || 0),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(data.error ?? "Impossible d’ajouter la clé.");
      return;
    }
    setForm({ label: "", rawKey: "", startingBalance: "", alertThreshold: "" });
    setNotice("Clé ajoutée dans le pool sécurisé.");
    await refresh();
  }
  async function update(
    id: string,
    action: "recharge" | "toggle",
    amount?: number,
  ) {
    const token = await user.getIdToken();
    const response = await fetch("/api/admin/imole-keys", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, action, amount }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(data.error ?? "Impossible de mettre à jour la clé.");
      return;
    }
    setNotice("Clé mise à jour.");
    await refresh();
  }
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/admin">
          <span className="wordmark-mark">G</span>
          <span>GeoCauris · Admin</span>
        </a>
        <div className="profile">
          <span className="online" />
          <span>ADMIN</span>
          <button onClick={() => signOut(firebaseAuth)}>Quitter</button>
        </div>
      </header>
      <div className="page">
        {notice && (
          <div className="notice">
            {notice}
            <button onClick={() => setNotice("")}>Fermer</button>
          </div>
        )}
        <div className="admin-layout">
          <aside className="admin-nav" aria-label="Navigation administration">
            <p className="kicker">Console privée</p>
            <button className={section === "overview" ? "selected" : ""} onClick={() => setSection("overview")}><ChartLineUp size={18} /> Vue plateforme</button>
            <button className={section === "pool" ? "selected" : ""} onClick={() => setSection("pool")}><ShieldCheck size={18} /> Pool Imọlẹ</button>
            <button onClick={() => loadMetrics().catch((error) => setNotice(error.message))}><ActivityIcon size={18} /> Actualiser</button>
          </aside>
          <div className="admin-content">
            {section === "overview" ? <AdminOverview metrics={metrics} keys={keys} /> : <AdminPanel keys={keys} form={form} setForm={setForm} onSubmit={add} onUpdate={update} />}
          </div>
        </div>
      </div>
    </main>
  );
}

function AdminOverview({ metrics, keys }: { metrics: { users: number; usage: number; cauris: number; transactions: number }; keys: ImoleKey[] }) {
  const poolBalance = keys.reduce((sum, key) => sum + Number(key.estimatedBalance || 0), 0);
  return <section className="admin-overview">
    <div className="route-header"><div><p className="kicker">Supervision</p><h2>Vue de la plateforme</h2><p>Suivez l’utilisation globale, les comptes actifs et les réserves de cauris disponibles.</p></div><span className="active-badge"><span className="online" /> Système opérationnel</span></div>
    <div className="admin-metrics">
      <article className="panel"><UsersThree size={22} /><small>Utilisateurs enregistrés</small><strong>{metrics.users.toLocaleString("fr-FR")}</strong></article>
      <article className="panel"><ActivityIcon size={22} /><small>Requêtes IA enregistrées</small><strong>{metrics.usage.toLocaleString("fr-FR")}</strong></article>
      <article className="panel"><Coins size={22} /><small>Cauris consommés</small><strong>{metrics.cauris.toLocaleString("fr-FR")}</strong></article>
      <article className="panel"><ChartLineUp size={22} /><small>Transactions</small><strong>{metrics.transactions.toLocaleString("fr-FR")}</strong></article>
    </div>
    <section className="panel admin-summary"><h2>Réserve Imọlẹ disponible</h2><strong>{poolBalance.toLocaleString("fr-FR")} cauris</strong><p>Total estimé de toutes les clés actives du pool. Les soldes utilisateurs et les opérations financières restent protégés côté serveur.</p></section>
  </section>;
}
