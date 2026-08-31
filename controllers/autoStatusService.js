/**
 * autoStatusService.js
 * Automatically transitions event status:
 *   upcoming  → ongoing   when the event's date+time has been reached
 *
 * Called on dashboard load and events list load.
 * Admin and organizers can still manually override status at any time.
 */

import { db } from "../models/firebaseConfig.js";
import {
  collection, getDocs, doc, updateDoc, query, where,
} from "firebase/firestore";

// Parses "YYYY-MM-DD" + "HH:MM" into a JS Date (local time)
function parseEventDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  // Build ISO-like string — "2026-08-30T19:00"
  const iso = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Runs a lightweight check on all "upcoming" events.
 * If the event's date+time <= now, flip it to "ongoing".
 * Safe to call on every request — only updates when needed.
 */
export async function autoTransitionEventStatus() {
  try {
    const now = new Date();

    // Only fetch upcoming events (minimise reads)
    const snap = await getDocs(
      query(collection(db, "events"), where("status", "==", "upcoming"))
    );

    const updates = [];
    snap.docs.forEach(d => {
      const ev = d.data();
      const eventDT = parseEventDateTime(ev.date, ev.time);

      if (eventDT && eventDT <= now) {
        updates.push(
          updateDoc(doc(db, "events", d.id), { status: "ongoing" })
        );
        console.log(`⏰ Auto-transition: "${ev.name}" → ongoing (was scheduled ${ev.date} ${ev.time || ""})`);
      }
    });

    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`✅ Auto-transitioned ${updates.length} event(s) to ongoing.`);
    }
  } catch (err) {
    // Non-fatal — log but don't crash the request
    console.warn("autoTransitionEventStatus error:", err.message);
  }
}
