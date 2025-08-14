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

import { userPool } from "./db.js";
import authRouter from "./routing/authRouter.js";
import sessionRouter from "./routing/sessionRouter.js";
import todosRouter from "./routing/todosRouter.js";
import { assignPoolMiddleware, enhancedPoolMiddleware } from "./middleware/poolMiddleware.js";

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

// Auth- und Session-Router (diese brauchen keine Pool-Zuweisung)
app.use("/api/session", sessionRouter);
app.use("/api", authRouter);

// Pool-Middleware für alle folgenden Routen
app.use(assignPoolMiddleware);
app.use(enhancedPoolMiddleware);

// Todos-Router (benötigt req.pool von Middleware)
app.use("/api/todos", todosRouter);

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