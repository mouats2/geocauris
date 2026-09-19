import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

// Keep the module importable during Next.js static generation. Firebase Auth
// validates the API key immediately, so an empty build-time configuration
// must not crash `/admin` before the client has loaded its environment.
const hasClientConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const firebaseApp = getApps().length
  ? getApps()[0]
  : initializeApp(hasClientConfig ? firebaseConfig : {
      ...firebaseConfig,
      apiKey: "build-placeholder",
      projectId: firebaseConfig.projectId || "build-placeholder",
    });

export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
