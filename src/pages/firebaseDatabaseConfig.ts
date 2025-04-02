import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  onValue, 
  query, 
  limitToLast,
  orderByChild,
  DatabaseReference, 
  DataSnapshot 
} from 'firebase/database';
import { getAnalytics } from 'firebase/analytics';

// ======================
// 1. Environment Variables (Secure Config)
// ======================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD1AU417WvKaz4_LT5B2hrWPuCypMVjio0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "te-project-d9e53.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://te-project-d9e53-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "te-project-d9e53",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "te-project-d9e53.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "434770721883",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:434770721883:web:0d6f4f5d9c59b174c8937e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-D00VQKZ4Y3"
};

// ======================
// 2. Firebase Initialization (With Validation)
// ======================
function validateFirebaseConfig(config: Record<string, string>) {
  const missingKeys = Object.keys(config).filter(key => !config[key]);
  if (missingKeys.length > 0) {
    throw new Error(`Missing Firebase keys: ${missingKeys.join(', ')}`);
  }
}

validateFirebaseConfig(firebaseConfig);

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const analytics = getAnalytics(app);

// ======================
// 3. Type Safety (TypeScript Interface)
// ======================
interface MotionStatus {
  status: boolean;
  timestamp: number;
}

// ======================
// 4. Historical Data Fetching
// ======================
export async function getHistoricalData<T>(
  path: string, 
  limit: number = 10
): Promise<T[]> {
  const dbRef = ref(database, path);
  const historicalQuery = query(dbRef, orderByChild('timestamp'), limitToLast(limit));

  return new Promise((resolve, reject) => {
    onValue(
      historicalQuery,
      (snapshot) => {
        const data: T[] = [];
        snapshot.forEach((childSnapshot) => {
          data.push(childSnapshot.val());
        });
        resolve(data.reverse()); // Newest first
      },
      (error) => {
        reject(error);
      },
      { onlyOnce: true }
    );
  });
}

// ======================
// 5. Real-Time Data Listener
// ======================
export function listenToRealtimeData<T>(
  path: string,
  callback: (data: T | null) => void,
  errorCallback?: (error: Error) => void
): () => void {
  const dbRef: DatabaseReference = ref(database, path);

  const unsubscribe = onValue(
    dbRef,
    (snapshot: DataSnapshot) => {
      try {
        const data = snapshot.val() as T;
        if (data && typeof data === 'object') {
          callback(data);
        } else {
          console.warn(`Data at path "${path}" is invalid:`, data);
          callback(null);
        }
      } catch (error) {
        console.error(`Data parsing failed for path "${path}":`, error);
        callback(null);
      }
    },
    (error) => {
      console.error(`Firebase read error (path: "${path}"):`, error);
      if (errorCallback) errorCallback(error);
    }
  );

  return unsubscribe;
}
export { database, analytics };