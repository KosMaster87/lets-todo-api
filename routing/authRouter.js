/**
 * Authentifizierungs-Router
 * Verwaltet User-Registrierung, Login und Logout
 * Jeder User erhält eine     // Eventuelle Gast-Session löschen
    if (req.cookies.guestId) {
      const clearCookieOptions = { path: "/" };
      if (ENV.COOKIE_DOMAIN) clearCookieOptions.domain = ENV.COOKIE_DOMAIN;
      res.clearCookie("guestId", clearCookieOptions);
    }

    // Session-Cookie setzen
    const cookieOptions = {
      httpOnly: false, // Für Frontend-Zugriff
      secure: ENV.COOKIE_SECURE, // false in Development, true in Production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage
      path: "/",
    };
    
    // SameSite nur in Production setzen (mit secure: true)
    if (ENV.COOKIE_SECURE) {
      cookieOptions.sameSite = "lax";
    }
    
    // Domain nur setzen wenn definiert (Production), in Development weglassen
    if (ENV.COOKIE_DOMAIN) {
      cookieOptions.domain = ENV.COOKIE_DOMAIN;
    }
    
    res.cookie("userId", user.id, cookieOptions);nk
 */

// routing/authRouter.js
import { Router } from "express";
import bcrypt from "bcrypt";
import { userPool, corePool, userPools } from "../db.js";
import { ENV, debugLog, errorLog } from "../config/environment.js";
import mysql from "mysql2/promise";

const router = Router();

/**
 * POST /api/register - Neuen User registrieren
 * Erstellt automatisch eine eigene Datenbank für den User
 * @param {Object} req.body - Registrierungsdaten
 * @param {string} req.body.email - E-Mail-Adresse
 * @param {string} req.body.password - Passwort (wird gehasht)
 */
router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email und Passwort erforderlich" });

  // Passwort hashen für sichere Speicherung
  const password_hash = await bcrypt.hash(password, 10);

  // Eindeutiger DB-Name basierend auf E-Mail
  const dbName = `notes_user_${Buffer.from(email)
    .toString("hex")
    .slice(0, 24)}`;
  const created = Date.now();

  try {
    // 1) User in zentrale User-Tabelle eintragen
    const [result] = await userPool.query(
      `INSERT INTO users (email, password_hash, db_name, created)
       VALUES (?, ?, ?, ?)`,
      [email, password_hash, dbName, created]
    );

    const userId = result.insertId;

    // 2) Dedicated User-Datenbank erstellen
    await corePool.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
    );

    // 3) Todos-Tabelle in User-DB initialisieren UND Pool speichern
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 5,
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created BIGINT,
        updated BIGINT,
        completed TINYINT
      );
    `);

    // WICHTIG: Pool für zukünftige Requests speichern
    userPools[`user_${userId}`] = pool;

    res.status(201).json({ message: "User registriert" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Email bereits registriert" });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/login - User einloggen
 * Setzt httpOnly Cookie für Session-Management
 * @param {Object} req.body - Login-Daten
 * @param {string} req.body.email - E-Mail-Adresse
 * @param {string} req.body.password - Passwort
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email und Passwort erforderlich" });

  try {
    const [rows] = await userPool.query(`SELECT * FROM users WHERE email = ?`, [
      email,
    ]);
    if (!rows.length)
      return res.status(401).json({ error: "Ungültige Zugangsdaten" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: "Ungültige Zugangsdaten" });

    // Eventuelle Gast-Session löschen
    if (req.cookies.guestId) {
      const clearCookieOptions = { path: "/" };
      if (ENV.COOKIE_DOMAIN) clearCookieOptions.domain = ENV.COOKIE_DOMAIN;
      res.clearCookie("guestId", clearCookieOptions);
    }

    // Session-Cookie setzen
    const cookieOptions = {
      httpOnly: false, // Für Frontend-Zugriff
      secure: ENV.COOKIE_SECURE, // false in Development, true in Production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage
      path: "/",
    };

    // SameSite nur in Production setzen (mit secure: true)
    if (ENV.COOKIE_SECURE) {
      cookieOptions.sameSite = "lax";
    }

    // Domain nur setzen wenn definiert (Production), in Development weglassen
    if (ENV.COOKIE_DOMAIN) {
      cookieOptions.domain = ENV.COOKIE_DOMAIN;
    }

    debugLog(`User-Login Cookie-Optionen:`, cookieOptions);
    res.cookie("userId", user.id, cookieOptions);

    res.json({ message: "Login erfolgreich", userId: user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/logout - User ausloggen
 * Löscht das userId Cookie
 */
router.post("/logout", (req, res) => {
  const clearCookieOptions = { path: "/" };
  if (ENV.COOKIE_DOMAIN) clearCookieOptions.domain = ENV.COOKIE_DOMAIN;
  res.clearCookie("userId", clearCookieOptions);
  // guestId NICHT automatisch setzen!
  res.json({ message: "Logout erfolgreich" });
});

export default router;
