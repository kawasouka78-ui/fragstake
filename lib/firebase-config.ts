export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const firebaseEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
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
