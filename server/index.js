/**
 * Axiom TV — API (Express + Neon PostgreSQL + Resend).
 * Toutes les clés sont lues côté serveur (process.env via .env.local).
 * Démarrage :  node server/index.js   (port 8787)
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Resend } = require("resend");

const JWT_SECRET = process.env.JWT_SECRET || "axiomtv_dev_secret_change_me";
const PORT = Number(process.env.PORT || 8787);
const connectionString = (process.env.DATABASE_URL || "").replace(/[&?]channel_binding=[^&]*/g, "");
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 5 });
pool.on("error", (e) => console.error("[db] erreur pool Neon :", e.message));
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  console.log("[db] schéma AxiomTV vérifié sur Neon");
}

const publicUser = (u) => ({
  id: u.id, email: u.email, username: u.username, name: u.name,
  bio: u.bio || "", tier: u.tier, verified: u.verified, avatarUrl: u.avatar_url || null,
});

function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token manquant" });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

const signToken = (u) => jwt.sign({ sub: u.id, email: u.email, name: u.name }, JWT_SECRET, { expiresIn: "7d" });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "citoyen";
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error("[api]", e.message); res.status(500).json({ error: "Erreur interne du serveur" }); });

async function sendWelcomeEmail(to, name) {
  if (!resend) return { sent: false };
  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "AxiomTV <onboarding@axiomtv.app>",
      to,
      subject: "Bienvenue sur AxiomTV — votre antenne est en ligne",
      html: `<div style="background:#0a0e14;padding:40px 24px;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;border:1px solid rgba(0,229,255,.25);border-radius:16px;padding:32px"><p style="margin:0;font-size:20px;font-weight:800;letter-spacing:2px;color:#e8eef7">AXIOM<span style="color:#00e5ff">TV</span></p><h1 style="margin:20px 0 8px;font-size:24px;color:#fff">Bienvenue à bord, ${name} !</h1><p style="margin:0;font-size:14px;line-height:1.7;color:#8b98ab">Votre compte citoyen est actif. Publiez, lancez des directs et monétisez vos créations sans intermédiaire.</p></div></div>`,
    });
    return { sent: !error };
  } catch {
    return { sent: false };
  }
}

/* ================= health ================= */
app.get("/api/health", wrap(async (_req, res) => {
  let db = false;
  try { await pool.query("SELECT 1"); db = true; } catch {}
  res.json({ status: "ok", db, email: !!resend, version: "2.0" });
}));

/* ================= auth ================= */
app.post("/api/auth/register", wrap(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || String(name).trim().length < 2) return res.status(422).json({ error: "Nom requis (2 caractères min.)" });
  if (!EMAIL_RE.test(email || "")) return res.status(422).json({ error: "Adresse email invalide" });
  if (!password || String(password).length < 6) return res.status(422).json({ error: "Mot de passe : 6 caractères minimum" });
  const username = slug(String(name));
  const exists = await pool.query("SELECT id FROM users WHERE email=$1 OR username=$2", [email.toLowerCase(), username]);
  if (exists.rows.length) return res.status(409).json({ error: "Un compte existe déjà avec cet email ou ce nom" });
  const hash = await bcrypt.hash(String(password), 10);
  const ins = await pool.query("INSERT INTO users (email, username, name, password_hash) VALUES ($1,$2,$3,$4) RETURNING *", [email.toLowerCase(), username, String(name).trim(), hash]);
  const user = ins.rows[0];
  await pool.query("INSERT INTO notifications (user_id, type, title, body) VALUES ($1,'welcome',$2,$3),($1,'live','Un nouveau direct est disponible','Rejoignez la communauté dès maintenant.')", [user.id, "Bienvenue sur AxiomTV", `Votre antenne citoyenne est prête, ${user.name}.`]);
  const mail = await sendWelcomeEmail(user.email, user.name);
  res.status(201).json({ token: signToken(user), user: publicUser(user), welcomeEmail: mail.sent });
}));

