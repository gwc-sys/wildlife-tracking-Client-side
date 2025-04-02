// filepath: d:\Working Project\Wildlife-tracking\wildlife-tracking\src\pages\firebaseDatabaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {

  apiKey: "AIzaSyD1AU417WvKaz4_LT5B2hrWPuCypMVjio0",

  authDomain: "te-project-d9e53.firebaseapp.com",

  databaseURL: "https://te-project-d9e53-default-rtdb.firebaseio.com",

  projectId: "te-project-d9e53",

  storageBucket: "te-project-d9e53.firebasestorage.app",

  messagingSenderId: "434770721883",

  appId: "1:434770721883:web:0d6f4f5d9c59b174c8937e",

  measurementId: "G-D00VQKZ4Y3"

};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);x