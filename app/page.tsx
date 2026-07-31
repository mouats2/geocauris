"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, BookOpenText, ChartLineUp, Copy, Key, ShieldCheck, SquaresFour } from "@phosphor-icons/react";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { firebaseAuth, firestore } from "../lib/firebase";
import { CAURIS_PACKS } from "../lib/pricing";

const nav = [
  { label: "Vue d'ensemble", icon: SquaresFour },
  { label: "Consommation", icon: ChartLineUp },
  { label: "Ma clé API", icon: Key },
  { label: "Documentation", icon: BookOpenText },
  { label: "Centre d'aide", icon: BookOpenText },
];

type Activity = { id: string; label: string; model: string; amount: string; cauris: number; inputTokens: number; outputTokens: number; costXof: number; type: "debit" | "credit"; createdAt?: { seconds?: number } };

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onAuthStateChanged(firebaseAuth, (nextUser) => { setUser(nextUser); setLoading(false); }), []);
  if (loading) return <div className="auth-loading">Chargement de GeoCauris...</div>;
  return user ? <Dashboard user={user} /> : <AuthScreen />;
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const credentials = mode === "login" ? await signInWithEmailAndPassword(firebaseAuth, email, password) : await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (mode === "signup") {
        await setDoc(doc(firestore, "users", credentials.user.uid), { uid: credentials.user.uid, email, status: "active", createdAt: serverTimestamp() }, { merge: true });
        await setDoc(doc(firestore, "wallets", credentials.user.uid), { uid: credentials.user.uid, soldeCauris: 0, updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (caught) { setError(firebaseMessage(caught)); } finally { setBusy(false); }
  }

  return <main className="auth-shell"><div className="auth-brand"><span className="wordmark-mark">G</span><strong>GeoCauris<span className="wordmark-dot">.</span></strong></div><section className="auth-card"><div className="auth-copy"><p className="kicker">IA × géospatial</p><h1>{mode === "login" ? "Votre espace de travail." : "Créer votre réserve."}</h1><p>Connectez Codex à vos workflows cartographiques, avec un suivi clair de chaque cauri.</p></div><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" /></label><label>Mot de passe<input type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6 caractères minimum" /></label>{error && <div className="form-error">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? "Connexion..." : mode === "login" ? "Se connecter" : "Créer mon compte"}</button></form><button className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>{mode === "login" ? "Nouveau sur GeoCauris ? Créer un compte" : "J'ai déjà un compte · Se connecter"}</button></section><p className="auth-foot">Vos données sont stockées dans votre projet Firebase GeoCauris.</p></main>;
}

function Dashboard({ user }: { user: User }) {
  const [active, setActive] = useState("Vue d'ensemble");
  const [balance, setBalance] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notice, setNotice] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    async function loadAccount() {
      const walletSnapshot = await getDoc(doc(firestore, "wallets", user.uid));
      setBalance(Number(walletSnapshot.data()?.soldeCauris ?? 0));
      const transactionsQuery = query(collection(firestore, "transactions"), where("uid", "==", user.uid), orderBy("createdAt", "desc"), limit(6));
      const transactionSnapshot = await getDocs(transactionsQuery).catch(() => null);
      const rows = transactionSnapshot?.docs.map((item) => { const data = item.data(); const cauris = Number(data.cauris ?? data.coutCauris ?? 0); const credit = data.type === "credit" || cauris > 0; return { id: item.id, label: data.label ?? (credit ? "Recharge de compte" : "Consommation IA"), model: data.model ?? "GeoCauris", amount: `${credit ? "+" : "−"} ${Math.abs(cauris).toLocaleString("fr-FR")}`, cauris: Math.abs(cauris), inputTokens: Number(data.tokensEntree ?? data.inputTokens ?? 0), outputTokens: Number(data.tokensSortie ?? data.outputTokens ?? 0), costXof: Number(data.coutXof ?? 0), type: credit ? "credit" : "debit" } as Activity; }) ?? [];
      setActivities(rows); setDataLoading(false);
    }
    loadAccount().catch(() => setDataLoading(false));
  }, [user.uid]);

  async function buy(credits: number, price: string) {
    const pack = CAURIS_PACKS.find((item) => item.credits === credits);
    if (!pack) return;
    const response = await fetch("/api/payments/fedapay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId: pack.id, credits, uid: user.uid, email: user.email }) });
    const data = await response.json().catch(() => ({}));
    setNotice(response.ok ? `Transaction FedaPay créée pour ${credits.toLocaleString("fr-FR")} cauris · ${price}. Finalisez le paiement dans la session FedaPay.` : data.error ?? "Impossible de créer la transaction FedaPay.");
  }
  const spent = activities.filter((item) => item.type === "debit").reduce((total, item) => total + item.cauris, 0);
  const tokens = activities.reduce((total, item) => total + item.inputTokens + item.outputTokens, 0);
  const totalCost = activities.filter((item) => item.type === "debit").reduce((total, item) => total + item.costXof, 0);
  const displayName = user.email?.split("@")[0] ?? "utilisateur";
  return <main className="app-shell"><header className="topbar"><a className="wordmark" href="#top"><span className="wordmark-mark">G</span><span>GeoCauris<span className="wordmark-dot">.</span></span></a><nav className="topnav">{nav.map(({ label, icon: Icon }) => <button key={label} className={active === label ? "selected" : ""} onClick={() => setActive(label)}><Icon size={17} weight="duotone" />{label}</button>)}</nav><div className="profile"><span className="online" /><span>{user.email?.slice(0, 2).toUpperCase()}</span><button onClick={() => signOut(firebaseAuth)} aria-label="Se déconnecter">Quitter</button></div></header><div className="page" id="top">{active === "Vue d'ensemble" && <section className="intro"><div><p className="kicker">Espace personnel</p><h1>Bonjour, {displayName}<span className="lime">.</span></h1><p className="intro-copy">Un espace clair pour piloter votre puissance IA, sans surprise sur la facture.</p></div><div className="service"><span className="online" /> Service opérationnel <ArrowUpRight size={16} /></div></section>}{notice && <div className="notice">{notice}<button onClick={() => setNotice("")}>Fermer</button></div>}{active !== "Vue d'ensemble" && <RoutePanel active={active} balance={balance} email={user.email ?? ""} activities={activities} spent={spent} tokens={tokens} totalCost={totalCost} showKey={showKey} setShowKey={setShowKey} setNotice={setNotice} />}{active === "Vue d'ensemble" && <><section className="balance-grid"><div className="balance-card"><div className="balance-top"><span className="kicker light">Votre réserve</span><span className="balance-label">CAURIS</span></div><div className="balance-number">{dataLoading ? "..." : balance.toLocaleString("fr-FR")}</div><p>crédits disponibles</p><div className="balance-foot"><span>Compte Firebase sécurisé</span><span className="positive">{user.email}</span></div></div><div className="quote-card"><span className="quote-mark">“</span><p>Les bons outils doivent disparaître derrière le travail.</p><span className="quote-credit">GEOCAURIS / PRINCIPLE 01</span></div></section><section className="section-heading"><div><p className="kicker">Recharge instantanée</p><h2>Garder de l'avance.</h2></div><p>Choisissez un volume. Le paiement Mobile Money et le crédit du compte sont confirmés ensemble.</p></section><section className="packs-grid">{CAURIS_PACKS.map((pack, index) => <Pack key={pack.id} {...pack} featured={index === 2} onBuy={buy} />)}</section><section className="lower-grid"><div className="panel activity-panel"><div className="panel-heading"><div><p className="kicker">Journal Firestore</p><h2>Derniers mouvements</h2></div><button className="text-button">Tout voir <ArrowUpRight size={15} /></button></div><div className="activity-list">{activities.length ? activities.map((row) => <div className="activity-row" key={row.id}><span className="activity-time">IA</span><span className="activity-main"><strong>{row.label}</strong><small>{row.model}</small></span><span className={row.type}>{row.amount}</span></div>) : <div className="empty-state">Aucune transaction pour le moment.</div>}</div></div><div className="panel key-panel"><div className="panel-heading"><div><p className="kicker">Point d'accès</p><h2>Votre clé API</h2></div><span className="active-badge"><span className="online" /> Prête</span></div><p className="key-intro">Utilisez cette clé pour connecter Codex à votre réserve GeoCauris.</p><div className="key-box"><code>{showKey ? "Générée après activation du compte" : "cau_live_••••••••••••••••"}</code><button onClick={() => setShowKey((value) => !value)}>{showKey ? "Masquer" : <><Copy size={15} /> Voir</>}</button></div><button className="regenerate" onClick={() => setNotice("La génération de clé sera activée après validation du profil.")}><ShieldCheck size={17} /> Générer ma clé</button></div></section></>}<footer><span>GEOCAURIS · L'IA pour vos workflows géospatiaux.</span><span>Compte : {user.email}</span></footer></div></main>;
}

