import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDSjFCzd-WAWi2dqYNsAgrzWpOyaVzW8Cg',
  authDomain: 'cada-4ed7c.firebaseapp.com',
  databaseURL: 'https://cada-4ed7c-default-rtdb.firebaseio.com',
  projectId: 'cada-4ed7c',
  storageBucket: 'cada-4ed7c.firebasestorage.app',
  messagingSenderId: '1062436435409',
  appId: '1:1062436435409:web:dafb6df11a7ce5658e1cf0',
  measurementId: 'G-597W4V1S3J',
};

export const app = initializeApp(firebaseConfig);

let analytics = null;

isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
    window.__CADA_FIREBASE_READY__ = true;
  }
});

export { analytics };
