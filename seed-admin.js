import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDocs, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCQTkh6tsjLjuw6d6KaPetiNH2CriQxD7Q",
  authDomain: "scoresync-92994.firebaseapp.com",
  projectId: "scoresync-92994",
  storageBucket: "scoresync-92994.firebasestorage.app",
  messagingSenderId: "518166819896",
  appId: "1:518166819896:web:8155a8be113adb9adb62cd",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Admin credentials ──────────────────────────────────────────
const ADMIN_NAME     = "ScoreSync Admin";
const ADMIN_EMAIL    = "admin@scoresync.com";
const ADMIN_PASSWORD = "Admin@2026";
// ──────────────────────────────────────────────────────────────

async function seedAdmin() {
  console.log("🔧 ScoreSync Admin Seeder");
  console.log("─".repeat(40));

  let uid;
  try {
    console.log(`📧 Creating Firebase Auth account for ${ADMIN_EMAIL}...`);
    const credential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    uid = credential.user.uid;
    console.log(`✅ Auth account created. UID: ${uid}`);
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      console.log(`ℹ️  Auth account ${ADMIN_EMAIL} already exists in Firebase Auth. Signing in...`);
      const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      uid = cred.user.uid;
      console.log(`✅ Signed in. UID: ${uid}`);
    } else {
      throw err;
    }
  }

  // Save/update to Firestore
  console.log("💾 Saving/updating admin profile in Firestore...");
  await setDoc(doc(db, "users", uid), {
    name:      ADMIN_NAME,
    email:     ADMIN_EMAIL,
    role:      "admin",
    status:    "approved",
    createdAt: new Date(),
  }, { merge: true });
  console.log("✅ Firestore profile saved with role 'admin' and status 'approved'.");

  printCredentials();
  process.exit(0);
}

function printCredentials() {
  console.log("");
  console.log("─".repeat(40));
  console.log("🏆 ADMIN ACCOUNT READY");
  console.log("─".repeat(40));
  console.log(`   URL      : http://localhost:3000/login`);
  console.log(`   Email    : ${ADMIN_EMAIL}`);
  console.log(`   Password : ${ADMIN_PASSWORD}`);
  console.log(`   Role     : admin`);
  console.log("─".repeat(40));
}

seedAdmin().catch(err => {
  console.error("❌ Error:", err.code || err.message);
  if (err.code === "auth/email-already-in-use") {
    console.log("   Account exists in Firebase Auth but not in Firestore.");
    console.log("   Run: http://localhost:3000/fix-role?email=admin@scoresync.com&role=admin");
  }
  if (err.code === "auth/network-request-failed") {
    console.log("   No internet connection. Connect to internet and try again.");
  }
  process.exit(1);
});
