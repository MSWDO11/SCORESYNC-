import { db } from "../models/firebaseConfig.js";
import {
  collection, addDoc, getDocs, getDoc, doc,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { autoTransitionEventStatus } from "./autoStatusService.js";

// Helper: build role locals from session
function roleLocals(req) {
  const role = req.session.userRole || "";
  return {
    userName:      req.session.userName,
    userRole:      role,
    userInitial:   (req.session.userName || "U")[0].toUpperCase(),
    isSuperAdmin:  role === "superadmin",
    isAdmin:       role === "admin" || role === "superadmin",
    isOrganizer:   role === "organizer",
    isJudge:       role === "judge",
    isParticipant: role === "participant",
    isEncoder:     role === "organizer", // legacy compat for templates
  };
}

const EVENTS = "events";

// ─── List all events ──────────────────────────────────────────────────────────
export const listEvents = async (req, res) => {
  try {
    // Auto-transition upcoming → ongoing before loading the list
    await autoTransitionEventStatus();
    const q = query(collection(db, EVENTS), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.render("events/index", {
      title: "Events",
      events,
      ...roleLocals(req),
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Could not load events.");
    res.redirect("/dashboard");
  }
};

// ─── Create event form ────────────────────────────────────────────────────────
export const createEventPage = (req, res) => {
  res.render("events/create", {
    title:       "Create Event",
    userName:    req.session.userName,
    userRole:    req.session.userRole,
    userInitial: (req.session.userName || "U")[0].toUpperCase(),
    isAdmin:     true,
  });
};

// ─── Store new event ──────────────────────────────────────────────────────────
export const storeEvent = async (req, res) => {
  const {
    name, description, date, time, venue, type, status,
    organizer, maxContestants, prizes, rules, theme, notes,
    paymentEnabled, ticketPrice, ticketCapacity,
    qrPaymentUrl, paymentAccountName, paymentNumber, ticketsSold,
  } = req.body;

  const isPaymentEnabled = paymentEnabled === "true";
  const parsedTicketPrice    = parseFloat(ticketPrice)    || 0;
  const parsedTicketCapacity = parseInt(ticketCapacity)   || 0;
  const parsedTicketsSold    = parseInt(ticketsSold)      || 0;

  try {
    await addDoc(collection(db, EVENTS), {
      name:               name || "",
      description:        description || "",
      date:               date || "",
      time:               time || "",
      venue:              venue || "",
      type:               type || "pageant",
      status:             status || "upcoming",
      organizer:          organizer || "",
      maxContestants:     maxContestants || "",
      prizes:             prizes || "",
      rules:              rules || "",
      theme:              theme || "blue",
      notes:              notes || "",
      // Payment / ticketing fields
      paymentEnabled:     isPaymentEnabled,
      ticketPrice:        parsedTicketPrice,
      ticketCapacity:     parsedTicketCapacity,
      qrPaymentUrl:       qrPaymentUrl || "",
      paymentAccountName: paymentAccountName || "",
      paymentNumber:      paymentNumber || "",
      ticketsSold:        parsedTicketsSold,
      createdBy:          req.session.userId,
      createdAt:          serverTimestamp(),
    });
    req.flash("success_msg", `Event "${name}" created successfully.`);
    res.redirect("/events");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to create event. " + err.message);
    res.redirect("/events/create");
  }
};

// ─── Event detail ─────────────────────────────────────────────────────────────
export const showEvent = async (req, res) => {
  try {
    const snap = await getDoc(doc(db, EVENTS, req.params.id));
    if (!snap.exists()) {
      req.flash("error_msg", "Event not found.");
      return res.redirect("/events");
    }
    const event = { id: snap.id, ...snap.data() };

    const [cSnap, crSnap] = await Promise.all([
      getDocs(collection(db, EVENTS, req.params.id, "contestants")),
      getDocs(collection(db, EVENTS, req.params.id, "criteria")),
    ]);
    const contestants = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const criteria    = crSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    res.render("events/show", {
      title:       event.name,
      event,
      contestants,
      criteria,
      ...roleLocals(req),
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Could not load event.");
    res.redirect("/events");
  }
};

// ─── Edit event form ──────────────────────────────────────────────────────────
export const editEventPage = async (req, res) => {
  try {
    const snap = await getDoc(doc(db, EVENTS, req.params.id));
    if (!snap.exists()) return res.redirect("/events");
    const event = { id: snap.id, ...snap.data() };
    res.render("events/edit", {
      title:       `Edit — ${event.name}`,
      event,
      userName:    req.session.userName,
      userRole:    req.session.userRole,
      userInitial: (req.session.userName || "U")[0].toUpperCase(),
      isAdmin:     true,
    });
  } catch (err) {
    req.flash("error_msg", "Could not load event.");
    res.redirect("/events");
  }
};

// ─── Update event ─────────────────────────────────────────────────────────────
export const updateEvent = async (req, res) => {
  const {
    name, description, date, time, venue, type, status,
    organizer, maxContestants, prizes, rules, theme, notes,
    paymentEnabled, ticketPrice, ticketCapacity,
    qrPaymentUrl, paymentAccountName, paymentNumber, ticketsSold,
  } = req.body;

  const isPaymentEnabled = paymentEnabled === "true";
  const parsedTicketPrice    = parseFloat(ticketPrice)    || 0;
  const parsedTicketCapacity = parseInt(ticketCapacity)   || 0;
  const parsedTicketsSold    = parseInt(ticketsSold)      || 0;

  try {
    await updateDoc(doc(db, EVENTS, req.params.id), {
      name, description, date, time, venue, type, status,
      organizer:          organizer          || "",
      maxContestants:     maxContestants     || "",
      prizes:             prizes             || "",
      rules:              rules              || "",
      theme:              theme              || "blue",
      notes:              notes              || "",
      // Payment / ticketing fields
      paymentEnabled:     isPaymentEnabled,
      ticketPrice:        parsedTicketPrice,
      ticketCapacity:     parsedTicketCapacity,
      qrPaymentUrl:       qrPaymentUrl       || "",
      paymentAccountName: paymentAccountName || "",
      paymentNumber:      paymentNumber      || "",
      ticketsSold:        parsedTicketsSold,
    });
    req.flash("success_msg", `Event "${name}" updated successfully.`);
    res.redirect(`/events/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to update event.");
    res.redirect(`/events/${req.params.id}/edit`);
  }
};

// ─── Delete event (cascade deletes subcollections) ───────────────────────────
export const deleteEvent = async (req, res) => {
  const { id } = req.params;
  try {
    // Delete all subcollection docs first (Firestore doesn't auto-cascade)
    const subcollections = ["contestants", "criteria", "scores"];
    for (const sub of subcollections) {
      const snap = await getDocs(collection(db, EVENTS, id, sub));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }
    // Then delete the parent event document
    await deleteDoc(doc(db, EVENTS, id));
    req.flash("success_msg", "Event and all related data deleted.");
    res.redirect("/events");
  } catch (err) {
    console.error("deleteEvent error:", err);
    req.flash("error_msg", "Failed to delete event.");
    res.redirect("/events");
  }
};

// ─── Update event status (Manual Start / End) ───────────────────────────────
export const updateEventStatus = async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  try {
    if (!["upcoming", "ongoing", "completed", "cancelled"].includes(status)) {
      req.flash("error_msg", "Invalid status value.");
      return res.redirect(`/events/${id}`);
    }
    await updateDoc(doc(db, EVENTS, id), { status });
    const statusLabels = {
      ongoing: "started (Ongoing)",
      completed: "manually ended (Completed)",
      upcoming: "reset to Upcoming",
      cancelled: "marked as Cancelled"
    };
    req.flash("success_msg", `Event status updated to ${statusLabels[status] || status}.`);
    res.redirect(`/events/${id}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to update event status.");
    res.redirect(`/events/${id}`);
  }
};
