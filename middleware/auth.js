// Middleware: require a logged-in session
export const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    req.flash("error_msg", "Please log in to continue.");
    return res.redirect("/login");
  }
  next();
};

// Middleware: restrict to specific roles
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.session.userId) {
    req.flash("error_msg", "Please log in to continue.");
    return res.redirect("/login");
  }
  if (!roles.includes(req.session.userRole)) {
    return res.status(403).render("403", {
      title: "Access Denied",
      userName: req.session.userName,
      userRole: req.session.userRole,
      userInitial: (req.session.userName || "U")[0].toUpperCase(),
    });
  }
  next();
};

// Inject session user data into all view locals
export const injectUser = (req, res, next) => {
  const role = req.session.userRole || "";
  res.locals.userName        = req.session.userName || "";
  res.locals.userRole        = role;
  res.locals.userInitial     = (req.session.userName || "U")[0].toUpperCase();
  res.locals.isSuperAdmin    = role === "superadmin";
  res.locals.isAdmin         = role === "admin" || role === "superadmin"; // superadmin inherits admin powers
  res.locals.isOrganizer     = role === "organizer";
  res.locals.isJudge         = role === "judge";
  res.locals.isParticipant   = role === "participant";
  // legacy compat
  res.locals.isEncoder       = role === "organizer";
  next();
};
