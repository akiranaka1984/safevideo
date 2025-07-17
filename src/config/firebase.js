import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, browserSessionPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// セキュリティチェック関数
const validateEnvironment = () => {
  const requiredEnvVars = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID'
  ];

  const missingVars = requiredEnvVars.filter(
    varName => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.error('⚠️ Firebase設定エラー: 以下の環境変数が設定されていません:', missingVars);
    throw new Error('Firebase設定が不完全です。環境変数を確認してください。');
  }

  // 本番環境でHTTPSチェック
  if (process.env.NODE_ENV === 'production' && window.location.protocol !== 'https:') {
    console.error('🚨 セキュリティエラー: HTTPSが必須です');
    throw new Error('セキュアな接続（HTTPS）が必要です');
  }
};

// Firebase設定オブジェクト
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyAwh9F829QYLiWpU512Ed-3IKspIrHLpwk',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'singular-winter-370002.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'singular-winter-370002',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'singular-winter-370002.appspot.com',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '612916892061',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:612916892061:web:7f78901f68fee000471f74'
};

// Firebase初期化前の検証
validateEnvironment();

// Firebaseアプリを初期化
const app = initializeApp(firebaseConfig);

// 認証機能を取得
export const auth = getAuth(app);

// Firestoreデータベースを取得
export const db = getFirestore(app);

// 開発環境でのエミュレータ設定
if (process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true') {
  console.log('🔧 Firebase Emulatorモードで起動');
  
  // 認証エミュレータ
  connectAuthEmulator(auth, 'http://localhost:9099', {
    disableWarnings: true
  });
  
  // Firestoreエミュレータ
  connectFirestoreEmulator(db, 'localhost', 8080);
}

// セキュリティ設定
auth.useDeviceLanguage(); // デバイスの言語を使用

// 認証状態の永続性設定（ブラウザセッションのみ）
// localStorageは使用せず、セッションストレージも避ける
setPersistence(auth, browserSessionPersistence)
  .then(() => {
    console.log('✅ Firebase認証の永続性設定完了（ブラウザセッションのみ）');
  })
  .catch((error) => {
    console.error('❌ Firebase認証の永続性設定エラー:', error);
  });

export default app;