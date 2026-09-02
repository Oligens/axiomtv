import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = (process.env.DATABASE_URL || "").replace(/[&?]channel_binding=[^&]*/g, "");
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 2 });
  }
  return pool;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const rawBody = await readRawBody(req);
  const signature = String(req.headers["zakapro-signature"] || "");
  const secret = process.env.ZAKAPRO_APP_SECRET || "";
  if (!secret) return res.status(500).json({ error: "ZAKAPRO_APP_SECRET non configuré" });

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return res.status(401).send("Signature invalide");

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "JSON invalide" });
  }

  if (!["payment.confirmed", "subscription.activated"].includes(event.event)) {
    return res.status(200).json({ received: true, ignored: true });
  }

  const reference = String(event.reference || event.transaction?.reference || "").trim();
  const customerEmail = String(event.customer?.email || event.customer?.mail || "").trim().toLowerCase();
  const amount = Number(event.amount || 0);
  const method = String(event.method || "zakapro");
  const plan = String(event.meta?.plan || event.metadata?.plan || "").trim().toUpperCase();

  if (!reference || !customerEmail) return res.status(422).json({ error: "Référence ou email client manquant" });
  if (amount !== 70 || !["ACTIVER AGWE STREAM", "AGWE STREAM"].includes(plan)) {
    return res.status(422).json({ error: "Commande ZakaPro non reconnue" });
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const userResult = await client.query("SELECT id, tier FROM users WHERE lower(email) = lower($1) LIMIT 1", [customerEmail]);
    if (!userResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Utilisateur AxiomTV introuvable" });
    }

    const user = userResult.rows[0];
    const duplicate = await client.query(
      "SELECT id FROM transactions WHERE user_id = $1 AND label = $2 LIMIT 1",
      [user.id, `ZakaPro:${reference}`]
    );

    if (!duplicate.rowCount) {
      await client.query(
        "INSERT INTO transactions (user_id, kind, amount, gateway, label, status) VALUES ($1, 'subscription', $2, $3, $4, 'completed')",
        [user.id, amount, method, `ZakaPro:${reference}`]
      );

      if (!["pro", "gold"].includes(user.tier)) {
        await client.query("UPDATE users SET tier = 'agwestream_pass' WHERE id = $1", [user.id]);
      }

      await client.query(
        "INSERT INTO notifications (user_id, type, title, body) VALUES ($1, 'info', $2, $3)",
        [user.id, "AgwèStream activé", `Paiement ZakaPro confirmé (${amount} HTG · ${method}). Votre Pass AgwèStream est actif.`]
      );
    }

    await client.query("COMMIT");
    return res.status(200).json({ received: true, activated: true, reference });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[ZakaPro webhook]", error);
    return res.status(500).json({ error: "Erreur interne" });
  } finally {
    client.release();
  }
}
