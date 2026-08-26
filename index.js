import express from "express";
import path from "path";
import session from "express-session";
import flash from "connect-flash";
import router from "./routes/index.js";
import fs from "fs";
import hbs from "hbs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { injectUser } from "./middleware/auth.js";
import { createClient } from "redis";
import connectRedis from "connect-redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Body / Static ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

// ─── Session & Flash ──────────────────────────────────────────────────────────
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  console.error("FATAL: SESSION_SECRET environment variable is not set. Refusing to start in production.");
  process.exit(1);
}

// Use Redis session store in production (required for Vercel serverless)
// Falls back to in-memory store for local development
let sessionStore;
if (process.env.REDIS_URL) {
  try {
    const RedisStore = connectRedis(session);
    const redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: { tls: process.env.REDIS_URL.startsWith("rediss://"), rejectUnauthorized: false },
    });
    redisClient.connect().catch(err => console.error("Redis connect error:", err));
    redisClient.on("error", err => console.error("Redis error:", err));
    sessionStore = new RedisStore({ client: redisClient, prefix: "ss:" });
    console.log("✅ Redis session store connected.");
  } catch (e) {
    console.warn("⚠️  Redis store failed, falling back to memory store:", e.message);
  }
}

app.use(session({
  store:  sessionStore,
  secret: sessionSecret || "scoresync-dev-secret-change-in-prod",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge:   1000 * 60 * 60 * 8, // 8 hours
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
  },
}));
app.use(flash());

// ─── Flash + user data into all views ────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg")[0] || "";
  res.locals.error_msg   = req.flash("error_msg")[0]   || "";
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
