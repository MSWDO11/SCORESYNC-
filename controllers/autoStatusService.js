/**
 * autoStatusService.js
 * Automatically transitions event status:
 *   upcoming → ongoing   when date + start time is reached
 *   ongoing  → completed when date + end time has passed
 *
 * Called on dashboard load and events list load.
 * Admin and organizers can still manually override status at any time.
 */

import { db } from "../models/firebaseConfig.js";
import {
  collection, getDocs, doc, updateDoc, query, where,
} from "firebase/firestore";

// Parses "YYYY-MM-DD" + "HH:MM" into a JS Date
function parseEventDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const iso = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export async function autoTransitionEventStatus() {
  try {
    const now = new Date();

    // ── 1. upcoming → ongoing ─────────────────────────────────────────────────
    const upcomingSnap = await getDocs(
      query(collection(db, "events"), where("status", "==", "upcoming"))
    );

    // ── 2. ongoing → completed ────────────────────────────────────────────────
    const ongoingSnap = await getDocs(
      query(collection(db, "events"), where("status", "==", "ongoing"))
    );

    const updates = [];

    upcomingSnap.docs.forEach(d => {
      const ev = d.data();
      const startDT = parseEventDateTime(ev.date, ev.time);
      if (startDT && startDT <= now) {
        updates.push(updateDoc(doc(db, "events", d.id), { status: "ongoing" }));
        console.log(`⏰ Auto → ongoing: "${ev.name}" (${ev.date} ${ev.time || ""})`);
      }
    });

    ongoingSnap.docs.forEach(d => {
      const ev = d.data();
      if (!ev.endTime) return; // no end time set — never auto-complete
      const endDT = parseEventDateTime(ev.date, ev.endTime);
      if (endDT && endDT <= now) {
        updates.push(updateDoc(doc(db, "events", d.id), { status: "completed" }));
        console.log(`✅ Auto → completed: "${ev.name}" (${ev.date} ${ev.endTime})`);
      }
    });

    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`🔄 Auto-transitioned ${updates.length} event(s).`);
    }
  } catch (err) {
    console.warn("autoTransitionEventStatus error:", err.message);
  }
}
