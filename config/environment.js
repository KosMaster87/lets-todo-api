/**
 * Backend Environment-Konfiguration
 * Automatische Erkennung von Development vs Production
 */

import dotenv from "dotenv";

/**
 * Dynamisches Laden der Environment-Datei
 * Development → .env.development
 * Production → .env
 */
const NODE_ENV = process.env.NODE_ENV || "development";
const envFile = NODE_ENV === "development" ? ".env.development" : ".env";

dotenv.config({ path: envFile });

console.log(`🔧 Loading environment from: ${envFile} (NODE_ENV: ${NODE_ENV})`);

/**
 * Environment-Detection basierend auf NODE_ENV und Hostname
 */
function detectEnvironment() {
  // Explicit gesetzt via NODE_ENV
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  // Development indicators
  if (
    process.env.DB_HOST === "127.0.0.1" ||
    process.env.DB_HOST === "localhost" ||
    process.cwd().includes("/home/") ||
    process.cwd().includes("/Users/")
  ) {
    return "development";
  }

  // Production als Fallback
  return "production";
}

const ENVIRONMENT = detectEnvironment();

/**
 * Environment-spezifische Konfiguration
 */
const CONFIG = {
  development: {
    // Database
    DB_HOST: process.env.DB_HOST || "127.0.0.1",
    DB_PORT: Number(process.env.DB_PORT) || 3306,
    DB_USER: process.env.DB_USER || "root",
    DB_PASSWORD: process.env.DB_PASSWORD || "",
    DB_NAME: process.env.DB_NAME || "notes_dev",
    DB_USERS: process.env.DB_USERS || "notes_users_dev",

    // Server
    HTTP_PORT: Number(process.env.PORT) || 3000,
    HTTP_HOST: "127.0.0.1",

    // CORS
    CORS_ORIGINS: [
      "http://localhost:3000",
      "http://localhost:5500",
      "http://localhost:5501", // Live Server alternative Port
      "http://127.0.0.1:5500",
      "http://127.0.0.1:5501", // Live Server alternative Port
      "http://localhost:8080",
      "http://localhost:8000", // Python HTTP Server
    ],

    // Cookies
    COOKIE_DOMAIN: undefined, // Keine Domain = akzeptiert alle (localhost, 127.0.0.1)
    COOKIE_SECURE: false,

    // Logging
    DEBUG: true,
    LOG_LEVEL: "verbose",
  },

  production: {
    // Database
    DB_HOST: process.env.DB_HOST || "127.0.0.1",
    DB_PORT: Number(process.env.DB_PORT) || 3306,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME || "RESTful-API-notes",
    DB_USERS: process.env.DB_USERS || "notes_users",

    // Server
    HTTP_PORT: Number(process.env.PORT) || 3000,
    HTTP_HOST: "0.0.0.0",

    // CORS
    CORS_ORIGINS: ["https://lets-todo-api.dev2k.org"],

    // Cookies
    COOKIE_DOMAIN: ".dev2k.org",
    COOKIE_SECURE: true,

    // Logging
    DEBUG: false,
    LOG_LEVEL: "error",
  },

  staging: {
    // Database
    DB_HOST: process.env.DB_HOST || "127.0.0.1",
    DB_PORT: Number(process.env.DB_PORT) || 3306,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME || "notes_staging",
    DB_USERS: process.env.DB_USERS || "notes_users_staging",

    // Server
    HTTP_PORT: Number(process.env.PORT) || 3000,
    HTTP_HOST: "0.0.0.0",

    // CORS
    CORS_ORIGINS: ["https://staging-lets-todo-app.dev2k.org"],

    // Cookies
    COOKIE_DOMAIN: ".dev2k.org",
    COOKIE_SECURE: true,

    // Logging
    DEBUG: true,
    LOG_LEVEL: "info",
  },
};

/**
 * Aktuelle Environment-Konfiguration
 */
const ENV = CONFIG[ENVIRONMENT];

/**
 * Logging-Funktionen
 */
function debugLog(message, data = null) {
  if (ENV.DEBUG) {
    console.log(`🔧 [${ENVIRONMENT.toUpperCase()}] ${message}`, data || "");
  }
}

function infoLog(message, data = null) {
  if (ENV.LOG_LEVEL === "verbose" || ENV.LOG_LEVEL === "info") {
    console.log(`ℹ️ [${ENVIRONMENT.toUpperCase()}] ${message}`, data || "");
  }
}

function errorLog(message, error = null) {
  console.error(`❌ [${ENVIRONMENT.toUpperCase()}] ${message}`, error || "");
}

// Initial-Log beim Laden
debugLog(`Backend Environment Detection: ${ENVIRONMENT}`, {
  dbHost: ENV.DB_HOST,
  dbPort: ENV.DB_PORT,
  httpPort: ENV.HTTP_PORT,
  corsOrigins: ENV.CORS_ORIGINS,
  debug: ENV.DEBUG,
});

export { ENV, ENVIRONMENT, debugLog, infoLog, errorLog };
