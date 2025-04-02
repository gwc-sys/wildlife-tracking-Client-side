// filepath: d:\Working Project\Wildlife-tracking\wildlife-tracking\src\pages\firebaseDatabaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'your-real-api-key',
  authDomain: 'your-real-auth-domain',
  databaseURL: 'your-real-database-url',
  projectId: 'your-real-project-id',
  storageBucket: 'your-real-storage-bucket',
  messagingSenderId: 'your-real-messaging-sender-id',
  appId: 'your-real-app-id',
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);