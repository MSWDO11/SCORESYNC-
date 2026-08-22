import { db } from "../models/firebaseConfig.js";
import {
  collection, addDoc, getDocs, getDoc, doc,
  setDoc, query, where, serverTimestamp,
} from "firebase/firestore";

// Scores stored at: events/{eventId}/scores/{judgeId_contestantId_criteriaId}

// ─── Judge scoring panel ──────────────────────────────────────────────────────
export const scoringPage = async (req, res) => {
  const { eventId } = req.params;
  const judgeId = req.session.userId;
  try {
    const [eSnap, cSnap, crSnap, sSnap] = await Promise.all([
      getDoc(doc(db, "events", eventId)),
      getDocs(collection(db, "events", eventId, "contestants")),
      getDocs(collection(db, "events", eventId, "criteria")),
      getDocs(collection(db, "events", eventId, "scores")),
    ]);

    if (!eSnap.exists()) return res.redirect("/events");

    const event       = { id: eSnap.id, ...eSnap.data() };
    const contestants = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const criteria    = crSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Build a lookup: judgeId|contestantId|criteriaId -> score
    const scoreMap = {};
    sSnap.docs.forEach(d => {
      const s = d.data();
      if (s.judgeId === judgeId) {
        scoreMap[`${s.contestantId}|${s.criteriaId}`] = s.score;
      }
    });

    // Attach existing scores to criteria per contestant
    const matrix = contestants.map(c => ({
      ...c,
      scores: criteria.map(cr => ({
        criteriaId:   cr.id,
        criteriaName: cr.name,
        weight:       cr.weight,
        maxScore:     cr.maxScore,
        value:        scoreMap[`${c.id}|${cr.id}`] ?? "",
      })),
    }));

    res.render("scoring/judge", {
      title: `Score Entry — ${event.name}`,
      event,
      contestants: matrix,
      criteria,
      userName: req.session.userName,
      userRole: req.session.userRole,
      userInitial: (req.session.userName || "U")[0].toUpperCase(),
      isAdmin: req.session.userRole === "admin",
      isJudge: req.session.userRole === "judge",
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Could not load scoring page.");
    res.redirect("/events");
  }
};

// ─── Submit scores ────────────────────────────────────────────────────────────
export const submitScores = async (req, res) => {
  const { eventId } = req.params;
  const judgeId = req.session.userId;
  // scores[contestantId][criteriaId] = value
  const { scores } = req.body;

  try {
    const writes = [];
    for (const [contestantId, criteriaMap] of Object.entries(scores || {})) {
      for (const [criteriaId, rawScore] of Object.entries(criteriaMap || {})) {
        const score = parseFloat(rawScore);
        if (isNaN(score)) continue;
        const docId = `${judgeId}_${contestantId}_${criteriaId}`;
        writes.push(
          setDoc(doc(db, "events", eventId, "scores", docId), {
            judgeId,
            contestantId,
            criteriaId,
            score,
            submittedAt: serverTimestamp(),
          })
        );
      }
    }
    await Promise.all(writes);
    req.flash("success_msg", "Scores submitted successfully.");
    res.redirect(`/events/${eventId}/scoring`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to save scores.");
    res.redirect(`/events/${eventId}/scoring`);
  }
};

// ─── Results / Leaderboard ────────────────────────────────────────────────────
export const resultsPage = async (req, res) => {
  const { eventId } = req.params;
  try {
    const [eSnap, cSnap, crSnap, sSnap] = await Promise.all([
      getDoc(doc(db, "events", eventId)),
      getDocs(collection(db, "events", eventId, "contestants")),
      getDocs(collection(db, "events", eventId, "criteria")),
      getDocs(collection(db, "events", eventId, "scores")),
    ]);

    if (!eSnap.exists()) return res.redirect("/events");

    const event       = { id: eSnap.id, ...eSnap.data() };
    const contestants = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const criteria    = crSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allScores   = sSnap.docs.map(d => d.data());

    // Count unique judges who submitted
    const judgeSet = new Set(allScores.map(s => s.judgeId));
    const judgeCount = judgeSet.size || 1;

    // For each contestant: weighted average across all judges
    const ranked = contestants.map(c => {
      let totalWeighted = 0;
      const breakdown = criteria.map(cr => {
        const judgeScores = allScores.filter(
          s => s.contestantId === c.id && s.criteriaId === cr.id
        );
        const avg = judgeScores.length
          ? judgeScores.reduce((sum, s) => sum + s.score, 0) / judgeScores.length
          : 0;
        const weighted = (avg / (cr.maxScore || 100)) * (cr.weight || 0);
        totalWeighted += weighted;
        return { name: cr.name, weight: cr.weight, avg: avg.toFixed(2), weighted: weighted.toFixed(2) };
      });
      return {
        ...c,
        breakdown,
        finalScore: totalWeighted.toFixed(4),
        finalScoreDisplay: totalWeighted.toFixed(2),
      };
    });

    // Sort by finalScore descending, assign rank
    ranked.sort((a, b) => b.finalScore - a.finalScore);
    ranked.forEach((c, i) => { c.rank = i + 1; });

    res.render("scoring/results", {
      title: `Results — ${event.name}`,
      event,
      ranked,
      criteria,
      judgeCount,
      userName: req.session.userName,
      userRole: req.session.userRole,
      userInitial: (req.session.userName || "U")[0].toUpperCase(),
      isAdmin: req.session.userRole === "admin",
      isJudge: req.session.userRole === "judge",
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Could not load results.");
    res.redirect(`/events/${eventId}`);
  }
};
