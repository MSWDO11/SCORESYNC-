import express from "express";
const router = express.Router();

import { requireAuth, requireRole } from "../middleware/auth.js";

// ─── Public routes ────────────────────────────────────────────────────────────
import { homePage } from "../controllers/homeController.js";
import {
  loginPage, registerPage, forgotPasswordPage,
  loginUser, registerUser, forgotPassword, logoutUser,
  setupPage, setupAdmin, fixRole,
} from "../controllers/authController.js";

router.get( "/",                homePage);
router.get( "/login",           loginPage);
router.post("/login",           loginUser);
router.get( "/register",        registerPage);
router.post("/register",        registerUser);
router.get( "/forgot-password", forgotPasswordPage);
router.post("/forgot-password", forgotPassword);
router.get( "/logout",          logoutUser);

// One-time admin setup (works only when zero users exist)
router.get( "/setup",           setupPage);
router.post("/setup",           setupAdmin);

// Emergency role fixer: /fix-role?email=x@x.com&role=admin
router.get( "/fix-role",        fixRole);

// ─── Session debug (remove after testing) ────────────────────────────────────
router.get("/debug-session", requireAuth, (req, res) => {
  res.json({
    userId:   req.session.userId,
    userName: req.session.userName,
    userRole: req.session.userRole,
  });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
import { dashboardPage } from "../controllers/dashboardController.js";

router.get("/dashboard", requireAuth, dashboardPage);

// ─── Users (admin only) ──────────────────────────────────────────────────────
import {
  listUsers, updateUserRole, deleteUser, approveUser, rejectUser, createUser,
} from "../controllers/userController.js";

router.get(  "/users",                requireAuth, requireRole("admin"), listUsers);
router.post( "/users",                requireAuth, requireRole("admin"), createUser);
router.post( "/users/:id/role",       requireAuth, requireRole("admin"), updateUserRole);
router.post( "/users/:id/approve",    requireAuth, requireRole("admin"), approveUser);
router.post( "/users/:id/reject",     requireAuth, requireRole("admin"), rejectUser);
router.post( "/users/:id/delete",     requireAuth, requireRole("admin"), deleteUser);

// ─── Events (admin only for mutations, all auth for reads) ────────────────────
import {
  listEvents, createEventPage, storeEvent,
  showEvent, editEventPage, updateEvent, deleteEvent, updateEventStatus,
} from "../controllers/eventController.js";

router.get( "/events",                requireAuth,                 listEvents);
router.get( "/events/create",         requireAuth, requireRole("admin"),       createEventPage);
router.post("/events",                requireAuth, requireRole("admin"),       storeEvent);
router.get( "/events/:id",            requireAuth,                 showEvent);
router.get( "/events/:id/edit",       requireAuth, requireRole("admin"),       editEventPage);
router.post("/events/:id/update",     requireAuth, requireRole("admin"),       updateEvent);
router.post("/events/:id/status",     requireAuth, requireRole("admin"),       updateEventStatus);
router.post("/events/:id/delete",     requireAuth, requireRole("admin"),       deleteEvent);

// ─── Contestants (admin & encoder can mutate) ─────────────────────────────────
import {
  addContestantPage, storeContestant,
  editContestantPage, updateContestant, deleteContestant,
} from "../controllers/contestantController.js";

router.get( "/events/:eventId/contestants/add",              requireAuth, requireRole("admin","organizer"), addContestantPage);
router.post("/events/:eventId/contestants",                  requireAuth, requireRole("admin","organizer"), storeContestant);
router.get( "/events/:eventId/contestants/:id/edit",         requireAuth, requireRole("admin","organizer"), editContestantPage);
router.post("/events/:eventId/contestants/:id/update",       requireAuth, requireRole("admin","organizer"), updateContestant);
router.post("/events/:eventId/contestants/:id/delete",       requireAuth, requireRole("admin"),             deleteContestant);

// ─── Criteria (admin only) ────────────────────────────────────────────────────
import {
  addCriteriaPage, storeCriteria, deleteCriteria,
} from "../controllers/criteriaController.js";

router.get( "/events/:eventId/criteria",          requireAuth, requireRole("admin"),       addCriteriaPage);
router.post("/events/:eventId/criteria",          requireAuth, requireRole("admin"),       storeCriteria);
router.post("/events/:eventId/criteria/:id/delete", requireAuth, requireRole("admin"),     deleteCriteria);

// ─── Scoring (judges can enter scores; all auth can view results) ─────────────
import {
  scoringPage, submitScores, resultsPage,
} from "../controllers/scoringController.js";

router.get( "/events/:eventId/scoring",  requireAuth, requireRole("admin","judge"), scoringPage);
router.post("/events/:eventId/scoring",  requireAuth, requireRole("admin","judge"), submitScores);
router.get( "/events/:eventId/results",  requireAuth,                               resultsPage);

// ─── AI Score Analytics (admin only) ──────────────────────────────────────────
import {
  analyticsDashboard, runAIAnalytics, updateFlagStatus, exportAnalyticsCSV,
} from "../controllers/analyticsController.js";

router.get( "/analytics",                     requireAuth, requireRole("admin"), analyticsDashboard);
router.get( "/analytics/export",              requireAuth, requireRole("admin"), exportAnalyticsCSV);
router.post("/analytics/run",                 requireAuth, requireRole("admin"), runAIAnalytics);
router.post("/analytics/flags/:flagId/status",requireAuth, requireRole("admin"), updateFlagStatus);

// ─── Settings ─────────────────────────────────────────────────────────────────
import { settingsPage, updateSettings, suggestFeature } from "../controllers/settingsController.js";

router.get( "/settings",                requireAuth, settingsPage);
router.post("/settings/update",         requireAuth, updateSettings);
router.post("/settings/suggest-feature", requireAuth, suggestFeature);

// ─── Payment Inventory (admin + superadmin) ───────────────────────────────────
import {
  inventoryPage, addPaymentRecord, deletePaymentRecord,
} from "../controllers/inventoryController.js";

router.get( "/inventory",           requireAuth, requireRole("admin","superadmin"), inventoryPage);
router.post("/inventory",           requireAuth, requireRole("admin","superadmin"), addPaymentRecord);
router.post("/inventory/:id/delete",requireAuth, requireRole("admin","superadmin"), deletePaymentRecord);

// ─── Participant join form ────────────────────────────────────────────────────
import { joinEvent } from "../controllers/participantController.js";

router.post("/participant/join", requireAuth, requireRole("participant"), joinEvent);

export default router;
