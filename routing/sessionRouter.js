// routing/sessionRouter.js
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { corePool, guestPools, userPool } from "../db.js";
import { ENV, debugLog, errorLog } from "../config/environment.js";
import mysql from "mysql2/promise";

const router = Router();

/**
 * POST /api/session/guest - Neue Gast-Session starten
 * Erstellt UUID, Datenbank und Todos-Tabelle für Gast
 * @returns {Object} { guestId: string, message: string }
 */
router.post("/guest", async (req, res, next) => {
  try {
    debugLog(`POST /session/guest - Cookies empfangen:`, req.cookies);
    debugLog(`POST /session/guest - Request Origin:`, req.get("Origin"));

    // 1) Guest-ID generieren oder aus Cookie lesen
    let guestId = req.cookies.guestId;
    if (!guestId) {
      guestId = uuidv4();
      debugLog(`Neue Gast-Session erstellt: ${guestId}`);

      const cookieOptions = {
        httpOnly: false, // Für Frontend-Zugriff
        secure: ENV.COOKIE_SECURE, // false in Development, true in Production
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage
        path: "/",
      };

      // SameSite nur in Production setzen (mit secure: true)
      // In Development komplett weglassen - Browser-Default ist meist 'lax'
      if (ENV.COOKIE_SECURE) {
        cookieOptions.sameSite = "lax";
      }

      // Domain nur setzen wenn definiert (Production), in Development weglassen
      if (ENV.COOKIE_DOMAIN) {
        cookieOptions.domain = ENV.COOKIE_DOMAIN;
      }

      debugLog(`Cookie-Optionen:`, cookieOptions);
      res.cookie("guestId", guestId, cookieOptions);
    } else {
      debugLog(`Bestehende Gast-Session gefunden: ${guestId}`);
    } // Sicherstellen: keine User-Session gleichzeitig
    if (req.cookies.userId) {
      res.clearCookie("userId", { domain: ".dev2k.org", path: "/" });
    }

    // 2) Gast-Datenbank erstellen
    const dbName = `todos_guest_${guestId.replace(/-/g, "")}`;
    await corePool.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
    );

    // 3) Connection Pool für Gast-DB einrichten
    if (!guestPools[guestId]) {
      const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 5,
      });

      // Todos-Tabelle initialisieren
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
      guestPools[guestId] = pool;
    }

    req.pool = guestPools[guestId];
    res.json({ guestId, message: "Gast-Session aktiv" });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/session/validate - Aktuelle Session validieren
 * Prüft User- oder Gast-Session und gibt Status zurück
 * @returns {Object} { valid: boolean, type?: string, userId?: number, email?: string, guestId?: string }
 */
router.get("/validate", async (req, res) => {
  try {
    // User-Session prüfen
    if (req.cookies.userId) {
      const [rows] = await userPool.query(
        `SELECT id, email FROM users WHERE id = ?`,
        [req.cookies.userId]
      );
      if (rows.length) {
        return res.json({
          type: "user",
          userId: rows[0].id,
          email: rows[0].email,
          valid: true,
        });
      } else {
        // User nicht gefunden - Cookie löschen
        const clearUserCookieOptions = { path: "/" };
        if (ENV.COOKIE_DOMAIN)
          clearUserCookieOptions.domain = ENV.COOKIE_DOMAIN;
        res.clearCookie("userId", clearUserCookieOptions);
        return res.status(401).json({ error: "User-Session ungültig" });
      }
    }

    // Gast-Session prüfen
    if (req.cookies.guestId) {
      const guestId = req.cookies.guestId;
      const dbName = `todos_guest_${guestId.replace(/-/g, "")}`;

      // Prüfen ob Gast-DB existiert
      const [dbRows] = await corePool.query(`SHOW DATABASES LIKE '${dbName}'`);
      if (dbRows.length) {
        return res.json({
          type: "guest",
          guestId: guestId,
          valid: true,
        });
      } else {
        // Gast-DB nicht gefunden - Cookie löschen
        const clearCookieOptions = { path: "/" };
        if (ENV.COOKIE_DOMAIN) clearCookieOptions.domain = ENV.COOKIE_DOMAIN;
        res.clearCookie("guestId", clearCookieOptions);
        return res.status(401).json({ error: "Gast-Session ungültig" });
      }
    }

    // Keine Session vorhanden
    return res.json({ valid: false, message: "Keine aktive Session" });
  } catch (err) {
    console.error("Session-Validierungsfehler:", err);
    res.status(500).json({ error: "Fehler bei Session-Validierung" });
  }
});

/**
 * POST /api/session/guest/end - Gast-Session beenden
 * Löscht Pool, Datenbank und Cookie
 * ACHTUNG: Alle Gast-Daten gehen verloren!
 */
router.post("/guest/end", async (req, res) => {
  try {
    const guestId = req.cookies.guestId;
    if (!guestId) {
      return res.status(400).json({ error: "Keine Gast-Session aktiv" });
    }

    // Pool schließen falls vorhanden
    if (guestPools[guestId]) {
      await guestPools[guestId].end();
      delete guestPools[guestId];
    }

    // Optional: Gast-Datenbank löschen (nach Bestätigung)
    const dbName = `todos_guest_${guestId.replace(/-/g, "")}`;
    await corePool.query(`DROP DATABASE IF EXISTS \`${dbName}\``);

    // Cookie löschen
    const clearCookieOptions = { path: "/" };
    if (ENV.COOKIE_DOMAIN) clearCookieOptions.domain = ENV.COOKIE_DOMAIN;
    res.clearCookie("guestId", clearCookieOptions);

    res.json({ message: "Gast-Session beendet und Daten gelöscht" });
  } catch (err) {
    console.error("Fehler beim Beenden der Gast-Session:", err);
    res.status(500).json({ error: "Fehler beim Beenden der Gast-Session" });
  }
});

export default router;
