/**
 * Express-Server für Todo-App mit User- und Gast-Session-Management
 * Features:
 * - Separate Datenbank pro User/Gast
 * - Cookie-basierte Authentifizierung
 * - RESTful Todo-API
 */

// server.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { corePool, guestPools, userPool, userPools } from "./db.js";
import authRouter from "./routing/authRouter.js";
import sessionRouter from "./routing/sessionRouter.js";
import mysql from "mysql2/promise";

const app = express();
const HTTP_PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["https://app-restful-notes-user-session.dev2k.org"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// User-Tabelle einmalig anlegen
(async () => {
  await userPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      db_name VARCHAR(255) NOT NULL,
      created BIGINT
    );`);
})();

// Session-Router (Gast) und Auth-Router (Registrierung/Login/Logout)
app.use("/api/session", sessionRouter);
app.use("/api", authRouter);

/**
 * Middleware: Pool-Auswahl basierend auf Session-Typ
 * Priorisiert User-Session vor Gast-Session
 * Setzt req.pool für nachfolgende Route-Handler
 * @param {Request} req - Express Request Object
 * @param {Response} res - Express Response Object
 * @param {Function} next - Next Middleware Function
 */
app.use(async (req, res, next) => {
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
          const mysql = (await import("mysql2/promise")).default;
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
      return app._router.handle(req, res, next);
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
    console.error("Middleware-Fehler:", err);
    res.status(500).json({ error: "Server-Fehler bei Session-Prüfung" });
  }
});

/**
 * Middleware: Database Pool Assignment
 * Weist jedem Request den korrekten DB-Pool zu (User oder Gast)
 */
app.use(async (req, res, next) => {
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
      const dbName = `notes_guest_${guestId.replace(/-/g, "")}`;
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
    console.error("Pool-Assignment Fehler:", err);
    next();
  }
});

/**
 * GET /api/todos - Alle Todos des aktuellen Users/Gasts abrufen
 * Sortierung: Unerledigte zuerst, dann nach Update-Zeit
 */
app.get("/api/todos", async (req, res) => {
  try {
    const [rows] = await req.pool.query(
      `SELECT * FROM todos ORDER BY completed ASC, updated DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/todos/:id - Einzelnes Todo abrufen
 * @param {string} req.params.id - Todo-ID
 */
app.get("/api/todos/:id", async (req, res) => {
  try {
    const [rows] = await req.pool.query(`SELECT * FROM todos WHERE id = ?`, [
      req.params.id,
    ]);
    if (!rows.length)
      return res.status(404).json({ message: "Todo nicht gefunden" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/todos - Neues Todo erstellen
 * @param {Object} req.body - Todo-Daten
 * @param {string} req.body.title - Todo-Titel (erforderlich)
 * @param {string} [req.body.description] - Todo-Beschreibung
 * @param {number} [req.body.completed] - Erledigt-Status (0/1)
 */
app.post("/api/todos", async (req, res) => {
  const { title, description = "", completed = 0 } = req.body;
  const timestamp = Date.now();
  try {
    const [result] = await req.pool.query(
      `INSERT INTO todos (title, description, created, updated, completed) VALUES (?, ?, ?, ?, ?)`,
      [title, description, timestamp, timestamp, completed]
    );
    res.status(201).json({
      id: result.insertId,
      title,
      description,
      created: timestamp,
      updated: timestamp,
      completed,
      message: "Todo erfolgreich erstellt",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/todos/:id - Todo teilweise aktualisieren
 * Unterstützt partielle Updates mit COALESCE-Strategie
 *
 * @example
 * PATCH /api/todos/5
 * { "title": "Neuer Titel" }  → Nur Titel wird geändert
 *
 * @example
 * PATCH /api/todos/5
 * { "completed": 1 }          → Nur Status wird geändert
 *
 * @param {string} req.params.id - Todo-ID
 * @param {Object} req.body - Update-Daten (title, description, completed)
 */
app.patch("/api/todos/:id", async (req, res) => {
  const { title, description, completed } = req.body;

  // Dynamischer SQL-Builder für partielle Updates
  const updates = []; // ["title = COALESCE(?, title)", ...]
  const params = []; // ["Neuer Titel", ...]

  // Nur vorhandene Felder in Update einbeziehen
  if (title !== undefined) {
    updates.push("title = COALESCE(?, title)"); // SQL-Fragment
    params.push(title);
  }
  if (description !== undefined) {
    updates.push("description = COALESCE(?, description)");
    params.push(description);
  }
  if (completed !== undefined) {
    updates.push("completed = COALESCE(?, completed)");
    params.push(completed);
  }

  // Mindestens ein Feld muss für Update vorhanden sein
  if (!updates.length)
    return res.status(400).json({ error: "Keine Update-Daten" });

  // Timestamp immer aktualisieren
  updates.push("updated = ?");
  params.push(Date.now());

  // Todo-ID als letzten Parameter hinzufügen
  params.push(req.params.id);

  // SQL-Query dynamisch zusammenbauen
  const sql = `UPDATE todos SET ${updates.join(", ")} WHERE id = ?`;

  try {
    const [result] = await req.pool.query(sql, params);

    // Prüfen ob Todo existierte
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Todo nicht gefunden" });

    res.json({
      message: "Todo aktualisiert",
      changes: result.affectedRows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/todos/:id - Todo löschen
 * @param {string} req.params.id - Todo-ID
 */
app.delete("/api/todos/:id", async (req, res) => {
  try {
    const [result] = await req.pool.query(`DELETE FROM todos WHERE id = ?`, [
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Todo nicht gefunden" });
    }
    res.json({
      message: "Todo erfolgreich gelöscht",
      deletedId: req.params.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 404-Fallback für unbekannte Routen
 */
app.use((req, res) => {
  res.status(404).json({ message: "Route nicht gefunden" });
});

/**
 * Server starten und auf eingehende Verbindungen hören
 * Bindet an alle verfügbaren Netzwerk-Interfaces (0.0.0.0)
 */
app.listen(HTTP_PORT, "0.0.0.0", () => {
  console.log(`✅ Server läuft auf Port ${HTTP_PORT}`);
});
