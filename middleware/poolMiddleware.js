/**
 * Database Pool Assignment Middleware
 * Weist jedem Request den korrekten DB-Pool zu (User oder Gast)
 */

import mysql from "mysql2/promise";
import { corePool, guestPools, userPool, userPools } from "../db.js";

/**
 * Middleware: Pool-Auswahl basierend auf Session-Typ
 * Priorisiert User-Session vor Gast-Session
 * Setzt req.pool für nachfolgende Route-Handler
 * @param {Request} req - Express Request Object
 * @param {Response} res - Express Response Object
 * @param {Function} next - Next Middleware Function
 */
export async function assignPoolMiddleware(req, res, next) {
  try {
    // STRIKTE TRENNUNG: User-Session hat Vorrang und schließt Gast aus
    if (req.cookies.userId && !req.cookies.guestId) {
      // 1. User-Session: Pool für User-DB bereitstellen
      const [rows] = await userPool.query(
        `SELECT db_name FROM users WHERE id = ?`,
        [req.cookies.userId]
      );
      if (rows.length) {
        const dbName = rows[0].db_name;
        const userPoolKey = `user_${req.cookies.userId}`;

        // Pool cachen für Performance
        if (!guestPools[userPoolKey]) {
          guestPools[userPoolKey] = mysql.createPool({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: dbName,
            waitForConnections: true,
            connectionLimit: 5,
          });
        }
        req.pool = guestPools[userPoolKey];
        return next();
      }
      // User nicht in DB gefunden → Cookie ungültig
      res.clearCookie("userId", { domain: ".dev2k.org", path: "/" });
      return res.status(401).json({ error: "User-Session ungültig" });
    }

    // 2. Konflikt: Beide Cookies vorhanden → Gast löschen
    if (req.cookies.userId && req.cookies.guestId) {
      res.clearCookie("guestId", { domain: ".dev2k.org", path: "/" });
      console.warn("⚠️ Beide Cookies vorhanden - Gast-Cookie gelöscht");
      return assignPoolMiddleware(req, res, next);
    }

    // 3. Gast-Session: Pool für Gast-DB bereitstellen
    if (req.cookies.guestId && !req.cookies.userId) {
      const guestId = req.cookies.guestId;
      if (guestPools[guestId]) {
        req.pool = guestPools[guestId];
        return next();
      }
      // Gast-Pool existiert nicht → Session ungültig
      res.clearCookie("guestId", { domain: ".dev2k.org", path: "/" });
      return res.status(401).json({ error: "Gast-Session ungültig" });
    }

    // 4. Keine Session: Authentifizierung erforderlich
    return res.status(401).json({
      error:
        "Keine Session initialisiert. Bitte als Gast starten oder einloggen.",
    });
  } catch (err) {
    console.error("Pool-Assignment-Middleware-Fehler:", err);
    res.status(500).json({ error: "Server-Fehler bei Session-Prüfung" });
  }
}

/**
 * Erweiterte Pool-Zuweisung mit Fallback-Rekonstruktion
 * Rekonstruiert fehlende Pools aus der Datenbank
 */
export async function enhancedPoolMiddleware(req, res, next) {
  try {
    // 1) User-Session prüfen (hat Vorrang)
    if (req.cookies.userId) {
      const userId = req.cookies.userId;
      const poolKey = `user_${userId}`;

      if (userPools[poolKey]) {
        req.pool = userPools[poolKey];
        return next();
      }

      // Pool nicht vorhanden - aus DB rekonstruieren
      const [userRows] = await userPool.query(
        `SELECT db_name FROM users WHERE id = ?`,
        [userId]
      );

      if (userRows.length) {
        const dbName = userRows[0].db_name;
        const pool = mysql.createPool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: dbName,
          waitForConnections: true,
          connectionLimit: 5,
        });

        userPools[poolKey] = pool;
        req.pool = pool;
        return next();
      }

      // User nicht gefunden - Cookie löschen
      res.clearCookie("userId", { domain: ".dev2k.org", path: "/" });
    }

    // 2) Gast-Session prüfen
    if (req.cookies.guestId) {
      const guestId = req.cookies.guestId;

      if (guestPools[guestId]) {
        req.pool = guestPools[guestId];
        return next();
      }

      // Gast-Pool rekonstruieren
      const dbName = `todos_guest_${guestId.replace(/-/g, "")}`;
      const [dbRows] = await corePool.query(`SHOW DATABASES LIKE '${dbName}'`);

      if (dbRows.length) {
        const pool = mysql.createPool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: dbName,
          waitForConnections: true,
          connectionLimit: 5,
        });

        guestPools[guestId] = pool;
        req.pool = pool;
        return next();
      }

      // Gast-DB nicht gefunden - Cookie löschen
      res.clearCookie("guestId", { domain: ".dev2k.org", path: "/" });
    }

    // 3) Keine gültige Session - Request ohne Pool fortsetzen
    next();
  } catch (err) {
    console.error("Enhanced-Pool-Assignment Fehler:", err);
    next();
  }
}
