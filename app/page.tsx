"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ActivityIcon,
  ArrowSquareOut,
  BookOpen,
  Check,
  ChartLineUp,
  Coin,
  Copy,
  Key,
  List,
  LockKey,
  Plus,
  ShieldCheck,
  SignOut,
  SquaresFour,
  TrendUp,
  X,
} from "@phosphor-icons/react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { firebaseAuth, firestore } from "../lib/firebase";
import { CAURIS_PACKS } from "../lib/pricing";

type Stamp = { seconds?: number } | undefined;
function timestampSeconds(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "object" && value !== null) {
    const candidate = value as { seconds?: unknown; _seconds?: unknown; toMillis?: () => number };
    if (typeof candidate.toMillis === "function") return Number(candidate.toMillis()) / 1000;
    return Number(candidate.seconds ?? candidate._seconds ?? 0);
  }
  return typeof value === "number" ? (value > 10_000_000_000 ? value / 1000 : value) : 0;
}
type UsageLog = {
  id: string;
  model: string;
  effort: string;
  tokensIn: number;
  tokensOut: number;
  cauris: number;
  createdAt: Stamp;
};
type Txn = {
  id: string;
  label: string;
  model: string;
  cauris: number;
  type: "credit" | "debit";
  createdAt: Stamp;
};
type Row = Txn;

const nav = [
  { label: "Vue d’ensemble", icon: SquaresFour },
  { label: "Consommation", icon: ChartLineUp },
  { label: "Ma clé API", icon: Key },
  { label: "Documentation", icon: BookOpen },
  { label: "Centre d’aide", icon: BookOpen },
];

