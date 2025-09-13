# Backend Copilot Instructions - Let's Todo API

## 🏗️ Architecture Principles

### Multi-Environment System

- **4 Environments**: Development (3000), Feature (3003), Staging (3004), Production (3002)
- **Automatic Detection**: Based on NODE_ENV and system paths (`/home/`, `/Users/` = dev)
- **Environment Files**: `config/env/.env.*` for each environment
- **PM2 Integration**: Separate PM2 apps per environment with different settings

### Database-per-Session Architecture

- **User Sessions**: Each user gets dedicated MySQL database (`todos_user_123`)
- **Guest Sessions**: Temporary MySQL database per guest (`todos_guest_uuid`)
- **Central Users DB**: `todos_users_dev`/`todos_users` for user management
- **Connection Pooling**: Dynamic pools managed in `db.js`
- **Session Middleware**: `poolMiddleware.js` assigns `req.pool` based on session

### Cookie-based Session Management

- **httpOnly=false**: Frontend can read session data
- **Environment-aware Security**: `secure=true` only in production/staging
- **Domain Restriction**: `.dev2k.org` for server environments, undefined for localhost
- **Session Isolation**: User session excludes guest, strict separation

## 📂 Project Structure

```
lets-todo-api/
├── server.js               # Express app setup + environment detection
├── db.js                   # Pool management (core, user, guest pools)
├── ecosystem.config.cjs    # PM2 multi-environment configuration
├── config/
│   ├── environment.js      # Environment detection + configuration
│   └── env/                # Environment files (.env.development, etc.)
├── deploy/                 # Deployment scripts + Nginx configs
├── routing/                # API routers (auth, session, todos)
├── middleware/             # poolMiddleware.js for session-db assignment
└── scripts/                # Development setup scripts
```

## 💻 Coding Standards

### ES6 Module Pattern

```javascript
// Always use ES6 imports/exports
import { ENV, debugLog } from "./config/environment.js";
import { corePool } from "./db.js";
export { router as authRouter };
```

### Environment-aware Logging

```javascript
import { debugLog, infoLog, errorLog } from "./config/environment.js";

// Only visible in development
debugLog("Pool assignment for user", { userId, dbName });

// Respects LOG_LEVEL setting
infoLog("User registered successfully", { email: user.email });

// Always visible, for errors
errorLog("Database connection failed", error);
```

### Database Patterns

```javascript
// Always use req.pool from middleware
router.get("/api/todos", async (req, res) => {
  try {
    const [rows] = await req.pool.execute("SELECT * FROM todos");
    res.json({ todos: rows });
  } catch (error) {
    errorLog("Failed to fetch todos", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Always use prepared statements
const [rows] = await pool.execute(
  "SELECT * FROM todos WHERE id = ? AND completed = ?",
  [todoId, false]
);

// Use COALESCE for partial updates
await pool.execute(
  `
  UPDATE todos SET 
    title = COALESCE(?, title),
    description = COALESCE(?, description),
    completed = COALESCE(?, completed),
    updated = ?
  WHERE id = ?
`,
  [title, description, completed, Date.now(), id]
);
```

### Error Handling Pattern

```javascript
// Consistent error response structure
try {
  // operation
} catch (error) {
  errorLog("Operation failed", error);
  res.status(400).json({
    error: "Brief user-friendly message",
    message: "Detailed explanation for debugging",
  });
}

// Environment-specific error details
if (ENV.DEBUG) {
  res.status(500).json({
    error: "Internal server error",
    message: error.message,
    stack: error.stack, // Only in development
  });
}
```

### Async/Await Pattern

```javascript
// Always use async/await, never callbacks or raw promises
async function createUserDatabase(userId) {
  try {
    const dbName = `todos_user_${userId}`;
    await corePool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

    // Switch to user database and create tables
    const userPool = mysql.createPool({
      ...ENV.DB_CONFIG,
      database: dbName,
    });

    await userPool.execute(`
      CREATE TABLE IF NOT EXISTS todos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created BIGINT,
        updated BIGINT,
        completed TINYINT DEFAULT 0
      )
    `);

    return userPool;
  } catch (error) {
    errorLog("Failed to create user database", error);
    throw error;
  }
}
```

## 🔧 Key Modules

### `config/environment.js`

**Purpose**: Multi-environment configuration and detection

```javascript
// Exports
export { ENV, ENVIRONMENT, debugLog, infoLog, errorLog };

// Usage pattern
const CONFIG = {
  development: {
    DB_HOST: process.env.DB_HOST || "127.0.0.1",
    HTTP_PORT: Number(process.env.PORT) || 3000,
    CORS_ORIGINS: ["http://localhost:5501", "http://127.0.0.1:5501"],
    COOKIE_DOMAIN: undefined,
    COOKIE_SECURE: false,
    DEBUG: true,
    LOG_LEVEL: "verbose",
  },
  production: {
    // production settings
  },
};
```

### `db.js`

**Purpose**: Connection pool management and database operations

```javascript
// Exports
export { corePool, userPool, guestPools, userPools };

// Pool management pattern
const guestPools = new Map();
const userPools = new Map();

// Pool creation pattern
function createGuestPool(guestId) {
  const dbName = `todos_guest_${guestId}`;
  const pool = mysql.createPool({
    ...ENV.DB_CONFIG,
    database: dbName,
  });
  guestPools.set(guestId, pool);
  return pool;
}
```

