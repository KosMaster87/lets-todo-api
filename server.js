// server.js
import express from "express";
import cors from "cors";

import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";
import mysql from "mysql2/promise";

import { corePool, guestPools } from "./db.js";

const app = express();
const HTTP_PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["https://app-restful-guest-access.dev2k.org"], // <--- neue Frontend-URL
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true, // Cookies und Authentifizierung erlauben
  })
);

// ================================================
// Middleware: Gast-Datenbank auswählen/erstellen
app.use(async (req, res, next) => {
  // 1. Guest-ID aus Cookie oder neu generieren
  let guestId = req.cookies.guestId;
  if (!guestId) {
    guestId = uuidv4();
    res.cookie("guestId", guestId, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      secure: true,
      domain: ".dev2k.org", // <--- bleibt gleich, gilt für alle Subdomains
      path: "/", // <--- WICHTIG: Cookie für alle Pfade
    });
  }

  // 2. Datenbankname ableiten
  const dbName = `notes_guest_${guestId.replace(/-/g, "")}`;

  // 3. Datenbank anlegen (wenn nicht existiert)
  await corePool.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
  );

  // 4. Pool und TODO-Tabelle provisionieren
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

  // 5. Pool in Request injizieren
  req.pool = guestPools[guestId];
  next();
});

// ==================== BASISROUTE ====================
app.get("/api", (req, res) => {
  res.json({ message: "Willkommen bei deiner RESTful API!" });
});

// ==================== CRUD-Routen (nutzen req.pool) ====================
app.get("/api/todos", async (req, res) => {
  try {
    const sql = `SELECT * FROM todos ORDER BY completed ASC, updated DESC`;
    const [rows] = await req.pool.query(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== EINZELNES TODO LADEN ====================
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
 * Noch die Input Validierung machen,
 * z. B. per Middleware (z. B. express-validator)
 * aktuell wird alles ungefiltert in die DB geschrieben.
 *
 * created und updated als BIGINT:
 * Das ist in Ordnung, aber überlege, ob DATETIME oder TIMESTAMP
 * für spätere Auswertungen praktischer wäre. Aktuell verwendest du Unix-Timestamps mit Date.now().
 */

// ==================== TODO ERSTELLEN ====================
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

// ==================== TODO AKTUALISIEREN (PATCH) ====================
app.patch("/api/todos/:id", async (req, res) => {
  const { title, description, completed } = req.body;
  const updates = [],
    params = [];
  if (title !== undefined) {
    updates.push("title = COALESCE(?, title)");
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
  if (!updates.length)
    return res.status(400).json({ error: "Keine Update-Daten" });
  updates.push("updated = ?");
  params.push(Date.now());
  params.push(req.params.id);
  const sql = `UPDATE todos SET ${updates.join(", ")} WHERE id = ?`;
  try {
    const [result] = await req.pool.query(sql, params);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Todo nicht gefunden" });
    res.json({ message: "Todo aktualisiert", changes: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== TODO LÖSCHEN ====================
app.delete("/api/todos/:id", async (req, res) => {
  try {
    const [result] = await req.pool.query(`DELETE FROM todos WHERE id = ?`, [
      req.params.id,
    ]);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Todo nicht gefunden" });
    res.json({
      message: "Todo erfolgreich gelöscht",
      deletedId: req.params.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 404-FEHLERBEHANDLUNG ====================
app.use((req, res) => {
  res.status(404).json({
    message: "Route nicht gefunden",
  });
});

// ==================== SERVER STARTEN ====================
app.listen(HTTP_PORT, "0.0.0.0", () => {
  console.log(`✅ Server läuft auf Port ${HTTP_PORT}`);
});
