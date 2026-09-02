import { db } from "../models/firebaseConfig.js";
import {
  collection, getDocs, query, where,
} from "firebase/firestore";
import { autoTransitionEventStatus } from "./autoStatusService.js";

// Helper: build income summary from events snapshot
function buildIncomeSummary(evDocs) {
  let totalIncome = 0, totalTicketsSold = 0, paidEventsCount = 0;
  const incomeByEvent = [];
  evDocs.forEach(d => {
    const ev = d.data();
    if (ev.paymentEnabled && ev.ticketPrice > 0) {
      const sold  = parseInt(ev.ticketsSold)  || 0;
      const price = parseFloat(ev.ticketPrice) || 0;
      const income = sold * price;
      totalIncome      += income;
      totalTicketsSold += sold;
      paidEventsCount  += 1;
      incomeByEvent.push({
        id: d.id, name: ev.name || "Unnamed Event",
        type: ev.type || "other", status: ev.status || "upcoming",
        ticketPrice: price, ticketsSold: sold,
        ticketCapacity: parseInt(ev.ticketCapacity) || 0, income,
      });
    }
  });
  incomeByEvent.sort((a, b) => b.income - a.income);
  return { totalIncome: totalIncome.toFixed(2), totalTicketsSold, paidEventsCount, incomeByEvent };
}

export const dashboardPage = async (req, res) => {
  const role = req.session.userRole;

  // Auto-transition runs silently in background — never blocks dashboard load
  autoTransitionEventStatus().catch(e => console.warn("autoStatus:", e.message));

  // Shared base view data
  const base = {
    title:       "Dashboard",
    userName:    req.session.userName,
    userRole:    role,
    userInitial: (req.session.userName || "U")[0].toUpperCase(),
    isSuperAdmin:  false,
    isAdmin:       role === "admin",
    isOrganizer:   role === "organizer",
    isJudge:       role === "judge",
    isParticipant: role === "participant",
    isEncoder:     role === "organizer",
  };

  try {

    // ── ADMIN ─ full access including completed events history ────────────────
    if (role === "admin") {
      const [evSnap, uSnap] = await Promise.all([
        getDocs(collection(db, "events")),
        getDocs(collection(db, "users")),
      ]);

      const allEvents = evSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      const activeEvents    = allEvents.filter(e => ["upcoming","ongoing"].includes(e.status));
      const completedEvents = allEvents.filter(e => e.status === "completed");
      const recentEvents    = allEvents.slice(0, 5);

      const allUsers = uSnap.docs.map(d => {
        const data = d.data();
        const emailSubject = encodeURIComponent("ScoreSync Account Approved!");
        const emailBody    = encodeURIComponent(`Hi ${data.name || 'User'},\n\nYour ScoreSync account has been APPROVED.\n\nBest regards,\nScoreSync Admin`);
        const gmailUrl     = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(data.email)}&su=${emailSubject}&body=${emailBody}`;
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("en-PH") || "—", gmailUrl };
      });

      const pendingUsers = allUsers.filter(u => u.status === "pending");
      const income = buildIncomeSummary(evSnap.docs);

      return res.render("dashboard/admin", {
        ...base,
        recentEvents,
        activeEvents,
        completedEvents,
        totalEvents:  allEvents.length,
        totalUsers:   allUsers.filter(u => u.status !== "pending").length,
        pendingUsers,
        pendingCount: pendingUsers.length,
        ...income,
      });
    }

    // ── ORGANIZER ─ upcoming + ongoing events only ────────────────────────────
    if (role === "organizer") {
      const evSnap = await getDocs(collection(db, "events"));
      const activeEvents = evSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => ["upcoming","ongoing"].includes(e.status))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      const ongoingCount = activeEvents.filter(e => e.status === "ongoing").length;

      return res.render("dashboard/organizer", {
        ...base,
        activeEvents,
        recentEvents: activeEvents.slice(0, 5),
        totalActive:  activeEvents.length,
        ongoingCount,
      });
    }

    // ── JUDGE ─ gets all events, sorted in JS ─────────────────────────────────
    if (role === "judge") {
      const snap = await getDocs(collection(db, "events"));
      const recentEvents = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 10);
      return res.render("dashboard/judge", { ...base, recentEvents });
    }

    // ── PARTICIPANT ─ active events only (upcoming + ongoing) for join form ────
    if (role === "participant") {
      const evSnap = await getDocs(collection(db, "events"));
      const activeEvents = evSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => ["upcoming","ongoing"].includes(e.status))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      return res.render("dashboard/participant", { ...base, activeEvents });
    }

    // Fallback
    res.redirect("/login");

  } catch (err) {
    console.error("Dashboard error:", err);
    req.flash("error_msg", "Could not load dashboard data: " + err.message);
    res.render("dashboard/admin", {
      ...base,
      recentEvents: [], activeEvents: [], completedEvents: [],
      totalEvents: 0, totalUsers: 0,
      pendingUsers: [], pendingCount: 0,
      totalIncome: "0.00", totalTicketsSold: 0, paidEventsCount: 0, incomeByEvent: [],
    });
  }
};