const SLICE_COLORS = ["#19382c", "#c9ee73", "#ec8c55", "#7fa357", "#b7c7ba"];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let settled = false;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (value) => {
      settled = true;
      setUser(value);
      setLoading(false);
    });
    const fallback = window.setTimeout(() => {
      if (!settled) setLoading(false);
    }, 5000);
    return () => {
      window.clearTimeout(fallback);
      unsubscribe();
    };
  }, []);
  if (loading)
    return (
      <div className="auth-loading">
        <span className="loading-mark">G</span>
        <span>Chargement de GeoCauris...</span>
      </div>
    );
  return user ? <Dashboard user={user} /> : <AuthScreen />;
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const credentials =
        mode === "login"
          ? await signInWithEmailAndPassword(firebaseAuth, email, password)
          : await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (mode === "signup") {
        await setDoc(
          doc(firestore, "users", credentials.user.uid),
          { uid: credentials.user.uid, email, status: "active", createdAt: serverTimestamp() },
          { merge: true },
        );
        await setDoc(
          doc(firestore, "wallets", credentials.user.uid),
          { uid: credentials.user.uid, soldeCauris: 0, updatedAt: serverTimestamp() },
          { merge: true },
        );
      }
    } catch (caught) {
      setError(firebaseMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!email)
      return setError("Saisissez votre email avant de demander un nouveau mot de passe.");
    setBusy(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setError("Le lien de réinitialisation a été envoyé.");
    } catch {
      setError("Impossible d’envoyer le lien de réinitialisation.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-brand">
          <img className="brand-logo-image" src="/logo-geocauris.jpeg" alt="GeoCauris" />
          <strong>
            GeoCauris<span className="wordmark-dot">.</span>
          </strong>
        </div>
        <div className="auth-aside-copy">
          <p className="kicker light">IA × géospatial</p>
          <h2>Votre réserve IA, au rythme de vos cartes.</h2>
          <p>Rechargez vos cauris, connectez Codex et gardez une vision simple de chaque requête.</p>
        </div>
        <div className="auth-visual">
          <span className="auth-orbit orbit-one" />
          <span className="auth-orbit orbit-two" />
          <strong>
            GEO
            <br />
            CAURIS
          </strong>
        </div>
        <div className="auth-aside-foot">
          <span>
            <i /> Paiements sécurisés
          </span>
          <span>Conçu pour les workflows QGIS</span>
        </div>
      </aside>
      <section className="auth-card">
        <div className="auth-copy">
          <p className="kicker">IA × géospatial</p>
          <h1>{mode === "login" ? "Votre espace de travail." : "Créer votre réserve."}</h1>
          <p>Connectez Codex à vos workflows cartographiques, avec un suivi clair de chaque cauri.</p>
        </div>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vous@exemple.com"
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="6 caractères minimum"
            />
          </label>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="auth-submit" disabled={busy}>
            {busy ? "Connexion..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>
        {mode === "login" && (
          <button className="auth-reset" onClick={reset} disabled={busy}>
            Mot de passe oublié ?
          </button>
        )}
        <button
          className="auth-switch"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
        >
          {mode === "login"
            ? "Nouveau sur GeoCauris ? Créer un compte"
            : "J’ai déjà un compte · Se connecter"}
        </button>
      </section>
      <p className="auth-foot">Vos données sont stockées dans votre projet Firebase GeoCauris.</p>
    </main>
  );
}

/**
 * Charge une collection appartenant à l'utilisateur. On tente d'abord la
 * requête triée (index uid + createdAt déclaré dans firestore.indexes.json) ;
 * si l'index n'est pas encore déployé, Firestore renvoie failed-precondition
 * et on retombe sur une requête non triée, triée ensuite côté client.
 */
async function loadOwnedCollection(name: string, uid: string, max: number) {
  const base = collection(firestore, name);
  try {
    return await getDocs(
      query(base, where("uid", "==", uid), orderBy("createdAt", "desc"), limit(max)),
    );
  } catch (error) {
    if (errorCode(error).includes("failed-precondition"))
      return await getDocs(query(base, where("uid", "==", uid), limit(max)));
    throw error;
  }
}

function errorCode(error: unknown) {
  return String((error as { code?: string })?.code ?? "");
}

function describeFirestoreError(error: unknown, what: string) {
  const code = errorCode(error);
  if (code.includes("permission-denied"))
    return `Accès refusé à ${what} : les règles Firestore du projet doivent être déployées (firebase deploy --only firestore:rules).`;
  if (code.includes("failed-precondition"))
    return `Un index Firestore manque pour ${what} (firebase deploy --only firestore:indexes).`;
  if (code.includes("unavailable") || code.includes("network"))
    return `Connexion à Firestore impossible pour ${what}. Vérifiez votre réseau puis réessayez.`;
  if (code.includes("unauthenticated"))
    return `Votre session a expiré. Reconnectez-vous pour afficher ${what}.`;
  return `Impossible de charger ${what}.`;
}

function monthIndex(stamp: Stamp) {
  const seconds = timestampSeconds(stamp);
  if (!seconds) return null;
  const date = new Date(seconds * 1000);
  return date.getFullYear() * 12 + date.getMonth();
}

function Dashboard({ user }: { user: User }) {
  const [active, setActive] = useState("Vue d’ensemble");
  const [balance, setBalance] = useState(0);
  const [usage, setUsage] = useState<UsageLog[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [dataError, setDataError] = useState("");
  const [showBuy, setShowBuy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const displayName = user.email?.split("@")[0] ?? "utilisateur";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [walletResult, txResult, usageResult] = await Promise.allSettled([
        getDoc(doc(firestore, "wallets", user.uid)),
        loadOwnedCollection("transactions", user.uid, 100),
        loadOwnedCollection("usageLogs", user.uid, 300),
      ]);
      if (cancelled) return;
      const problems: string[] = [];

      if (walletResult.status === "fulfilled")
        setBalance(Number(walletResult.value.data()?.soldeCauris ?? 0));
      else problems.push(describeFirestoreError(walletResult.reason, "votre solde"));

      if (txResult.status === "fulfilled")
        setTxns(
          txResult.value.docs.map((item) => {
            const data = item.data();
            const amount = Number(data.cauris ?? data.coutCauris ?? 0);
            return {
              id: item.id,
              label: String(data.label ?? "Mouvement"),
              model: String(data.model ?? "GeoCauris"),
              cauris: Math.abs(amount),
              type: data.type === "credit" || amount > 0 ? "credit" : "debit",
              createdAt: data.createdAt,
            } as Txn;
          }),
        );
      else problems.push(describeFirestoreError(txResult.reason, "vos transactions"));

      if (usageResult.status === "fulfilled")
        setUsage(
          usageResult.value.docs.map((item) => {
            const data = item.data();
            return {
              id: item.id,
              model: String(data.model ?? "Imọlẹ"),
              effort: String(data.effort ?? "medium"),
              tokensIn: Number(data.tokensEntree ?? data.tokensIn ?? data.inputTokens ?? data.promptTokens ?? 0),
              tokensOut: Number(data.tokensSortie ?? data.tokensOut ?? data.outputTokens ?? data.completionTokens ?? 0),
              cauris: Number(data.coutCauris ?? data.cauris ?? data.costCauris ?? 0),
              createdAt: data.createdAt,
            } as UsageLog;
          }),
        );
      else problems.push(describeFirestoreError(usageResult.reason, "votre consommation"));

      setDataError(problems.join(" "));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  // Toutes les métriques ci-dessous proviennent uniquement des documents
  // usageLogs réellement présents dans Firestore — aucune valeur simulée.
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getFullYear() * 12 + now.getMonth();
    const inMonth = (log: UsageLog, target: number) => {
      const index = monthIndex(log.createdAt);
      return index === null ? target === currentMonth : index === target;
    };
    const month = usage.filter((log) => inMonth(log, currentMonth));
    const previous = usage.filter((log) => inMonth(log, currentMonth - 1));
    const sum = (list: UsageLog[]) => list.reduce((total, log) => total + log.cauris, 0);
    const monthCauris = sum(month);
    const previousCauris = sum(previous);
    const totals = usage.reduce(
      (acc, log) => ({
        cauris: acc.cauris + log.cauris,
        tokensIn: acc.tokensIn + log.tokensIn,
        tokensOut: acc.tokensOut + log.tokensOut,
      }),
      { cauris: 0, tokensIn: 0, tokensOut: 0 },
    );

    const grouped = new Map<string, { cauris: number; count: number }>();
    month.forEach((log) => {
      const entry = grouped.get(log.model) ?? { cauris: 0, count: 0 };
      entry.cauris += log.cauris;
      entry.count += 1;
      grouped.set(log.model, entry);
    });
    const byModel = Array.from(grouped.entries())
      .map(([model, entry]) => ({
        model,
        cauris: entry.cauris,
        count: entry.count,
        share: monthCauris ? (entry.cauris / monthCauris) * 100 : 0,
      }))
      .sort((a, b) => b.cauris - a.cauris);

    return {
      requests: month.length,
      previousRequests: previous.length,
      monthCauris,
      previousCauris,
      totalCauris: totals.cauris,
      tokensIn: totals.tokensIn,
      tokensOut: totals.tokensOut,
      average: month.length ? monthCauris / month.length : 0,
      byModel,
      hasHistory: usage.length > 0,
    };
  }, [usage]);

  const rows = useMemo<Row[]>(() => {
    const usageRows: Row[] = usage.map((log) => ({
      id: log.id,
      label: "Consommation IA",
      model: log.model,
      cauris: log.cauris,
      type: "debit",
      createdAt: log.createdAt,
    }));
    return [...txns, ...usageRows].sort(
      (a, b) => timestampSeconds(b.createdAt) - timestampSeconds(a.createdAt),
    );
  }, [txns, usage]);

  async function buy(packId: string) {
    setBuying(packId);
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/payments/saspay", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await response.json();
      if (!response.ok || !data.paymentUrl)
        throw new Error(data.error ?? "Lien SasPay indisponible");
      window.location.assign(data.paymentUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de contacter SasPay.");
    } finally {
      setBuying(null);
    }
  }
  async function generateKey() {
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setApiKey(data.key);
      setActive("Ma clé API");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de générer la clé.");
    }
  }
  function navigate(page: string) {
    setActive(page);
    setMenuOpen(false);
  }

  return (
    <main className={`app-shell ${menuOpen ? "menu-open" : ""}`}>
      <Sidebar
        active={active}
        setActive={navigate}
        user={user}
        balance={balance}
        onBuy={() => {
          setShowBuy(true);
          setMenuOpen(false);
        }}
      />
      <button
        className="menu-scrim"
        aria-label="Fermer le menu"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />
      <div className="app-main">
        <header className="topbar">
          <button
            className="menu-toggle"
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X size={18} /> : <List size={18} />}
          </button>
          <div className="breadcrumb">
            <span>GeoCauris</span>
            <b>/</b>
            <strong>{active}</strong>
          </div>
          <div className="topbar-actions">
            <button className="topbar-help" type="button" onClick={() => navigate("Centre d’aide")}>
              <BookOpen size={15} /> Aide
            </button>
            <button className="topbar-buy" type="button" onClick={() => setShowBuy(true)}>
              <Plus size={15} /> <span>Acheter des cauris</span>
            </button>
          </div>
        </header>
        <div className="page" id="top">
          {dataError && (
            <div className="notice" role="alert">
              {dataError}
              <button onClick={() => setDataError("")} aria-label="Fermer">
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="alert">
              {notice}
              <button onClick={() => setNotice("")} aria-label="Fermer">
                <X size={15} />
              </button>
            </div>
          )}
          {active === "Vue d’ensemble" && (
            <Overview
              name={displayName}
              balance={balance}
              loading={loading}
              stats={stats}
              rows={rows}
              onBuy={() => setShowBuy(true)}
              onKey={generateKey}
              setActivePage={navigate}
            />
          )}
          {active === "Consommation" && (
            <Usage usage={usage} stats={stats} balance={balance} loading={loading} />
          )}
          {active === "Ma clé API" && <KeyPanel apiKey={apiKey} onGenerate={generateKey} />}
          {active === "Documentation" && <Docs />}
          {active === "Centre d’aide" && <Help />}
          {active === "Administration" && <AdminNotice />}
        </div>
        {showBuy && <BuyModal onClose={() => setShowBuy(false)} buying={buying} onBuy={buy} />}
      </div>
    </main>
  );
}

