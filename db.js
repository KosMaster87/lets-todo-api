//  db.js
import mysql from "mysql2/promise"; // Use the promise-based API
import dotenv from "dotenv";
dotenv.config(); // zieht PORT, DB_HOST, DB_PORT, usw. aus .env
console.log("👉 Aktive DB_HOST:", process.env.DB_HOST);
console.log("👉 Backend läuft für Domain: api-restful-guest-access.dev2k.org");

// Debug-Log: Zeige geladene DB-Konfiguration
console.log("» Lese DB-Konfig aus env:", {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
});

// Map zum Speichern der Pools pro Guest-ID
const guestPools = {};

// Pool für Verwaltung aller Guest‑DBs (CORE‑Pool ohne Datenbank)
const corePool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
});

// Initialisierung: Core-Pool testen (optional)
(async function testCoreConnection() {
  try {
    const conn = await corePool.getConnection();
    console.log("✅ Core-Pool verbunden mit MariaDB (DDL-Pool)");
    conn.release();
  } catch (err) {
    console.error("❌ Core-Pool Verbindungsfehler:", err);
    process.exit(1);
  }
})();

export { corePool, guestPools };
