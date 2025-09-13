# Development Setup & Debugging Guide

## 🔧 Initial Development Setup

### MariaDB Installation (Fedora)

```bash
# Install MariaDB server
sudo dnf install mariadb mariadb-server

# Start and enable service
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Secure installation (optional for development)
sudo mysql_secure_installation
# - Set root password (or leave empty for dev)
# - Remove anonymous users: Y
# - Disallow root login remotely: Y
# - Remove test database: Y
# - Reload privilege tables: Y

# Test connection
mysql -u root -p
# Or without password: mysql -u root
```

### MariaDB Installation (Other Systems)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mariadb-server mariadb-client

# macOS (Homebrew)
brew install mariadb
brew services start mariadb

# Windows
# Download MariaDB installer from mariadb.org
```

### Project Setup

```bash
# Clone repository
git clone https://github.com/KosMaster87/lets-todo-api.git
cd lets-todo-api

# Install dependencies
npm install

# Copy environment files from examples
cp config/env/.env.development.example config/env/.env.development
cp ecosystem.config.cjs.example ecosystem.config.cjs

# Setup development database (multi-environment support)
npm run dev:db                    # Development setup (default)
NODE_ENV=feature npm run dev:db   # Feature environment setup
NODE_ENV=staging npm run dev:db   # Staging environment setup

# Start development server
npm run dev
```

## 🗄️ Database Development Workflows

### Multi-Environment Database Management

The `setup-dev-db.js` script supports all environments:

```bash
# Development environment (default)
npm run dev:db
# Creates: todos_users_dev, test@dev.local, sample todos

# Feature environment
NODE_ENV=feature npm run dev:db
# Creates: todos_users, test@feature.local, empty todos

# Staging environment
NODE_ENV=staging npm run dev:db
# Creates: todos_users, test@staging.local, empty todos

# Production environment (no test data)
NODE_ENV=production npm run dev:db
# Creates: todos_users only, no test user
```

### Development Database Management

```bash
# Reset development database (clean start)
npm run dev:db

# Manual database operations
mysql -u root -p

# Show all databases (including user/guest DBs)
mysql -e "SHOW DATABASES LIKE 'todos_%';"

# Count user databases
mysql -e "SELECT COUNT(*) AS user_dbs FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE 'todos_user_%';"

# Count guest databases
mysql -e "SELECT COUNT(*) AS guest_dbs FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE 'todos_guest_%';"
```

### User Database Inspection

```bash
# View all registered users
mysql todos_users_dev -e "SELECT id, email, db_name, FROM_UNIXTIME(created/1000) as created_at FROM users;"

# Check specific user's todos
mysql todos_user_123 -e "SELECT id, title, completed, FROM_UNIXTIME(created/1000) as created_at FROM todos;"

# Find user by email and check their database
USER_DB=$(mysql todos_users_dev -sN -e "SELECT db_name FROM users WHERE email='user@example.com';")
mysql $USER_DB -e "SELECT * FROM todos;"
```

### Guest Database Cleanup

```bash
# List all guest databases (these should be temporary)
mysql -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE 'todos_guest_%';"

# Clean up old guest databases (manual cleanup)
mysql -e "DROP DATABASE todos_guest_old_uuid_here;"

# Count total tables across all databases
mysql -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA LIKE 'todos_%';"
```

## 🔍 Debugging Tools & Techniques

### Environment Detection Debugging

```bash
# Check which environment is detected
npm run dev  # Shows environment detection in startup logs

# Force specific environment
NODE_ENV=production npm start
NODE_ENV=feature npm start
NODE_ENV=staging npm start

# Debug environment variables
node -e "
const dotenv = require('dotenv');
dotenv.config({ path: 'config/env/.env.development' });
console.log('Environment variables:', process.env);
"
```

### Database Connection Debugging

```bash
# Check MariaDB status
sudo systemctl status mariadb

# Check MariaDB process and ports
sudo netstat -tlnp | grep :3306
ps aux | grep mariadb

# View MariaDB error log
sudo tail -f /var/log/mariadb/mariadb.log

# Test database connection with specific user
mysql -h 127.0.0.1 -u root -p -e "SELECT 1;"

# Check database permissions
mysql -u root -p -e "SHOW GRANTS FOR 'root'@'localhost';"
```

### Connection Pool Debugging

```javascript
// Add to db.js for debugging
console.log("Active pools:", {
  guestPools: guestPools.size,
  userPools: userPools.size,
  corePoolConnections: corePool.pool._allConnections.length,
  userPoolConnections: userPool.pool._allConnections.length,
});

// Check pool status
setInterval(() => {
  debugLog("Pool status", {
    guestSessions: guestPools.size,
    userSessions: userPools.size,
  });
}, 30000);
```

### Session & Cookie Debugging

```bash
# Test cookie behavior with curl
# Register user and save cookies
curl -c cookies.txt -X POST http://127.0.0.1:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"debug@example.com","password":"test123"}'

# Use saved cookies for authenticated request
curl -b cookies.txt http://127.0.0.1:3000/api/todos

# View saved cookies
cat cookies.txt
```

```javascript
// Add to middleware for debugging
console.log("Cookie debug:", {
  userId: req.cookies.userId,
  guestId: req.cookies.guestId,
  sessionType: req.sessionType,
  hasPool: !!req.pool,
});
```

### API Response Debugging

```javascript
// Add comprehensive request/response logging
app.use((req, res, next) => {
  const start = Date.now();

  // Log request
  debugLog("Request", {
    method: req.method,
    path: req.path,
    body: req.body,
    cookies: req.cookies,
    userAgent: req.get("User-Agent"),
  });

  // Log response
  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - start;
    debugLog("Response", {
      status: res.statusCode,
      duration: `${duration}ms`,
      data: data,
    });
    return originalJson.call(this, data);
  };

  next();
});
```

## 🚀 Development Workflows

### Full Development Cycle

```bash
# 1. Start fresh
npm run dev:db          # Reset database
npm run dev             # Start server with auto-reload

