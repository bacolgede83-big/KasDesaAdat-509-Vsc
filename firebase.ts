import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  setLogLevel, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Suppress benign connection retry / offline warning logs in console
try {
  setLogLevel('silent');
} catch (e) {
  // Ignore if already initialized
}

// KONFIGURASI FIREBASE
// PENTING: Ganti nilai-nilai di bawah ini dengan konfigurasi dari Firebase Console Anda!
// Caranya: Buka Firebase Console -> Project Settings -> General -> Your apps -> SDK setup and configuration
// tupawan firebase
const firebaseConfig = {
  apiKey: "AIzaSyBQt-2fkZO1rrncSe9iTYgI_IWwumEnPj4",
  authDomain: "pada-cb.firebaseapp.com",
  projectId: "pada-cb",
  storageBucket: "pada-cb.firebasestorage.app",
  messagingSenderId: "964526976261",
  appId: "1:964526976261:web:d47f97b135cf9a5312db6c"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Services with resilient auto-detect long polling and multi-tab persistent cache
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const storage = getStorage(app);