function RoutePanel({ active, balance, email, activities, spent, tokens, totalCost, showKey, setShowKey, setNotice }: { active: string; balance: number; email: string; activities: Activity[]; spent: number; tokens: number; totalCost: number; showKey: boolean; setShowKey: (value: boolean) => void; setNotice: (value: string) => void }) {
  if (active === "Consommation") return <section className="full-route"><div className="route-header"><div><p className="kicker">Analyse d'usage</p><h2>Votre consommation</h2><p>Chaque requête est enregistrée dans Firestore pour garder une trace claire de vos usages.</p></div></div><div className="consumption-stats"><Stat label="Cauris dépensés" value={spent.toLocaleString("fr-FR")} suffix="cauris" /><Stat label="Tokens utilisés" value={tokens.toLocaleString("fr-FR")} suffix="tokens" /><Stat label="Coût total associé" value={totalCost.toLocaleString("fr-FR")} suffix="FCFA" /></div><div className="panel consumption-history"><div className="panel-heading"><div><p className="kicker">Historique détaillé</p><h2>Requêtes effectuées</h2></div></div><div className="consumption-list">{activities.filter((item) => item.type === "debit").length ? activities.filter((item) => item.type === "debit").map((item) => <div className="consumption-row" key={item.id}><div><strong>{item.label}</strong><small>{item.model}</small></div><span>{item.inputTokens.toLocaleString("fr-FR")} tokens entrée</span><span>{item.outputTokens.toLocaleString("fr-FR")} tokens sortie</span><b>− {item.cauris.toLocaleString("fr-FR")} cauris</b></div>) : <div className="empty-state">Aucune consommation enregistrée pour le moment.</div>}</div></div></section>;
  if (active === "Ma clé API") return <section className="full-route"><div className="route-header"><div><p className="kicker">Connexion Codex</p><h2>Votre clé API</h2><p>Utilisez cette clé pour connecter Codex à votre réserve GeoCauris.</p></div><span className="active-badge"><span className="online" /> Prête</span></div><div className="key-page-card"><div className="key-box"><code>{showKey ? "Générée après activation du compte" : "cau_live_••••••••••••••••"}</code><button onClick={() => setShowKey(!showKey)}>{showKey ? "Masquer" : <><Copy size={15} /> Voir</>}</button></div><button className="regenerate" onClick={() => setNotice("La génération de clé sera activée après validation du profil.")}><ShieldCheck size={17} /> Générer ma clé</button><p className="muted-line">Compte lié : {email}</p></div></section>;
  if (active === "Documentation") return <section className="full-route"><div className="route-header"><div><p className="kicker">Documentation</p><h2>Configurer Codex avec GeoCauris</h2><p>Suivez ces étapes pour connecter vos workflows géospatiaux à l'API GeoCauris.</p></div></div><div className="docs-list"><DocStep number="01" title="Générer une clé API">Ouvrez la page « Ma clé API », puis cliquez sur « Générer ma clé ». La clé ne doit jamais être partagée.</DocStep><DocStep number="02" title="Récupérer et utiliser la clé">Copiez la clé affichée une seule fois et conservez-la dans un gestionnaire de secrets ou une variable d'environnement.</DocStep><DocStep number="03" title="Configurer Codex">Dans votre configuration Codex, utilisez la base URL <code>https://api.geocauris.app/v1</code> et votre clé GeoCauris comme Bearer token.</DocStep><DocStep number="04" title="Effectuer une première requête">Lancez une requête simple avec le modèle souhaité. Le proxy GeoCauris authentifie la clé, vérifie le solde, puis transmet la requête à Imọlẹ.</DocStep><DocStep number="05" title="Vérifier les cauris et les tokens">Consultez « Consommation » pour voir les tokens d'entrée, les tokens de sortie, les cauris débités et le coût associé.</DocStep></div></section>;
  return <section className="full-route"><div className="route-header"><div><p className="kicker">Assistance GeoCauris</p><h2>Centre d'aide</h2><p>Préparez votre adresse email, l'heure de la requête et l'identifiant affiché dans votre historique avant de nous contacter.</p></div></div><div className="help-grid"><div className="help-card"><span className="kicker">Email support</span><strong>{process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "supportgeocauris@gmail.com"}</strong><small>Pour les questions de compte, paiement et configuration.</small></div><div className="help-card"><span className="kicker">Téléphone / WhatsApp</span><strong>{process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "01 42 54 70 85"}</strong><small>Assistance GeoCauris pour votre compte et vos requêtes.</small></div><div className="help-card"><span className="kicker">Informations utiles</span><strong>UID + date + modèle</strong><small>Ces éléments nous permettent de retrouver rapidement votre requête.</small></div></div></section>;
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix: string }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{suffix}</small></div>; }
function DocStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) { return <article className="doc-step"><b>{number}</b><div><h3>{title}</h3><p>{children}</p></div></article>; }

function Pack({ name, credits, priceXof, featured, onBuy }: { name: string; credits: number; priceXof: number; featured?: boolean; onBuy: (credits: number, price: string) => void }) { const price = `${priceXof.toLocaleString("fr-FR")} FCFA`; return <article className={`pack-card ${featured ? "featured" : ""}`}><div className="pack-card-top"><span>{name}</span>{featured && <b>Le plus choisi</b>}</div><strong>{credits.toLocaleString("fr-FR")}</strong><small>cauris</small><div className="pack-price">{price}</div><button onClick={() => onBuy(credits, price)}>Choisir <ArrowUpRight size={16} /></button></article>; }

function firebaseMessage(error: unknown) { const code = (error as { code?: string })?.code; if (code === "auth/invalid-credential") return "Email ou mot de passe incorrect."; if (code === "auth/email-already-in-use") return "Cet email possède déjà un compte."; if (code === "auth/weak-password") return "Le mot de passe doit contenir au moins 6 caractères."; return "Impossible de traiter la demande. Vérifiez votre connexion."; }
