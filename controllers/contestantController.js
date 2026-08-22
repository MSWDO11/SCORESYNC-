import { db } from "../models/firebaseConfig.js";
import {
  collection, addDoc, getDocs, getDoc, doc,
  updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";

// Contestants are sub-collections under events: events/{eventId}/contestants

// ─── Add contestant form ──────────────────────────────────────────────────────
export const addContestantPage = async (req, res) => {
  try {
    const eSnap = await getDoc(doc(db, "events", req.params.eventId));
    if (!eSnap.exists()) return res.redirect("/events");
    res.render("contestants/create", {
      title: "Add Contestant",
      event: { id: eSnap.id, ...eSnap.data() },
      userName: req.session.userName,
      userRole: req.session.userRole,
      userInitial: (req.session.userName || "U")[0].toUpperCase(),
      isAdmin: req.session.userRole === "admin",
    });
  } catch (err) {
    req.flash("error_msg", "Could not load event.");
    res.redirect("/events");
  }
};

// ─── Store contestant ─────────────────────────────────────────────────────────
export const storeContestant = async (req, res) => {
  const { name, number, barangay, age, gender, description } = req.body;
  const { eventId } = req.params;
  try {
    await addDoc(collection(db, "events", eventId, "contestants"), {
      name, number: number || "", barangay: barangay || "",
      age: age || "", gender: gender || "",
      description: description || "",
      createdAt: serverTimestamp(),
    });
    req.flash("success_msg", `Contestant "${name}" added.`);
    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to add contestant.");
    res.redirect(`/events/${eventId}/contestants/add`);
  }
};

// ─── Edit contestant form ─────────────────────────────────────────────────────
export const editContestantPage = async (req, res) => {
  const { eventId, id } = req.params;
  try {
    const [eSnap, cSnap] = await Promise.all([
      getDoc(doc(db, "events", eventId)),
      getDoc(doc(db, "events", eventId, "contestants", id)),
    ]);
    if (!eSnap.exists() || !cSnap.exists()) return res.redirect(`/events/${eventId}`);
    res.render("contestants/edit", {
      title: "Edit Contestant",
      event:      { id: eSnap.id, ...eSnap.data() },
      contestant: { id: cSnap.id, ...cSnap.data() },
      userName: req.session.userName,
      userRole: req.session.userRole,
      userInitial: (req.session.userName || "U")[0].toUpperCase(),
      isAdmin: req.session.userRole === "admin",
    });
  } catch (err) {
    req.flash("error_msg", "Could not load contestant.");
    res.redirect(`/events/${eventId}`);
  }
};

// ─── Update contestant ────────────────────────────────────────────────────────
export const updateContestant = async (req, res) => {
  const { eventId, id } = req.params;
  const { name, number, barangay, age, gender, description } = req.body;
  try {
    await updateDoc(doc(db, "events", eventId, "contestants", id), {
      name, number, barangay, age, gender, description,
    });
    req.flash("success_msg", "Contestant updated.");
    res.redirect(`/events/${eventId}`);
  } catch (err) {
    req.flash("error_msg", "Failed to update contestant.");
    res.redirect(`/events/${eventId}`);
  }
};

// ─── Delete contestant ────────────────────────────────────────────────────────
export const deleteContestant = async (req, res) => {
  const { eventId, id } = req.params;
  try {
    await deleteDoc(doc(db, "events", eventId, "contestants", id));
    req.flash("success_msg", "Contestant removed.");
  } catch (err) {
    req.flash("error_msg", "Failed to remove contestant.");
  }
  res.redirect(`/events/${eventId}`);
};
