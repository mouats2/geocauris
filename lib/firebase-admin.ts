import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try { return initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) }); } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON_INVALID"); }
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return initializeApp({ credential: applicationDefault(), projectId });
}

export function adminFirestore() {
  return getFirestore(getAdminApp());
}

export function adminAuth() {
  return getAuth(getAdminApp());
}
