import { db } from "../models/firebaseConfig.js";
import {
  collection, addDoc, getDocs, doc, getDoc, serverTimestamp, query, where,
} from "firebase/firestore";

// ─── Participant joins an event ───────────────────────────────────────────────
export const joinEvent = async (req, res) => {
  const { eventId, fullName, contactNumber, barangay, notes } = req.body;

  try {
    if (!eventId) {
      req.flash("error_msg", "Please select an event.");
      return res.redirect("/dashboard");
    }

    // Check event exists and is still active
    const evDoc = await getDoc(doc(db, "events", eventId));
    if (!evDoc.exists()) {
      req.flash("error_msg", "Event not found.");
      return res.redirect("/dashboard");
    }
    const ev = evDoc.data();
    if (!["upcoming", "ongoing"].includes(ev.status)) {
      req.flash("error_msg", "This event is no longer open for registration.");
      return res.redirect("/dashboard");
    }

    // Check if already joined
    const existing = await getDocs(
      query(collection(db, "event_participants"),
        where("eventId",     "==", eventId),
        where("participantId","==", req.session.userId)
      )
    );
    if (!existing.empty) {
      req.flash("error_msg", `You have already joined "${ev.name}".`);
      return res.redirect("/dashboard");
    }

    await addDoc(collection(db, "event_participants"), {
      eventId,
      eventName:     ev.name || "Unknown Event",
      participantId: req.session.userId,
      fullName:      (fullName || req.session.userName || "").trim(),
      contactNumber: (contactNumber || "").trim(),
      barangay:      (barangay || "").trim(),
      notes:         (notes || "").trim(),
      status:        "registered",
      joinedAt:      serverTimestamp(),
    });

    req.flash("success_msg", `You have successfully joined "${ev.name}"! See you there.`);
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Join event error:", err);
    req.flash("error_msg", "Failed to join event. Please try again.");
    res.redirect("/dashboard");
  }
};
