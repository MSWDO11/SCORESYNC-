import { db } from "../models/firebaseConfig.js";
import {
  collection, getDocs, getDoc, addDoc, deleteDoc,
  doc, query, serverTimestamp, where,
} from "firebase/firestore";

const EVENTS = "events";
const PAYMENTS = "payment_records";

// ─── List all payment records (optionally filtered by event) ──────────────────
export const inventoryPage = async (req, res) => {
  try {
    const filterEventId = req.query.event || null;

    // Load all ticketed events for the filter dropdown
    const evSnap = await getDocs(collection(db, EVENTS));
    const allEvents = evSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.paymentEnabled)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // Load payment records — sort in JS to avoid Firestore index requirement
    const paySnap = await getDocs(collection(db, PAYMENTS));
    let records = paySnap.docs.map(d => {
      const data = d.data();
      return {
        id:          d.id,
        eventId:     data.eventId     || "",
        eventName:   data.eventName   || "Unknown Event",
        payerName:   data.payerName   || "—",
        quantity:    parseInt(data.quantity)    || 1,
        unitPrice:   parseFloat(data.unitPrice) || 0,
        total:       parseFloat(data.total)     || 0,
        method:      data.method      || "Cash",
        reference:   data.reference   || "—",
        notes:       data.notes       || "",
        status:      data.status      || "Confirmed",
        recordedBy:  data.recordedBy  || "Admin",
        createdAt:   data.createdAt?.toDate?.()?.toLocaleString("en-PH") || "—",
        _sec:        data.createdAt?.seconds || 0,
      };
    }).sort((a, b) => b._sec - a._sec);

    // Apply event filter
    if (filterEventId) {
      records = records.filter(r => r.eventId === filterEventId);
    }

    // Summary totals
    const totalRevenue    = records.reduce((s, r) => s + r.total, 0);
    const totalTickets    = records.reduce((s, r) => s + r.quantity, 0);
    const confirmedCount  = records.filter(r => r.status === "Confirmed").length;
    const pendingCount    = records.filter(r => r.status === "Pending").length;

    // Per-event summary
    const eventSummaryMap = {};
    records.forEach(r => {
      if (!eventSummaryMap[r.eventId]) {
        eventSummaryMap[r.eventId] = {
          eventId:   r.eventId,
          eventName: r.eventName,
          revenue:   0,
          tickets:   0,
          count:     0,
        };
      }
      eventSummaryMap[r.eventId].revenue += r.total;
      eventSummaryMap[r.eventId].tickets += r.quantity;
      eventSummaryMap[r.eventId].count   += 1;
    });
    const eventSummary = Object.values(eventSummaryMap)
      .sort((a, b) => b.revenue - a.revenue);

    res.render("inventory/index", {
      title:        "Payment Inventory",
      userName:     req.session.userName,
      userRole:     req.session.userRole,
      userInitial:  (req.session.userName || "U")[0].toUpperCase(),
      isAdmin:      req.session.userRole === "admin",
      isJudge:      req.session.userRole === "judge",
      isEncoder:    req.session.userRole === "encoder",
      records,
      allEvents,
      filterEventId,
      totalRevenue:   totalRevenue.toFixed(2),
      totalTickets,
      confirmedCount,
      pendingCount,
      recordCount:    records.length,
      eventSummary,
    });
  } catch (err) {
    console.error("Inventory page error:", err);
    req.flash("error_msg", "Failed to load inventory.");
    res.redirect("/dashboard");
  }
};

// ─── Add a payment record ─────────────────────────────────────────────────────
export const addPaymentRecord = async (req, res) => {
  try {
    const {
      eventId, payerName, quantity, unitPrice,
      method, reference, notes, status,
    } = req.body;

    if (!eventId) {
      req.flash("error_msg", "Please select an event.");
      return res.redirect("/inventory");
    }

    // Get event name
    const evDoc = await getDoc(doc(db, EVENTS, eventId));
    const eventName = evDoc.exists() ? (evDoc.data().name || "Unknown Event") : "Unknown Event";

    const qty   = parseInt(quantity)    || 1;
    const price = parseFloat(unitPrice) || 0;
    const total = qty * price;

    await addDoc(collection(db, PAYMENTS), {
      eventId,
      eventName,
      payerName:  (payerName  || "").trim() || "Walk-in",
      quantity:   qty,
      unitPrice:  price,
      total,
      method:     method    || "Cash",
      reference:  (reference || "").trim() || "—",
      notes:      (notes     || "").trim(),
      status:     status    || "Confirmed",
      recordedBy: req.session.userName || "Admin",
      createdAt:  serverTimestamp(),
    });

    req.flash("success_msg", `Payment record added — ₱${total.toFixed(2)} from ${payerName || "Walk-in"}.`);
    res.redirect("/inventory" + (eventId ? `?event=${eventId}` : ""));
  } catch (err) {
    console.error("Add payment record error:", err);
    req.flash("error_msg", "Failed to add payment record.");
    res.redirect("/inventory");
  }
};

// ─── Delete a payment record ──────────────────────────────────────────────────
export const deletePaymentRecord = async (req, res) => {
  try {
    await deleteDoc(doc(db, PAYMENTS, req.params.id));
    req.flash("success_msg", "Payment record deleted.");
    res.redirect(req.headers.referer || "/inventory");
  } catch (err) {
    console.error("Delete payment record error:", err);
    req.flash("error_msg", "Failed to delete record.");
    res.redirect("/inventory");
  }
};