### `middleware/poolMiddleware.js`

**Purpose**: Assigns correct database pool to `req.pool` based on session

```javascript
// Basic pool assignment
export function assignPoolMiddleware(req, res, next) {
  const userId = req.cookies.userId;
  const guestId = req.cookies.guestId;

  if (userId && userPools.has(userId)) {
    req.pool = userPools.get(userId);
    req.sessionType = "user";
  } else if (guestId && guestPools.has(guestId)) {
    req.pool = guestPools.get(guestId);
    req.sessionType = "guest";
  } else {
    req.pool = null;
    req.sessionType = "none";
  }

  next();
}

// Enhanced pool assignment with database reconstruction
export function enhancedPoolMiddleware(req, res, next) {
  // Complex logic for pool reconstruction from database
}
```

## 🚀 API Design Patterns

### RESTful Route Structure

```javascript
// Authentication routes
router.post("/api/register", async (req, res) => {
  // 1. Validate input
  // 2. Hash password with bcrypt
  // 3. Create user database
  // 4. Insert user into central users table
  // 5. Set cookie and return success
});

// Session-dependent routes (require middleware)
router.get("/api/todos", assignPoolMiddleware, async (req, res) => {
  if (!req.pool) {
    return res.status(401).json({ error: "No active session" });
  }

  // Use req.pool for database operations
});
```

### Session Management Pattern

```javascript
// Cookie configuration per environment
const cookieOptions = {
  httpOnly: false, // Frontend needs access
  secure: ENV.COOKIE_SECURE, // true in production
  sameSite: "lax",
  domain: ENV.COOKIE_DOMAIN, // undefined in dev, .dev2k.org in production
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Set session cookie
res.cookie("userId", user.id, cookieOptions);

// Clear session cookie
res.clearCookie("userId", { domain: ENV.COOKIE_DOMAIN });
```

## 🔒 Security Patterns

### Password Hashing

```javascript
import bcrypt from "bcrypt";

// Hash password for storage
const saltRounds = 10;
const passwordHash = await bcrypt.hash(password, saltRounds);

// Verify password during login
const isValid = await bcrypt.compare(password, user.password_hash);
```

### SQL Injection Prevention

```javascript
// ✅ Always use prepared statements
const [rows] = await pool.execute(
  "SELECT * FROM todos WHERE title LIKE ? AND completed = ?",
  [`%${searchTerm}%`, false]
);

// ❌ Never use string concatenation
const query = `SELECT * FROM todos WHERE title = '${title}'`; // VULNERABLE
```

### Input Validation Pattern

```javascript
function validateTodo(data) {
  const errors = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push("Title is required");
  }

  if (data.title && data.title.length > 255) {
    errors.push("Title too long (max 255 characters)");
  }

  if (data.completed !== undefined && typeof data.completed !== "boolean") {
    errors.push("Completed must be boolean");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

## 🔄 Environment-Specific Patterns

### Development vs Production Code

```javascript
// Environment-specific CORS
const corsOrigins = ENV.CORS_ORIGINS; // From environment config

// Environment-specific logging
if (ENV.DEBUG) {
  console.log("Debug info:", debugData);
}

// Environment-specific error handling
if (ENVIRONMENT === "development") {
  res.json({ error: error.message, stack: error.stack });
} else {
  res.json({ error: "Internal server error" });
}
```

### PM2 Configuration Patterns

```javascript
// ecosystem.config.cjs structure
module.exports = {
  apps: [
    {
      name: "lets-todo-api-prod",
      script: "./server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env_file: "config/env/.env.production",
      log_file: "./logs/prod-combined.log",
      out_file: "./logs/prod-out.log",
      error_file: "./logs/prod-error.log",
      time: true,
    },
  ],
};
```

## 🧪 Testing Patterns

### API Testing Guidelines

- Use Thunder Client or Postman for manual testing
- Include cookies in all authenticated requests
- Test both user and guest session flows
- Verify session isolation (users can't access each other's data)

### Database Testing

```javascript
// Test database isolation
const user1Pool = userPools.get("user1");
const user2Pool = userPools.get("user2");

// These should return different results
const user1Todos = await user1Pool.execute("SELECT * FROM todos");
const user2Todos = await user2Pool.execute("SELECT * FROM todos");
```

## 🚀 Deployment Considerations

### Environment-specific Settings

- **Development**: Debug logging, watch=false, local CORS origins
- **Feature**: Debug logging, watch=true, test domain CORS
- **Staging**: Warn logging, watch=false, staging domain only
- **Production**: Info logging, watch=false, production domain only

### Performance Patterns

- Use connection pooling for all database operations
- Clean up guest sessions and databases when they end
- Monitor memory usage with PM2 memory restart limits
- Use prepared statements for better performance

---

### 📚 Related Documentation

_For production deployment, SSL setup, and monitoring, see [DEPLOYMENT.md](./DEPLOYMENT.md)_
_For user documentation and setup guides, see [README.md](./README.md)_
_For detailed development workflows, see [DEVELOPMENT.md](./DEVELOPMENT.md)_
