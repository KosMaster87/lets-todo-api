/**
 * Database Setup Script
 * Erstellt Datenbanken für Development und Production
 */

import mysql from "mysql2/promise";
import {
  ENV,
  debugLog,
  infoLog,
  errorLog,
  ENVIRONMENT,
} from "../config/environment.js";

/**
 * Setup für Datenbank (Development oder Production)
 */
async function setupDatabase() {
  try {
    infoLog(`Starte ${ENVIRONMENT} Database Setup...`);

    // Verbindung ohne spezifische Datenbank
    const connection = await mysql.createConnection({
      host: ENV.DB_HOST,
      port: ENV.DB_PORT,
      user: ENV.DB_USER,
      password: ENV.DB_PASSWORD,
    });

    // 1. Users-Datenbank erstellen
    const usersDB = ENV.DB_USERS;
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${usersDB}\``);
    infoLog(`Users-Datenbank erstellt: ${usersDB}`);

    // 2. Users-Tabelle erstellen
    await connection.execute(`USE \`${usersDB}\``);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        db_name VARCHAR(255) NOT NULL,
        created BIGINT
      );
    `);
    infoLog("Users-Tabelle erstellt");

    // 3. Test-Benutzer erstellen (optional für Development)
    if (ENVIRONMENT === "development") {
      try {
        const testEmail = "test@dev.local";
        const testPasswordHash = "$2b$10$abcdefghijklmnopqrstuvwxyz123456"; // Dummy-Hash
        const testDBName = "todos_user_1_dev";

        await connection.execute(
          `INSERT IGNORE INTO users (email, password_hash, db_name, created) VALUES (?, ?, ?, ?)`,
          [testEmail, testPasswordHash, testDBName, Date.now()]
        );
        infoLog(`Test-User erstellt: ${testEmail}`);

        // Test-User-Datenbank erstellen
        await connection.execute(
          `CREATE DATABASE IF NOT EXISTS \`${testDBName}\``
        );
        await connection.execute(`USE \`${testDBName}\``);
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS todos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            completed TINYINT(1) DEFAULT 0,
            created BIGINT,
            updated BIGINT
          );
        `);
        infoLog(`Test-User-Datenbank erstellt: ${testDBName}`);
      } catch (err) {
        debugLog("Test-User bereits vorhanden oder Fehler:", err.message);
      }
    }

    await connection.end();
    infoLog(`✅ ${ENVIRONMENT} Database Setup abgeschlossen!`);

    if (ENVIRONMENT === "development") {
      console.log("\n🚀 Sie können jetzt starten mit:");
      console.log("npm run dev");
    } else {
      console.log("\n🚀 Production-Datenbank ist bereit!");
      console.log("Die users-Tabelle wurde erstellt.");
    }
  } catch (error) {
    errorLog("❌ Database Setup Fehler:", error);
    console.log("\n💡 Mögliche Lösungen:");
    console.log("1. MariaDB/MySQL läuft: sudo systemctl start mariadb");
    console.log("2. Zugangsdaten in .env prüfen");
    console.log("3. User-Berechtigung prüfen");
    process.exit(1);
  }
}

// Script ausführen
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase();
}

export { setupDatabase };
