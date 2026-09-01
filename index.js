import express from "express";
import path from "path";
import cookieSession from "cookie-session";
import router from "./routes/index.js";
import fs from "fs";
import hbs from "hbs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { injectUser } from "./middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

// Trust Vercel's reverse proxy so secure cookies work
app.set("trust proxy", 1);

// ─── Body / Static ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

// ─── Session (cookie-based — works on Vercel serverless) ─────────────────────
const sessionSecret = process.env.SESSION_SECRET || "scoresync-dev-secret-change-in-prod";

app.use(cookieSession({
  name:     "ss",          // shorter name saves bytes
  keys:     [sessionSecret],
  maxAge:   1000 * 60 * 60 * 8, // 8 hours
  secure:   false,
  sameSite: "lax",
  httpOnly: true,
  // Keep cookie small — only store uid, name, role
  signed:   true,
}));

// ─── Manual flash middleware (cookie-session safe — no session bloat) ──────────
app.use((req, res, next) => {
  // Read flash from URL query params (set by redirect) then expose to views
  res.locals.success_msg = req.query._s ? decodeURIComponent(req.query._s) : (req.session._flash_success || "");
  res.locals.error_msg   = req.query._e ? decodeURIComponent(req.query._e) : (req.session._flash_error   || "");

  // Clear session flash after reading
  if (req.session._flash_success) req.session._flash_success = "";
  if (req.session._flash_error)   req.session._flash_error   = "";

  // req.flash() shim — stores in session (for same-origin redirects without query params)
  req.flash = (type, msg) => {
    if (msg === undefined) return [];
    if (type === "success_msg") req.session._flash_success = msg;
    if (type === "error_msg")   req.session._flash_error   = msg;
  };

  // Helper to redirect with flash as query param (avoids cookie size limit)
  req.flashRedirect = (type, msg, url) => {
    const key = type === "success_msg" ? "_s" : "_e";
    const sep = url.includes("?") ? "&" : "?";
    res.redirect(`${url}${sep}${key}=${encodeURIComponent(msg)}`);
  };

  next();
});
app.use(injectUser);

// ─── Handlebars helpers ───────────────────────────────────────────────────────
hbs.registerHelper("eq",  (a, b) => a === b);
hbs.registerHelper("gt",  (a, b) => Number(a) > Number(b));
hbs.registerHelper("gte", (a, b) => Number(a) >= Number(b));
hbs.registerHelper("lt",  (a, b) => Number(a) < Number(b));
hbs.registerHelper("lte", (a, b) => Number(a) <= Number(b));
hbs.registerHelper("not", (a)    => !a);

// ─── .xian engine (wraps hbs) ────────────────────────────────────────────────
app.engine("xian", (filePath, options, callback) => {
  const originalPartialsDir = hbs.partialsDir;
  hbs.partialsDir = path.join(__dirname, "views");

  hbs.__express(filePath, options, (err, html) => {
    hbs.partialsDir = originalPartialsDir;
    if (err) {
      console.error("Template rendering error on file:", filePath, err);
      return callback(err);
    }
    callback(null, html);
  });
});

app.set("views",       path.join(__dirname, "views"));
app.set("view engine", "xian");

// ─── Auto-register all partials recursively ───────────────────────────────────
function registerPartials(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      registerPartials(fullPath);
    } else if (file.endsWith(".xian")) {
      const name    = file.replace(".xian", "");
      const content = fs.readFileSync(fullPath, "utf8");
      hbs.registerPartial(name, content);
    }
  });
}
registerPartials(path.join(__dirname, "views", "partials"));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/", router);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).send(`
    <div style="font-family:sans-serif;text-align:center;padding:80px">
      <h1 style="font-size:4rem;color:#1e3a5f">404</h1>
      <p>Page not found.</p>
      <a href="/" style="color:#2563eb">Go Home</a>
    </div>
  `);
});

export default app;

if (!process.env.ELECTRON) {
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`🏆 ScoreSync running at http://0.0.0.0:${PORT}`)
  );
}