app.post("/api/auth/login", wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!EMAIL_RE.test(email || "")) return res.status(422).json({ error: "Adresse email invalide" });
  const r = await pool.query("SELECT * FROM users WHERE email=$1", [String(email).toLowerCase()]);
  if (!r.rows.length) return res.status(401).json({ error: "Identifiants incorrects" });
  const user = r.rows[0];
  if (!(await bcrypt.compare(String(password || ""), user.password_hash))) return res.status(401).json({ error: "Identifiants incorrects" });
  res.json({ token: signToken(user), user: publicUser(user) });
}));

app.get("/api/auth/me", requireAuth, wrap(async (req, res) => {
  const r = await pool.query("SELECT * FROM users WHERE id=$1", [req.auth.sub]);
  if (!r.rows.length) return res.status(404).json({ error: "Compte introuvable" });
  res.json({ user: publicUser(r.rows[0]) });
}));

/* ================= profil ================= */
app.patch("/api/profile", requireAuth, wrap(async (req, res) => {
  const { name, bio, aboutText, charter, bannerUrl, avatarUrl } = req.body || {};
  const sets = []; const vals = [];
  const push = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
  if (name !== undefined) push("name", String(name).trim().slice(0, 60));
  if (bio !== undefined) push("bio", String(bio).slice(0, 280));
  if (aboutText !== undefined) push("about_text", String(aboutText).slice(0, 2000));
  if (charter !== undefined) push("charter", String(charter).slice(0, 1000));
  if (bannerUrl !== undefined) push("banner_url", String(bannerUrl) || null);
  if (avatarUrl !== undefined) push("avatar_url", String(avatarUrl) || null);
  if (!sets.length) return res.json({ ok: true });
  vals.push(req.auth.sub);
  const r = await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id=$${vals.length} RETURNING *`, vals);
  res.json({ user: publicUser(r.rows[0]) });
}));

app.get("/api/profile/links", requireAuth, wrap(async (req, res) => {
  const r = await pool.query('SELECT id, platform, label, url FROM creator_links WHERE user_id=$1 ORDER BY created_at LIMIT 12', [req.auth.sub]);
  res.json({ links: r.rows });
}));

app.post("/api/profile/links", requireAuth, wrap(async (req, res) => {
  const { platform, label, url } = req.body || {};
  if (!/^https?:\/\/|mailto:/.test(String(url || ""))) return res.status(422).json({ error: "URL invalide" });
  const r = await pool.query('INSERT INTO creator_links (user_id, platform, label, url) VALUES ($1,$2,$3,$4) RETURNING id', [req.auth.sub, String(platform), String(label || platform).slice(0, 40), String(url).slice(0, 2048)]);
  res.status(201).json({ id: r.rows[0].id });
}));

app.delete("/api/profile/links/:id", requireAuth, wrap(async (req, res) => {
  await pool.query("DELETE FROM creator_links WHERE id=$1 AND user_id=$2", [req.params.id, req.auth.sub]);
  res.json({ ok: true });
}));

/* ================= notifications ================= */
app.get("/api/notifications", requireAuth, wrap(async (req, res) => {
  const r = await pool.query('SELECT id, type, title, body, read, created_at AS "createdAt" FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.auth.sub]);
  res.json({ notifications: r.rows });
}));
app.post("/api/notifications/:id/read", requireAuth, wrap(async (req, res) => {
  await pool.query("UPDATE notifications SET read=TRUE WHERE id=$1 AND user_id=$2", [req.params.id, req.auth.sub]);
  res.json({ ok: true });
}));
app.post("/api/notifications/read-all", requireAuth, wrap(async (req, res) => {
  await pool.query("UPDATE notifications SET read=TRUE WHERE user_id=$1", [req.auth.sub]);
  res.json({ ok: true });
}));

/* ================= créateur public ================= */
app.get("/api/creator/:username", wrap(async (req, res) => {
  const username = String(req.params.username).replace(/^@/, "");
  const r = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
  if (!r.rows.length) return res.status(404).json({ error: "Antenne introuvable" });
  const creator = r.rows[0];
  const links = await pool.query('SELECT id, platform, label, url FROM creator_links WHERE user_id=$1 ORDER BY created_at LIMIT 12', [creator.id]);
  const subs = await pool.query("SELECT COUNT(*)::int AS n FROM subscriptions WHERE creator_username=$1 AND status='active'", [username]);
  const videos = await pool.query('SELECT id, title, category, resolution, status, views, created_at AS "createdAt" FROM agwestream_videos WHERE user_id=$1 ORDER BY created_at DESC LIMIT 60', [creator.id]);
  res.json({
    creator: {
      id: creator.id,
      username: creator.username,
      name: creator.name,
      bio: creator.bio || "",
      tier: creator.tier,
      verified: !!creator.verified,
      avatarUrl: creator.avatar_url || null,
      bannerUrl: creator.banner_url || null,
      aboutText: creator.about_text || "",
      charter: creator.charter || "",
    },
    links: links.rows,
    videos: videos.rows,
    stats: { subscribers: subs.rows[0].n },
  });
}));

/* ================= revenus & paiements ================= */
app.get("/api/earnings", requireAuth, wrap(async (req, res) => {
  const tx = await pool.query('SELECT id, kind, amount, gateway, label, status, created_at AS "createdAt" FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [req.auth.sub]);
  const subs = await pool.query("SELECT COUNT(*)::int AS n FROM subscriptions s JOIN users u ON u.username=s.creator_username WHERE u.id=$1 AND s.status='active'", [req.auth.sub]);
  const rows = tx.rows.map((t) => ({ ...t, amount: Number(t.amount) }));
  const inflow = (k) => rows.filter((t) => t.kind === k && t.status !== "failed").reduce((n, t) => n + t.amount, 0);
  res.json({ totals: { total: inflow("subscription") + inflow("tip") + inflow("ppv") + inflow("gift"), subscribers: subs.rows[0].n }, transactions: rows });
}));

app.get("/api/payment-methods", requireAuth, wrap(async (req, res) => {
  const r = await pool.query('SELECT id, gateway, label, is_default AS "isDefault" FROM payment_methods WHERE user_id=$1 ORDER BY created_at', [req.auth.sub]);
  res.json({ methods: r.rows });
}));

app.post("/api/payment-methods", requireAuth, wrap(async (req, res) => {
  const { gateway, label, config } = req.body || {};
  const first = await pool.query("SELECT COUNT(*)::int AS n FROM payment_methods WHERE user_id=$1", [req.auth.sub]);
  const r = await pool.query("INSERT INTO payment_methods (user_id, gateway, label, config, is_default) VALUES ($1,$2,$3,$4,$5) RETURNING id", [req.auth.sub, String(gateway), String(label).slice(0, 60), JSON.stringify(config || {}), first.rows[0].n === 0]);
  res.status(201).json({ id: r.rows[0].id });
}));

app.delete("/api/payment-methods/:id", requireAuth, wrap(async (req, res) => {
  await pool.query("DELETE FROM payment_methods WHERE id=$1 AND user_id=$2", [req.params.id, req.auth.sub]);
  res.json({ ok: true });
}));

app.post("/api/withdrawals", requireAuth, wrap(async (req, res) => {
  const { amount, methodId } = req.body || {};
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 10) return res.status(422).json({ error: "Retrait minimum : 10,00 $" });
  const m = await pool.query("SELECT * FROM payment_methods WHERE id=$1 AND user_id=$2", [methodId, req.auth.sub]);
  if (!m.rows.length) return res.status(422).json({ error: "Méthode de paiement introuvable" });
  await pool.query("INSERT INTO transactions (user_id, kind, amount, gateway, label, status) VALUES ($1,'withdrawal',$2,$3,$4,'pending')", [req.auth.sub, value, m.rows[0].gateway, `Retrait vers ${m.rows[0].label}`]);
  res.status(201).json({ ok: true });
}));

/* ================= démarrage ================= */
app.use((err, _req, res, _next) => { console.error("[api] exception :", err.message); res.status(500).json({ error: "Erreur interne du serveur" }); });

initDb()
  .then(() => app.listen(PORT, () => console.log(`[api] AxiomTV en ligne → http://localhost:${PORT}`)))
  .catch((e) => {
    console.error("[db] initialisation impossible :", e.message);
    app.listen(PORT, () => console.log(`[api] démarré SANS base (vérifiez DATABASE_URL) → port ${PORT}`));
  });
