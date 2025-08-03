// routing/sessionRouter.js
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { corePool, guestPools } from "../db.js";
import mysql from "mysql2/promise";

const router = Router();

// Gast-Session anlegen / zurückgeben
router.get("/guest", async (req, res, next) => {
  try {
    // 1) Guest-ID aus Cookie oder neu generieren
    let guestId = req.cookies.guestId;
    if (!guestId) {
      guestId = uuidv4();
      res.cookie("guestId", guestId, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: ".dev2k.org",
        path: "/",
      });
    }
    // 2) DB-Name ableiten
    const dbName = `notes_guest_${guestId.replace(/-/g, "")}`;
    // 3) Datenbank anlegen
    await corePool.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
    );
    // 4) Pool und Tabelle provisionieren
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
    // 5) Pool injizieren und Antwort
    req.pool = guestPools[guestId];
    res.json({ guestId });
  } catch (err) {
    next(err);
  }
});

export default router;
