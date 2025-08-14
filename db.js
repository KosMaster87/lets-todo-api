/**
 * Datenbankverbindungs-Management für Todo-App
 * Verwaltet drei verschiedene Pool-Typen:
 * - Core-Pool: Für DDL-Operationen (DB-Erstellung)
 * - User-Pool: Zentrale User-Verwaltung
 * - Guest-Pools: Dynamische Pools pro Gast-Session
 */

//  db.js
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config(); // zieht PORT, DB_HOST, DB_PORT, usw. aus .env

/**
 * Map zum Speichern der Connection-Pools pro Guest-ID oder User-ID
 * Struktur: { "guestId": pool, "user_123": pool }
 * @type {Object<string, mysql.Pool>}
 */
const guestPools = {};

/**
 * Core-Pool für DDL-Operationen (Data Definition Language) | Datenbank-Erstellung/Löschung
 * Verbindet sich OHNE spezifische Datenbank
 * @type {mysql.Pool}
 */
const corePool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
});

/**
 * Pool für zentrale User-Verwaltung
 * Verbindet sich mit der notes_users Datenbank
 * @type {mysql.Pool}
 */
const userPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_USERS || "notes_users", // zentrale User-DB
  waitForConnections: true,
  connectionLimit: 5,
});

/**
 * Testet die Core-Pool Verbindung beim App-Start
 * Implementiert "Fail-Fast" Pattern - App startet nur bei funktionierender DB
 * Beendet den Prozess bei Verbindungsfehlern (PM2 startet automatisch neu)
 * @async
 * @function testCoreConnection
 */
(async function testCoreConnection() {
  try {
    // Eine Verbindung aus dem Pool holen (testet DB-Erreichbarkeit)
    const conn = await corePool.getConnection();
    console.log("✅ Core-Pool verbunden mit MariaDB (DDL-Pool)");
    
    // WICHTIG: Verbindung zurück in den Pool geben
    // Ohne release() wäre diese Verbindung permanent "blockiert"
    conn.release();
  } catch (err) {
    console.error("❌ Core-Pool Verbindungsfehler:", err.message);
    console.error("💡 Prüfen Sie: DB läuft? Zugangsdaten korrekt? Netzwerk ok?");
    
    // Fail-Fast: App beenden statt fehlerhaft zu starten
    // PM2 startet die App automatisch neu, wenn DB wieder verfügbar
    process.exit(1);
  }
})();

export { corePool, guestPools, userPool };
