// server.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { corePool, guestPools, userPool } from "./db.js";
import authRouter from "./routing/authRouter.js";
import sessionRouter from "./routing/sessionRouter.js";

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

// Middleware: Pool-Auswahl (User-Session oder Gast-Session)
app.use(async (req, res, next) => {
  // 1. User-Session prüfen
  if (req.cookies.userId) {
    const [rows] = await userPool.query(
      `SELECT db_name FROM users WHERE id = ?`,
      [req.cookies.userId]
    );
    if (rows.length) {
      const dbName = rows[0].db_name;
      // Pool für User-DB cachen (pro User)
      if (!guestPools[req.cookies.userId]) {
        const mysql = (await import("mysql2/promise")).default;
        guestPools[req.cookies.userId] = mysql.createPool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: dbName,
          waitForConnections: true,
          connectionLimit: 5,
        });
      }
      req.pool = guestPools[req.cookies.userId];
      // Gast-Cookie löschen, falls vorhanden
      if (req.cookies.guestId) {
        res.clearCookie("guestId", { domain: ".dev2k.org", path: "/" });
      }
      return next();
    }
    // User nicht gefunden → Cookie löschen
    res.clearCookie("userId", { domain: ".dev2k.org", path: "/" });
    return res.status(401).json({ error: "User-Session ungültig" });
  }
  // 2. Gast-Session prüfen (req.pool wurde vom sessionRouter gesetzt)
  if (req.pool) return next();
  // 3. Keine Session vorhanden
  return res.status(401).json({
    error:
      "Keine Session initialisiert. Bitte als Gast starten oder einloggen.",
  });
});

// CRUD-Routen für Todos
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

// 404-Fallback
app.use((req, res) => {
  res.status(404).json({ message: "Route nicht gefunden" });
});

// Server starten
app.listen(HTTP_PORT, "0.0.0.0", () => {
  console.log(`✅ Server läuft auf Port ${HTTP_PORT}`);
});
