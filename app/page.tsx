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
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { firebaseAuth, firestore } from "../lib/firebase";
import { CAURIS_PACKS } from "../lib/pricing";

type Row = {
  id: string;
  label: string;
  model: string;
  cauris: number;
  type: "credit" | "debit";
  createdAt?: { seconds?: number };
};
const nav = [
  { label: "Vue d’ensemble", icon: SquaresFour },
  { label: "Consommation", icon: ChartLineUp },
  { label: "Ma clé API", icon: Key },
  { label: "Documentation", icon: BookOpen },
  { label: "Centre d’aide", icon: BookOpen },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth, (value) => {
        setUser(value);
        setLoading(false);
      }),
    [],
  );
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
          {
            uid: credentials.user.uid,
            email,
            status: "active",
            createdAt: serverTimestamp(),
          },
          { merge: true },
        );
        await setDoc(
          doc(firestore, "wallets", credentials.user.uid),
          {
            uid: credentials.user.uid,
            soldeCauris: 0,
            updatedAt: serverTimestamp(),
          },
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
      return setError(
        "Saisissez votre email avant de demander un nouveau mot de passe.",
      );
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
          <span className="wordmark-mark">G</span>
          <strong>
            GeoCauris<span className="wordmark-dot">.</span>
          </strong>
        </div>
        <div className="auth-aside-copy">
          <p className="kicker light">IA × géospatial</p>
          <h2>Votre réserve IA, au rythme de vos cartes.</h2>
          <p>
            Rechargez vos cauris, connectez Codex et gardez une vision simple de
            chaque requête.
          </p>
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
          <h1>
            {mode === "login"
              ? "Votre espace de travail."
              : "Créer votre réserve."}
          </h1>
          <p>
            Connectez Codex à vos workflows cartographiques, avec un suivi clair
            de chaque cauri.
          </p>
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
            {busy
              ? "Connexion..."
              : mode === "login"
                ? "Se connecter"
                : "Créer mon compte"}
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
      <p className="auth-foot">
        Vos données sont stockées dans votre projet Firebase GeoCauris.
      </p>
    </main>
  );
}

