export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const firebaseEnv = {
  // These are Firebase's public web-app identifiers. Keep the environment
  // overrides for local/staging projects, but include the production project
  // at build time so Cloud Run's runtime-only variables cannot hide Auth from
  // the client bundle.
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCFaC23gstKOSGf2iC_Q5VQiT6ql7QQ1Uc',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'fragstake-b8eee.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'fragstake-b8eee',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'fragstake-b8eee.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '196964863678',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:196964863678:web:4ed53c70de5a6812d898ef',
};

export function hasFirebaseConfig() {
  return Object.values(firebaseEnv).every(Boolean);
}

export function firebaseWebConfig(): FirebaseWebConfig {
  if (!hasFirebaseConfig()) {
    throw new Error('Firebase web config is missing.');
  }

  return firebaseEnv as FirebaseWebConfig;
}

export const firebaseCollections = {
  config: 'publicConfig',
  players: 'players',
  wallets: 'wallets',
  ledger: 'ledgerEntries',
  inventory: 'inventory',
  matches: 'matches',
  duelLobbies: 'duelLobbies',
  friends: 'friends',
  messages: 'messages',
  reports: 'reports',
} as const;