function Sidebar({
  active,
  setActive,
  user,
  balance,
  onBuy,
}: {
  active: string;
  setActive: (value: string) => void;
  user: User;
  balance: number;
  onBuy: () => void;
}) {
  const isAdmin =
    user.email === (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "oliviergnacadja693@gmail.com");
  return (
    <aside className="sidebar">
      <a className="sidebar-brand" href="#top">
          <img className="sidebar-logo-image" src="/logo-geocauris.jpeg" alt="" />
        <strong>GeoCauris</strong>
      </a>
      <button className="account-card" type="button">
        <span className="account-avatar">{user.email?.slice(0, 1).toUpperCase()}</span>
        <span>
          <b>{user.email?.split("@")[0] ?? "Client"}</b>
          <small>Compte client</small>
        </span>
        <span className="account-caret">⌄</span>
      </button>
      <p className="sidebar-label">Mon espace</p>
      <nav className="sidebar-nav" aria-label="Navigation principale">
        {nav.map(({ label, icon: Icon }) => (
          <button
            type="button"
            key={label}
            className={active === label ? "selected" : ""}
            onClick={() => setActive(label)}
          >
            <Icon size={18} weight="duotone" />
            <span>{label}</span>
          </button>
        ))}
        {isAdmin && (
          <button
            type="button"
            className={`admin-entry ${active === "Administration" ? "selected" : ""}`}
            onClick={() => setActive("Administration")}
          >
            <ShieldCheck size={18} weight="duotone" />
            <span>Administration</span>
          </button>
        )}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-balance">
        <small>Votre solde</small>
        <strong>
          {balance.toLocaleString("fr-FR")} <em>cauris</em>
        </strong>
        <button type="button" onClick={onBuy}>
          Recharger <ArrowSquareOut size={13} />
        </button>
      </div>
      <div className="sidebar-user">
        <span className="account-avatar">{user.email?.slice(0, 1).toUpperCase()}</span>
        <span>
          <b>{user.email?.split("@")[0] ?? "Client"}</b>
          <small>{user.email}</small>
        </span>
        <button type="button" onClick={() => signOut(firebaseAuth)} aria-label="Se déconnecter">
          <SignOut size={15} />
        </button>
      </div>
    </aside>
  );
}

