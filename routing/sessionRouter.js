// routing/sessionRouter.js
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { corePool, guestPools } from "../db.js";
import mysql from "mysql2/promise";

const router = Router();

// Gast-Session anlegen / zurückgeben - ÄNDERUNG ZU POST
router.post("/guest", async (req, res, next) => {
  try {
    // 1) Guest-ID aus Cookie oder neu generieren
    let guestId = req.cookies.guestId;
    if (!guestId) {
      guestId = uuidv4();
      res.cookie("guestId", guestId, {
        httpOnly: false, // Für Debug
        secure: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: ".dev2k.org", // KORRIGIERT: Gemeinsame Parent-Domain
        path: "/",
      });
    }
    
    // Sicherstellen, dass KEINE userId gesetzt wird
    if (req.cookies.userId) {
      res.clearCookie("userId", { domain: ".dev2k.org", path: "/" });
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
    res.json({ guestId, message: "Gast-Session aktiv" });
  } catch (err) {
    next(err);
  }
});

// Session-Validierung - NEU
router.get("/validate", async (req, res) => {
  try {
    // User-Session prüfen
    if (req.cookies.userId) {
      const [rows] = await import("../db.js").then(db => 
        db.userPool.query(`SELECT id, email FROM users WHERE id = ?`, [req.cookies.userId])
      );
      if (rows.length) {
        return res.json({ 
          type: "user", 
          userId: rows[0].id, 
          email: rows[0].email,
          valid: true 
        });
      } else {
        // User nicht gefunden - Cookie löschen
        res.clearCookie("userId", { domain: ".dev2k.org", path: "/" });
        return res.status(401).json({ error: "User-Session ungültig" });
      }
    }
    
    // Gast-Session prüfen
    if (req.cookies.guestId) {
      const guestId = req.cookies.guestId;
      const dbName = `notes_guest_${guestId.replace(/-/g, "")}`;
      
      // Prüfen ob Gast-DB existiert
      const [dbRows] = await corePool.query(`SHOW DATABASES LIKE '${dbName}'`);
      if (dbRows.length) {
        return res.json({ 
          type: "guest", 
          guestId: guestId,
          valid: true 
        });
      } else {
        // Gast-DB nicht gefunden - Cookie löschen
        res.clearCookie("guestId", { domain: ".dev2k.org", path: "/" });
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

// Gast-Session beenden - NEU
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
    const dbName = `notes_guest_${guestId.replace(/-/g, "")}`;
    await corePool.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    
    // Cookie löschen
    res.clearCookie("guestId", { domain: ".dev2k.org", path: "/" });
    
    res.json({ message: "Gast-Session beendet und Daten gelöscht" });
  } catch (err) {
    console.error("Fehler beim Beenden der Gast-Session:", err);
    res.status(500).json({ error: "Fehler beim Beenden der Gast-Session" });
  }
});

export default router;
