// routing/authRouter.js
import { Router } from "express";
import bcrypt from "bcrypt";
import { userPool, corePool } from "../db.js";
import mysql from "mysql2/promise";

const router = Router();

// Registrierung
router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email und Passwort erforderlich" });

  const password_hash = await bcrypt.hash(password, 10);
  // DB-Name auf Basis der Email (hex, auf 24 Zeichen gekürzt)
  const dbName = `notes_user_${Buffer.from(email)
    .toString("hex")
    .slice(0, 24)}`;
  const created = Date.now();

  try {
    // 1) User in Zentrale anlegen
    await userPool.query(
      `INSERT INTO users (email, password_hash, db_name, created)
       VALUES (?, ?, ?, ?)`,
      [email, password_hash, dbName, created]
    );
    // 2) Benutzer-DB erstellen
    await corePool.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
    );
    // 3) Todos-Tabelle in Benutzer-DB anlegen
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
    res.status(201).json({ message: "User registriert" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Email bereits registriert" });
    res.status(500).json({ error: err.message });
  }
});

// Login
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

    // Gast-Cookie ZUERST löschen
    if (req.cookies.guestId) {
      res.clearCookie("guestId", { domain: ".dev2k.org", path: "/" });
    }

    // Session-Cookie setzen - PERSISTENT für 7 Tage
    res.cookie("userId", user.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage persistent
      domain: ".dev2k.org",
      path: "/",
    });
    
    res.json({ message: "Login erfolgreich", userId: user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("userId", { domain: ".dev2k.org", path: "/" });
  // guestId NICHT automatisch setzen!
  res.json({ message: "Logout erfolgreich" });
});

export default router;
