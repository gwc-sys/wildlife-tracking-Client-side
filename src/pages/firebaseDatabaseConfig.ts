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
// 3. Type Safety (TypeScript Interfaces)
// ======================
interface LocationData {
  accuracy: number;
  lat: number;
  lng: number;
  source: string;
  timestamp: number;
}

interface AlertData {
  status: string;
  timestamp: number;
  source?: string;
}

interface DeviceData {
  alerts: Record<string, AlertData>;
  location: LocationData;
  locations?: {
    history?: Record<string, LocationData>;
  };
}

// ======================
// 4. Core Database Functions
// ======================

/**
 * Fetches historical data with sorting and limiting
 */
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

/**
 * Sets up a real-time listener for data changes
 */
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

// ======================
// 5. Device-Specific Functions
// ======================

/**
 * Get complete device data by device ID
 */
export async function getDeviceData(deviceId: string): Promise<DeviceData | null> {
  const dbRef = ref(database, `devices/${deviceId}`);
  
  return new Promise((resolve, reject) => {
    onValue(
      dbRef,
      (snapshot) => {
        resolve(snapshot.val() as DeviceData);
      },
      (error) => {
        reject(error);
      },
      { onlyOnce: true }
    );
  });
}

/**
 * Listen for real-time updates to a device's data
 */
export function listenToDevice(
  deviceId: string,
  callback: (data: DeviceData | null) => void,
  errorCallback?: (error: Error) => void
): () => void {
  return listenToRealtimeData<DeviceData>(`devices/${deviceId}`, callback, errorCallback);
}

/**
 * Get a device's current location
 */
export async function getCurrentLocation(deviceId: string): Promise<LocationData | null> {
  const dbRef = ref(database, `devices/${deviceId}/location`);
  
  return new Promise((resolve, reject) => {
    onValue(
      dbRef,
      (snapshot) => {
        resolve(snapshot.val() as LocationData);
      },
      (error) => {
        reject(error);
      },
      { onlyOnce: true }
    );
  });
}

/**
 * Listen for real-time location updates
 */
export function listenToLocationUpdates(
  deviceId: string,
  callback: (location: LocationData | null) => void,
  errorCallback?: (error: Error) => void
): () => void {
  return listenToRealtimeData<LocationData>(`devices/${deviceId}/location`, callback, errorCallback);
}

/**
 * Get location history for a device
 */
export async function getLocationHistory(
  deviceId: string,
  limit: number = 10
): Promise<LocationData[]> {
  const path = `devices/${deviceId}/locations/history`;
  
  // Since history items have push IDs, we need to fetch and sort them
  const dbRef = ref(database, path);
  
  return new Promise((resolve, reject) => {
    onValue(
      dbRef,
      (snapshot) => {
        const locations: LocationData[] = [];
        snapshot.forEach((childSnapshot) => {
          locations.push(childSnapshot.val());
        });
        // Sort by timestamp (newest first)
        locations.sort((a, b) => b.timestamp - a.timestamp);
        resolve(locations.slice(0, limit));
      },
      (error) => {
        reject(error);
      },
      { onlyOnce: true }
    );
  });
}

/**
 * Get all alerts for a device
 */
export async function getDeviceAlerts(
  deviceId: string,
  limit: number = 10
): Promise<AlertData[]> {
  const path = `devices/${deviceId}/alerts`;
  
  return new Promise((resolve, reject) => {
    const dbRef = ref(database, path);
    
    onValue(
      dbRef,
      (snapshot) => {
        const alerts: AlertData[] = [];
        snapshot.forEach((childSnapshot) => {
          alerts.push(childSnapshot.val());
        });
        // Sort by timestamp (newest first)
        alerts.sort((a, b) => b.timestamp - a.timestamp);
        resolve(alerts.slice(0, limit));
      },
      (error) => {
        reject(error);
      },
      { onlyOnce: true }
    );
  });
}

/**
 * Listen for new alerts in real-time
 */
export function listenToDeviceAlerts(
  deviceId: string,
  callback: (alert: AlertData) => void,
  errorCallback?: (error: Error) => void
): () => void {
  const dbRef = ref(database, `devices/${deviceId}/alerts`);
  
  return onValue(
    dbRef,
    (snapshot) => {
      snapshot.forEach((childSnapshot) => {
        // Only call callback for new alerts (within last 10 seconds)
        const alertData = childSnapshot.val() as AlertData;
        if (alertData.timestamp > Date.now() - 10000) {
          callback(alertData);
        }
      });
    },
    (error) => {
      console.error(`Error listening to alerts for device ${deviceId}:`, error);
      if (errorCallback) errorCallback(error);
    }
  );
}

/**
 * Get the latest alert for a device
 */
export async function getLatestAlert(deviceId: string): Promise<AlertData | null> {
  const alerts = await getDeviceAlerts(deviceId, 1);
  return alerts.length > 0 ? alerts[0] : null;
}

// ======================
// 6. Utility Functions
// ======================

/**
 * Convert Firebase timestamp to readable date
 */
export function formatFirebaseTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Calculate distance between two locations (in km)
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}

// Export Firebase instances
export { database, analytics };