type Stats = {
  requests: number;
  previousRequests: number;
  monthCauris: number;
  previousCauris: number;
  totalCauris: number;
  tokensIn: number;
  tokensOut: number;
  average: number;
  byModel: { model: string; cauris: number; count: number; share: number }[];
  hasHistory: boolean;
};

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR");
}
function formatDelta(current: number, previous: number) {
  if (!previous) return current ? "Premier mois d’activité" : "Aucune requête ce mois";
  const delta = ((current - previous) / previous) * 100;
  const sign = delta >= 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}% vs. mois dernier`;
}
function donutBackground(byModel: Stats["byModel"]) {
  if (!byModel.length) return "conic-gradient(#eff2e9 0 100%)";
  let cursor = 0;
  const stops = byModel.slice(0, SLICE_COLORS.length).map((slice, index) => {
    const start = cursor;
    cursor += slice.share;
    return `${SLICE_COLORS[index]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  if (cursor < 99.9) stops.push(`#eff2e9 ${cursor.toFixed(2)}% 100%`);
  return `conic-gradient(${stops.join(", ")})`;
}

function Overview({
  name,
  balance,
  loading,
  stats,
  rows,
  onBuy,
  onKey,
  setActivePage,
}: {
  name: string;
  balance: number;
  loading: boolean;
  stats: Stats;
  rows: Row[];
  onBuy: () => void;
  onKey: () => void;
  setActivePage: (value: string) => void;
}) {
  return (
    <>
      <section className="intro">
        <div>
          <p className="kicker">Espace personnel</p>
          <h1>
            Bonjour, {name}
            <span className="lime">.</span>
          </h1>
          <p className="intro-copy">
            Un espace clair pour piloter votre puissance IA, sans surprise sur la facture.
          </p>
        </div>
        <div className="service">
          <span className="online" /> Système opérationnel <ShieldCheck size={16} />
        </div>
      </section>
      <section className="balance-grid">
        <div className="balance-card">
          <div className="balance-top">
            <span className="kicker light">Votre réserve</span>
            <span className="balance-label">CAURIS</span>
          </div>
          <div className="balance-number">{loading ? "..." : formatNumber(balance)}</div>
          <p>crédits disponibles</p>
          <div className="balance-foot">
            <span>Compte Firebase sécurisé</span>
            <span className="positive">{formatNumber(stats.totalCauris)} cauris consommés</span>
          </div>
        </div>
        <div className="quote-card">
          <span className="quote-mark">“</span>
          <p>Les bons outils doivent disparaître derrière le travail.</p>
          <span className="quote-credit">GEOCAURIS / PRINCIPLE 01</span>
        </div>
      </section>
      <section className="stats-row" aria-label="Résumé de l'activité">
        <div className="stat-tile">
          <span className="stat-icon stat-green">
            <ActivityIcon size={16} />
          </span>
          <b>{formatNumber(stats.requests)}</b>
          <strong>Requêtes ce mois</strong>
          <small>{formatDelta(stats.requests, stats.previousRequests)}</small>
        </div>
        <div className="stat-tile">
          <span className="stat-icon stat-lime">
            <Coin size={16} />
          </span>
          <b>{formatNumber(stats.monthCauris)}</b>
          <strong>Cauris consommés</strong>
          <small>{formatDelta(stats.monthCauris, stats.previousCauris)}</small>
        </div>
        <div className="stat-tile">
          <span className="stat-icon stat-orange">
            <TrendUp size={16} />
          </span>
          <b>
            {stats.average.toLocaleString("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </b>
          <strong>Coût moyen / requête</strong>
          <small>{stats.requests ? "Calculé sur ce mois" : "Aucune requête ce mois"}</small>
        </div>
        <div className="stat-tile">
          <span className="stat-icon stat-blue">
            <Key size={16} />
          </span>
          <b>{formatNumber(stats.tokensIn + stats.tokensOut)}</b>
          <strong>Tokens traités</strong>
          <small>
            {formatNumber(stats.tokensIn)} entrée · {formatNumber(stats.tokensOut)} sortie
          </small>
        </div>
      </section>
      <section className="dashboard-grid">
        <div className="panel usage-preview">
          <div className="panel-heading">
            <div>
              <h2>Consommation récente</h2>
              <p>Répartition réelle des cauris utilisés ce mois</p>
            </div>
          </div>
          {stats.byModel.length ? (
            <div className="usage-preview-body">
              <div className="donut-chart" style={{ background: donutBackground(stats.byModel) }}>
                <strong>{formatNumber(stats.monthCauris)}</strong>
                <small>cauris</small>
              </div>
              <div className="usage-legend">
                {stats.byModel.slice(0, SLICE_COLORS.length).map((slice, index) => (
                  <div key={slice.model}>
                    <span
                      className="legend-dot"
                      style={{ background: SLICE_COLORS[index] }}
                      aria-hidden
                    />
                    <b>{slice.model}</b>
                    <strong>{formatNumber(slice.cauris)} cauris</strong>
                    <em>{slice.share.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%</em>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-panel">
              Aucune requête enregistrée ce mois. La répartition apparaîtra dès votre première
              utilisation du proxy.
            </div>
          )}
          <button className="panel-link" type="button" onClick={() => setActivePage("Consommation")}>
            Voir le détail de la consommation <ArrowSquareOut size={14} />
          </button>
        </div>
        <div className="panel quick-start">
          <div className="panel-heading">
            <div>
              <h2>Démarrage rapide</h2>
              <p>Tout pour connecter votre workflow</p>
            </div>
          </div>
          <button type="button" onClick={onKey}>
            <Key size={17} />
            <span>
              <b>Générer une clé API</b>
              <small>Pour appeler le proxy GeoCauris</small>
            </span>
            <ArrowSquareOut size={14} />
          </button>
          <button type="button" onClick={() => setActivePage("Documentation")}>
            <BookOpen size={17} />
            <span>
              <b>Lire la documentation</b>
              <small>Intégrer GeoCauris en quelques minutes</small>
            </span>
            <ArrowSquareOut size={14} />
          </button>
          <button type="button" onClick={() => setActivePage("Consommation")}>
            <ActivityIcon size={17} />
            <span>
              <b>Suivre ma consommation</b>
              <small>Tokens, modèles et cauris réels</small>
            </span>
            <ArrowSquareOut size={14} />
          </button>
        </div>
      </section>
      <section className="dashboard-lower">
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Dernières transactions</h2>
              <p>Votre activité financière et IA</p>
            </div>
            <ActivityIcon size={18} />
          </div>
          {rows.length ? (
            rows.slice(0, 4).map((row) => (
              <div className="activity-row" key={row.id}>
                <span className={`activity-icon ${row.type}`}>
                  <Coin size={15} />
                </span>
                <div>
                  <strong>{row.label}</strong>
                  <small>{row.model}</small>
                </div>
                <b className={row.type}>
                  {row.type === "credit" ? "+" : "−"}
                  {formatNumber(row.cauris)} cauris
                </b>
              </div>
            ))
          ) : (
            <div className="empty-panel">Aucune transaction pour le moment.</div>
          )}
          <button className="panel-link" onClick={() => onBuy()}>
            Recharger mon compte <ArrowSquareOut size={14} />
          </button>
        </div>
        <div className="panel api-card">
          <div className="api-top">
            <span className="api-icon">
              <Key size={18} />
            </span>
            <span className="active-badge">
              <i /> Active
            </span>
          </div>
          <h2>Votre clé API</h2>
          <p>Connectez Codex, QGIS et vos outils SIG au proxy GeoCauris.</p>
          <code>cau_live_••••••••••••••</code>
          <button className="outline-button" onClick={onKey}>
            Gérer ma clé <ArrowSquareOut size={14} />
          </button>
        </div>
      </section>
    </>
  );
}

function Usage({
  usage,
  stats,
  balance,
  loading,
}: {
  usage: UsageLog[];
  stats: Stats;
  balance: number;
  loading: boolean;
}) {
  const capacity = stats.totalCauris + balance;
  const consumedShare = capacity ? (stats.totalCauris / capacity) * 100 : 0;
  return (
    <>
      <section className="intro">
        <div>
          <p className="kicker">Suivi d’activité</p>
          <h1>Votre consommation.</h1>
          <p className="intro-copy">Comprenez comment vos cauris alimentent vos requêtes IA.</p>
        </div>
      </section>
      <section className="dashboard-lower">
        <div className="panel activity-panel wide-panel usage-table-card">
          <div className="panel-heading">
            <div>
              <h2>Historique des consommations</h2>
              <p>Les requêtes exécutées via votre clé GeoCauris.</p>
            </div>
          </div>
          <div className="usage-table-scroll">
            <div className="usage-table-head">
              <span>Modèle</span>
              <span>Effort</span>
              <span>Tokens entrée → sortie</span>
              <span>Cauris</span>
              <span>Date</span>
            </div>
            {usage.length ? (
              usage.map((log) => (
                <div className="usage-table-row" key={log.id}>
                  <strong>{log.model}</strong>
                  <span className="effort-tag">{log.effort}</span>
                  <span>
                    {formatNumber(log.tokensIn)} → {formatNumber(log.tokensOut)}
                  </span>
                  <b>−{formatNumber(log.cauris)}</b>
                  <time>
                    {log.createdAt?.seconds
                      ? new Date(log.createdAt.seconds * 1000).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "—"}
                  </time>
                </div>
              ))
            ) : (
              <div className="empty-panel">
                {loading
                  ? "Chargement de votre historique..."
                  : "Votre historique apparaîtra après votre première requête."}
              </div>
            )}
          </div>
        </div>
        <div className="panel quick-card usage-summary">
          <span className="api-icon">
            <ChartLineUp size={18} />
          </span>
          <h2>
            {formatNumber(stats.monthCauris)} <small>cauris</small>
          </h2>
          <p>
            consommés ce mois · {formatNumber(stats.requests)} requêtes
          </p>
          <div
            className="progress-line"
            role="progressbar"
            aria-valuenow={Math.round(consumedShare)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${Math.min(Math.max(consumedShare, 0), 100)}%` }} />
          </div>
          <p className="progress-caption">
            {capacity
              ? `${formatNumber(stats.totalCauris)} cauris consommés sur ${formatNumber(capacity)} acquis`
              : "Rechargez votre compte pour commencer."}
          </p>
        </div>
      </section>
    </>
  );
}

function KeyPanel({ apiKey, onGenerate }: { apiKey: string | null; onGenerate: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <section className="intro">
        <div>
          <p className="kicker">Accès développeur</p>
          <h1>Ma clé API.</h1>
          <p className="intro-copy">
            Une passerelle simple et sécurisée entre vos outils et l’IA.
          </p>
        </div>
      </section>
      <section className="dashboard-lower">
        <div className="panel key-panel wide-panel">
          <div className="api-top">
            <span className="api-icon">
              <Key size={18} />
            </span>
            <span className="active-badge">
              <i /> Active
            </span>
          </div>
          <h2>Clé API GeoCauris</h2>
          <p>
            Utilisez cette clé dans le header Authorization de vos appels à <code>/api/proxy</code>.
          </p>
          <div className="key-box">
            <code>{show && apiKey ? apiKey : "cau_live_••••••••••••••••••"}</code>
            <button
              className="icon-button"
              aria-label={show ? "Masquer la clé" : "Afficher et copier la clé"}
              onClick={() => {
                setShow(!show);
                if (apiKey) navigator.clipboard?.writeText(apiKey);
              }}
            >
              <Copy size={15} />
            </button>
          </div>
          <button className="primary-button" onClick={onGenerate}>
            <Plus size={15} /> Générer une nouvelle clé
          </button>
        </div>
        <div className="panel quick-card">
          <LockKey size={20} />
          <h2>Bonnes pratiques</h2>
          <p>Ne partagez jamais votre clé dans un dépôt public ou dans un fichier frontend.</p>
          <Check size={15} /> Variables d’environnement
        </div>
      </section>
    </>
  );
}

function Docs() {
  return (
    <>
      <section className="intro">
        <div>
          <p className="kicker">Référence développeur</p>
          <h1>Documentation.</h1>
          <p className="intro-copy">
            Connectez GeoCauris à Codex, QGIS ou n’importe quel workflow.
          </p>
        </div>
      </section>
      <section className="panel docs-card">
        <BookOpen size={20} />
        <h2>Votre première requête</h2>
        <p>
          Appelez le proxy avec votre clé GeoCauris. Les cauris sont réservés puis débités selon la
          consommation.
        </p>
        <pre>{`POST /api/proxy\nAuthorization: Bearer cau_live_...\n\n{ "model": "gpt-5.6-luna", "input": "Votre requête ici", "reasoning_effort": "medium" }`}</pre>
      </section>
    </>
  );
}

function Help() {
  return (
    <>
      <section className="intro">
        <div>
          <p className="kicker">Support GeoCauris</p>
          <h1>Comment pouvons-nous aider ?</h1>
          <p className="intro-copy">Une question sur vos cauris, SasPay ou l’intégration IA ?</p>
        </div>
      </section>
      <section className="help-cards">
        <a className="panel" href="mailto:supportgeocauris@gmail.com">
          <Coin size={22} />
          <h2>Paiements et cauris</h2>
          <p>supportgeocauris@gmail.com</p>
        </a>
        <a className="panel" href="tel:0142547085">
          <ShieldCheck size={22} />
          <h2>Parler au support</h2>
          <p>01 42 54 70 85</p>
        </a>
      </section>
    </>
  );
}

function AdminNotice() {
  return (
    <>
      <section className="intro">
        <div>
          <p className="kicker">Zone restreinte</p>
          <h1>Administration Imọlẹ.</h1>
          <p className="intro-copy">
            La gestion du pool de clés reste protégée par les routes serveur existantes.
          </p>
        </div>
        <span className="active-badge">
          <i /> Accès administrateur
        </span>
      </section>
      <section className="panel docs-card">
        <ShieldCheck size={22} />
        <h2>Supervision sécurisée</h2>
        <p>
          Utilisez le panneau d’administration existant pour ajouter, activer et recharger les clés
          Imọlẹ. Les secrets ne sont jamais exposés au navigateur.
        </p>
      </section>
    </>
  );
}

function BuyModal({
  onClose,
  buying,
  onBuy,
}: {
  onClose: () => void;
  buying: string | null;
  onBuy: (id: string) => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-card" role="dialog" aria-modal="true">
        <button className="modal-close icon-button" onClick={onClose} aria-label="Fermer">
          <X size={18} />
        </button>
        <div className="modal-kicker">
          <span className="modal-kicker-icon">
            <Coin size={16} />
          </span>{" "}
          Recharger votre wallet
        </div>
        <h2>Choisissez votre pack de cauris.</h2>
        <p>
          Paiement sécurisé via SasPay. Vos cauris sont crédités automatiquement après confirmation.
        </p>
        <div className="buy-grid">
          {CAURIS_PACKS.map((pack) => (
            <button
              className="buy-option"
              key={pack.id}
              onClick={() => onBuy(pack.id)}
              disabled={Boolean(buying)}
            >
              <strong>{pack.credits.toLocaleString("fr-FR")}</strong>
              <small>cauris · {pack.priceXof.toLocaleString("fr-FR")} FCFA</small>
              <span>{buying === pack.id ? "Connexion..." : "Continuer"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function firebaseMessage(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  if (code.includes("invalid-credential")) return "Email ou mot de passe incorrect.";
  if (code.includes("email-already-in-use")) return "Un compte existe déjà avec cet email.";
  if (code.includes("weak-password")) return "Le mot de passe doit contenir au moins 6 caractères.";
  return "Une erreur est survenue. Réessayez.";
}