function Dashboard({ user }: { user: User }) {
  const [active, setActive] = useState("Vue d’ensemble");
  const [balance, setBalance] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [showBuy, setShowBuy] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const displayName = user.email?.split("@")[0] ?? "utilisateur";
  useEffect(() => {
    async function load() {
      try {
        const wallet = await getDoc(doc(firestore, "wallets", user.uid));
        setBalance(Number(wallet.data()?.soldeCauris ?? 0));
        const transactionSnap = await getDocs(
          query(
            collection(firestore, "transactions"),
            where("uid", "==", user.uid),
            limit(20),
          ),
        );
        const usageSnap = await getDocs(
          query(
            collection(firestore, "usageLogs"),
            where("uid", "==", user.uid),
            limit(20),
          ),
        );
        const transactionRows = transactionSnap.docs.map((item) => {
          const data = item.data();
          const amount = Number(data.cauris ?? data.coutCauris ?? 0);
          return {
            id: item.id,
            label: data.label ?? "Consommation IA",
            model: data.model ?? "GeoCauris",
            cauris: Math.abs(amount),
            type: data.type === "credit" || amount > 0 ? "credit" : "debit",
            createdAt: data.createdAt,
          } as Row;
        });
        const usageRows = usageSnap.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            label: "Consommation IA",
            model: data.model ?? "Imọlẹ",
            cauris: Number(data.coutCauris ?? 0),
            type: "debit",
            createdAt: data.createdAt,
          } as Row;
        });
        setRows(
          [...transactionRows, ...usageRows]
            .sort(
              (a, b) =>
                Number(b.createdAt?.seconds ?? 0) -
                Number(a.createdAt?.seconds ?? 0),
            )
            .slice(0, 6),
        );
      } catch {
        setNotice("Impossible de charger toutes vos données Firestore.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.uid]);
  async function buy(packId: string) {
    setBuying(packId);
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/payments/saspay", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packId }),
      });
      const data = await response.json();
      if (!response.ok || !data.paymentUrl)
        throw new Error(data.error ?? "Lien SasPay indisponible");
      window.location.assign(data.paymentUrl);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Impossible de contacter SasPay.",
      );
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
      setNotice(
        error instanceof Error
          ? error.message
          : "Impossible de générer la clé.",
      );
    }
  }
  const spent = useMemo(
    () =>
      rows
        .filter((row) => row.type === "debit")
        .reduce((sum, row) => sum + row.cauris, 0),
    [rows],
  );
  return (
    <main className="app-shell">
      <Sidebar
        active={active}
        setActive={setActive}
        user={user}
        balance={balance}
        onBuy={() => setShowBuy(true)}
      />
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>GeoCauris</span>
            <b>/</b>
            <strong>{active}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="topbar-help"
              type="button"
              onClick={() => setActive("Centre d’aide")}
            >
              <BookOpen size={15} /> Aide
            </button>
            <button
              className="topbar-buy"
              type="button"
              onClick={() => setShowBuy(true)}
            >
              <Plus size={15} /> Acheter des cauris
            </button>
          </div>
        </header>
        <div className="page" id="top">
          {notice && (
            <div className="notice" role="alert">
              {notice}
              <button onClick={() => setNotice("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {active === "Vue d’ensemble" && (
            <Overview
              name={displayName}
              balance={balance}
              loading={loading}
              spent={spent}
              rows={rows}
              onBuy={() => setShowBuy(true)}
              onKey={generateKey}
            />
          )}
          {active === "Consommation" && <Usage rows={rows} spent={spent} />}
          {active === "Ma clé API" && (
            <KeyPanel apiKey={apiKey} onGenerate={generateKey} />
          )}
          {active === "Documentation" && <Docs />}
          {active === "Centre d’aide" && <Help />}
          {active === "Administration" && <AdminNotice />}
        </div>
        {showBuy && (
          <BuyModal
            onClose={() => setShowBuy(false)}
            buying={buying}
            onBuy={buy}
          />
        )}
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
    user.email ===
    (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "oliviergnacadja693@gmail.com");
  return (
    <aside className="sidebar">
      <a className="sidebar-brand" href="#top">
        <span className="sidebar-logo">
          <span /> <span /> <span />
        </span>
        <strong>GeoCauris</strong>
      </a>
      <button className="account-card" type="button">
        <span className="account-avatar">
          {user.email?.slice(0, 1).toUpperCase()}
        </span>
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
      </nav>
      {isAdmin && (
        <>
          <p className="sidebar-label">Administration</p>
          <button
            className={`sidebar-nav-button ${active === "Administration" ? "selected" : ""}`}
            type="button"
            onClick={() => setActive("Administration")}
          >
            <ShieldCheck size={18} />
            <span>Administration</span>
          </button>
        </>
      )}
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
        <span className="account-avatar">
          {user.email?.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <b>{user.email?.split("@")[0] ?? "Client"}</b>
          <small>{user.email}</small>
        </span>
        <button
          type="button"
          onClick={() => signOut(firebaseAuth)}
          aria-label="Se déconnecter"
        >
          <SignOut size={15} />
        </button>
      </div>
    </aside>
  );
}

function Overview({
  name,
  balance,
  loading,
  spent,
  rows,
  onBuy,
  onKey,
}: {
  name: string;
  balance: number;
  loading: boolean;
  spent: number;
  rows: Row[];
  onBuy: () => void;
  onKey: () => void;
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
            Un espace clair pour piloter votre puissance IA, sans surprise sur
            la facture.
          </p>
        </div>
        <div className="service">
          <span className="online" /> Système opérationnel{" "}
          <ShieldCheck size={16} />
        </div>
      </section>
      <section className="balance-grid">
        <div className="balance-card">
          <div className="balance-top">
            <span className="kicker light">Votre réserve</span>
            <span className="balance-label">CAURIS</span>
          </div>
          <div className="balance-number">
            {loading ? "..." : balance.toLocaleString("fr-FR")}
          </div>
          <p>crédits disponibles</p>
          <div className="balance-foot">
            <span>Compte Firebase sécurisé</span>
            <span className="positive">{userLabel(name)}</span>
          </div>
        </div>
        <div className="quote-card">
          <span className="quote-mark">“</span>
          <p>Les bons outils doivent disparaître derrière le travail.</p>
          <span className="quote-credit">GEOCAURIS / PRINCIPLE 01</span>
        </div>
      </section>
      <section className="section-heading">
        <div>
          <p className="kicker">Recharge instantanée</p>
          <h2>Garder de l’avance.</h2>
        </div>
        <p>
          Choisissez un volume. Le paiement Mobile Money ou carte et le crédit
          du compte sont confirmés ensemble.
        </p>
      </section>
      <section className="packs-grid">
        {CAURIS_PACKS.map((pack, index) => (
          <article
            className={`pack-card ${index === 2 ? "featured" : ""}`}
            key={pack.id}
          >
            {index === 2 && <span className="pack-ribbon">Le plus choisi</span>}
            <span className="pack-name">{pack.name}</span>
            <strong>{pack.credits.toLocaleString("fr-FR")}</strong>
            <small>cauris</small>
            <b>{pack.priceXof.toLocaleString("fr-FR")} FCFA</b>
            <button onClick={onBuy}>
              <Plus size={15} /> Recharger
            </button>
          </article>
        ))}
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
                  {row.cauris} cauris
                </b>
              </div>
            ))
          ) : (
            <div className="empty-panel">
              Aucune transaction pour le moment.
            </div>
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
function userLabel(name: string) {
  return `${name}@geocauris.app`;
}
function Usage({ rows, spent }: { rows: Row[]; spent: number }) {
  return (
    <>
      <section className="intro">
        <div>
          <p className="kicker">Suivi d’activité</p>
          <h1>Votre consommation.</h1>
          <p className="intro-copy">
            Comprenez comment vos cauris alimentent vos requêtes IA.
          </p>
        </div>
      </section>
      <section className="dashboard-lower">
        <div className="panel activity-panel wide-panel">
          <div className="panel-heading">
            <div>
              <h2>Historique des consommations</h2>
              <p>Les requêtes exécutées via votre clé GeoCauris.</p>
            </div>
            <span className="stat-chip">{spent} cauris utilisés</span>
          </div>
          {rows.length ? (
            rows.map((row) => (
              <div className="activity-row" key={row.id}>
                <span className={`activity-icon ${row.type}`}>
                  <TrendUp size={15} />
                </span>
                <div>
                  <strong>{row.model}</strong>
                  <small>{row.label}</small>
                </div>
                <b className="debit">−{row.cauris} cauris</b>
              </div>
            ))
          ) : (
            <div className="empty-panel">
              Votre historique apparaîtra après votre première requête.
            </div>
          )}
        </div>
        <div className="panel quick-card">
          <span className="api-icon">
            <ChartLineUp size={18} />
          </span>
          <h2>{spent}</h2>
          <p>cauris consommés dans les données disponibles</p>
          <div className="progress-line">
            <span style={{ width: `${Math.min(spent / 5, 100)}%` }} />
          </div>
        </div>
      </section>
    </>
  );
}
function KeyPanel({
  apiKey,
  onGenerate,
}: {
  apiKey: string | null;
  onGenerate: () => void;
}) {
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
            Utilisez cette clé dans le header Authorization de vos appels à{" "}
            <code>/api/proxy</code>.
          </p>
          <div className="key-box">
            <code>
              {show && apiKey ? apiKey : "cau_live_••••••••••••••••••"}
            </code>
            <button
              className="icon-button"
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
          <p>
            Ne partagez jamais votre clé dans un dépôt public ou dans un fichier
            frontend.
          </p>
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
          Appelez le proxy avec votre clé GeoCauris. Les cauris sont réservés
          puis débités selon la consommation.
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
          <p className="intro-copy">
            Une question sur vos cauris, SasPay ou l’intégration IA ?
          </p>
        </div>
      </section>
      <section className="help-cards">
        <button
          className="panel"
          onClick={() =>
            (window.location.href = "mailto:supportgeocauris@gmail.com")
          }
        >
          <Coin size={22} />
          <h2>Paiements et cauris</h2>
          <p>supportgeocauris@gmail.com</p>
        </button>
        <button
          className="panel"
          onClick={() => (window.location.href = "tel:0142547085")}
        >
          <ShieldCheck size={22} />
          <h2>Parler au support</h2>
          <p>01 42 54 70 85</p>
        </button>
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
            La gestion du pool de clés reste protégée par les routes serveur
            existantes.
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
          Utilisez le panneau d’administration existant pour ajouter, activer et
          recharger les clés Imọlẹ. Les secrets ne sont jamais exposés au
          navigateur.
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
      <div className="modal-card">
        <button className="modal-close icon-button" onClick={onClose}>
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
          Paiement sécurisé via SasPay. Vos cauris sont crédités automatiquement
          après confirmation.
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
              <small>
                cauris · {pack.priceXof.toLocaleString("fr-FR")} FCFA
              </small>
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
  if (code.includes("invalid-credential"))
    return "Email ou mot de passe incorrect.";
  if (code.includes("email-already-in-use"))
    return "Un compte existe déjà avec cet email.";
  if (code.includes("weak-password"))
    return "Le mot de passe doit contenir au moins 6 caractères.";
  return "Une erreur est survenue. Réessayez.";
}