# 2. Test user registration flow
curl -c cookies.txt -X POST http://127.0.0.1:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@test.com","password":"dev123"}'

# 3. Test user session
curl -b cookies.txt http://127.0.0.1:3000/api/session/validate

# 4. Create some todos
curl -b cookies.txt -X POST http://127.0.0.1:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Development Todo","description":"Testing API"}'

# 5. Test guest session
curl -c guest_cookies.txt -X POST http://127.0.0.1:3000/api/session/guest

# 6. Verify session isolation
curl -b guest_cookies.txt http://127.0.0.1:3000/api/todos  # Should be empty
```

### Frontend Integration Testing

```bash
# Start backend
npm run dev

# Start frontend (in separate terminal)
cd ../lets-todo-app
# Use VS Code Live Server on 127.0.0.1:5501

# Test cross-origin requests with browser dev tools
# Check Network tab for CORS headers
# Verify cookies are set and sent correctly
```

### Multi-Environment Testing

```bash
# Test environment switching
NODE_ENV=development npm start    # Port 3000
NODE_ENV=feature npm start        # Port 3003
NODE_ENV=staging npm start        # Port 3004
NODE_ENV=production npm start     # Port 3002

# Verify environment-specific settings
# Check CORS origins, cookie domains, logging levels
```

## 🔧 Performance Debugging

### Database Performance

```sql
-- Show slow queries
SHOW VARIABLES LIKE 'slow_query_log';
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- Show current connections
SHOW PROCESSLIST;

-- Show database sizes
SELECT
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema LIKE 'todos_%'
GROUP BY table_schema;
```

### Memory Usage Monitoring

```javascript
// Add memory monitoring to server.js
setInterval(() => {
  const memUsage = process.memoryUsage();
  debugLog("Memory usage", {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
  });
}, 30000);

// Monitor pool connections
debugLog("Pool stats", {
  corePool: corePool.pool.config.connectionLimit,
  guestPools: guestPools.size,
  userPools: userPools.size,
});
```

## 🐛 Common Issues & Solutions

### MariaDB Issues

**Issue**: MariaDB won't start

```bash
# Check status and logs
sudo systemctl status mariadb
sudo journalctl -u mariadb -f

# Common fixes
sudo systemctl stop mariadb
sudo systemctl start mariadb

# If still failing, check disk space
df -h
```

**Issue**: Connection refused

```bash
# Check if MariaDB is listening
sudo netstat -tlnp | grep :3306

# Check MariaDB configuration
sudo cat /etc/mysql/mariadb.conf.d/50-server.cnf | grep bind-address

# Restart service
sudo systemctl restart mariadb
```

**Issue**: Access denied for user 'root'

```bash
# Reset root password
sudo mysql_secure_installation

# Or login without password and set one
sudo mysql -u root
# In MySQL:
# ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpassword';
# FLUSH PRIVILEGES;
```

### Node.js Issues

**Issue**: npm run dev:db fails

```bash
# Check environment file exists
ls -la config/env/.env.development

# Run with debugging
DEBUG=* npm run dev:db

# Check database connection manually
mysql -u root -p -e "SELECT 1;"
```

**Issue**: Cookies not working with frontend

```bash
# Check CORS configuration
curl -I http://127.0.0.1:3000/api/session/validate

# Verify frontend is on correct port
# Frontend should be on 127.0.0.1:5501
# Backend should be on 127.0.0.1:3000

# Check browser dev tools:
# - Network tab for Set-Cookie headers
# - Application tab for stored cookies
# - Console for CORS errors
```

**Issue**: Pool assignment fails

```javascript
// Add debugging to poolMiddleware.js
console.log("Pool middleware debug:", {
  cookies: req.cookies,
  userPoolExists: userPools.has(req.cookies.userId),
  guestPoolExists: guestPools.has(req.cookies.guestId),
  sessionType: req.sessionType,
});
```

### Environment Issues

**Issue**: Wrong environment detected

```bash
# Check environment detection logic
node -e "
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CWD:', process.cwd());
console.log('HOME:', process.env.HOME);
"

# Force environment
NODE_ENV=development npm run dev
```

## 📊 Monitoring & Logging

### Development Logging Setup

```javascript
// Enhanced logging for development
if (ENVIRONMENT === "development") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, {
      body: req.body,
      cookies: req.cookies,
      sessionType: req.sessionType,
    });
    next();
  });
}
```

### Database Query Logging

```javascript
// Log all database queries in development
const originalExecute = pool.execute;
pool.execute = function (sql, values) {
  debugLog("Database query", { sql, values });
  return originalExecute.call(this, sql, values);
};
```

### Production Debugging

```bash
# Using PM2 for production debugging
pm2 logs lets-todo-api-prod --lines 100
pm2 monit
pm2 restart lets-todo-api-prod

# Check production environment
pm2 env lets-todo-api-prod
```

---

### 📚 Related Documentation

_For production deployment, SSL setup, and monitoring, see [DEPLOYMENT.md](./DEPLOYMENT.md)_
_For architecture and coding standards, see [copilot-instructions.md](./copilot-instructions.md)_
_For user documentation, see [README.md](./README.md)_
