import { db } from "../models/firebaseConfig.js";
import {
  collection, addDoc, getDocs, doc, getDoc, serverTimestamp, query, where, orderBy,
} from "firebase/firestore";

// ─── Participant joins an event ───────────────────────────────────────────────
export const joinEvent = async (req, res) => {
  const { eventId, fullName, contactNumber, barangay, notes } = req.body;

  try {
    if (!eventId) {
      req.flash("error_msg", "Please select an event.");
      return res.redirect("/dashboard");
    }

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
        where("eventId",      "==", eventId),
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
      eventDate:     ev.date || "",
      eventVenue:    ev.venue || "",
      eventType:     ev.type || "",
      participantId: req.session.userId,
      fullName:      (fullName || req.session.userName || "").trim(),
      contactNumber: (contactNumber || "").trim(),
      barangay:      (barangay || "").trim(),
      notes:         (notes || "").trim(),
      status:        "registered",
      joinedAt:      serverTimestamp(),
    });

    req.flash("success_msg", `You have successfully joined "${ev.name}"! See you there.`);
    res.redirect("/participant/registrations");
  } catch (err) {
    console.error("Join event error:", err);
    req.flash("error_msg", "Failed to join event. Please try again.");
    res.redirect("/dashboard");
  }
};

// ─── Participant views their own registrations ────────────────────────────────
export const myRegistrations = async (req, res) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, "event_participants"),
        where("participantId", "==", req.session.userId),
        orderBy("joinedAt", "desc")
      )
    );

    const registrations = snap.docs.map(d => {
      const data = d.data();
      return {
        id:            d.id,
        eventId:       data.eventId       || "",
        eventName:     data.eventName     || "Unknown Event",
        eventDate:     data.eventDate     || "",
        eventVenue:    data.eventVenue    || "",
        eventType:     data.eventType     || "",
        fullName:      data.fullName      || "",
        contactNumber: data.contactNumber || "",
        barangay:      data.barangay      || "",
        notes:         data.notes         || "",
        status:        data.status        || "registered",
        joinedAt:      data.joinedAt?.toDate?.()?.toLocaleString("en-PH") || "—",
      };
    });

    res.render("participant/registrations", {
      title:         "My Registrations",
      userName:      req.session.userName,
      userRole:      req.session.userRole,
      userInitial:   (req.session.userName || "U")[0].toUpperCase(),
      isParticipant: true,
      registrations,
      count:         registrations.length,
    });
  } catch (err) {
    console.error("My registrations error:", err);
    req.flash("error_msg", "Could not load your registrations.");
    res.redirect("/dashboard");
  }
};
