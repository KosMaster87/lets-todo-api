# 🚀 Let's Todo API

Professional Node.js Express API with multi-environment deployment, database-per-session architecture, and automated SSL setup.

## ✨ Key Features

- **🏗️ Multi-Environment**: Development, Feature, Staging, Production
- **🗄️ Database-per-Session**: Isolated MySQL databases for each user/guest
- **🔒 Secure Authentication**: Cookie-based sessions with bcrypt hashing
- **⚡ Auto-Deployment**: PM2 + Nginx deployment packages
- **🌐 SSL Ready**: Let's Encrypt integration
- **📊 RESTful API**: Complete CRUD with session isolation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MySQL/MariaDB
- Git

### Installation

```bash
git clone https://github.com/KosMaster87/lets-todo-api.git
cd lets-todo-api
npm install
npm run dev:db    # Setup development database
npm run dev       # Start development server
```

**🎯 API available at:** http://127.0.0.1:3000

> **💡 Full-Stack Setup:** Use with [Let's Todo Frontend](../lets-todo-app) for complete development experience.

## 📡 API Reference

### Authentication

```
POST /api/register       # Create user account + dedicated database
POST /api/login          # Login user + set session cookie
POST /api/logout         # Clear session cookie
```

### Session Management

```
POST /api/session/guest     # Start guest session + temp database
GET  /api/session/validate  # Check current session status
POST /api/session/guest/end # End guest session + cleanup database
```

### Todos (Session-Isolated)

```
GET    /api/todos        # Get all todos for current session
POST   /api/todos        # Create new todo
GET    /api/todos/:id    # Get specific todo
PATCH  /api/todos/:id    # Update todo (partial update)
DELETE /api/todos/:id    # Delete todo
```

### API Examples

```bash
# Register new user
curl -X POST http://127.0.0.1:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secure123"}'

# Login user
curl -X POST http://127.0.0.1:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secure123"}'

# Create todo (requires login cookie)
curl -X POST http://127.0.0.1:3000/api/todos \
  -H "Content-Type: application/json" \
  -b "cookies.txt" \
  -d '{"title":"My Todo","description":"Todo description"}'
```

## 🏗️ Architecture Overview

### Database-per-Session

Each user and guest gets their own isolated MySQL database:

- **User Database**: `todos_user_123` (persistent)
- **Guest Database**: `todos_guest_uuid` (temporary)
- **Central Users DB**: `todos_users_dev` (user management)

### Multi-Environment Support

- **Development** (3000): Local development with debug logging
- **Feature** (3003): Feature testing environment
- **Staging** (3004): Pre-production testing
- **Production** (3002): Live production system

### Domain Structure

- Production: `lets-todo-api.dev2k.org`
- Feature: `lets-todo-api-feat.dev2k.org`
- Staging: `lets-todo-api-stage.dev2k.org`

## ⚙️ Configuration

### Environment Setup

Create environment files in `config/env/`:

```env
# config/env/.env.development
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=todos_dev
DB_USERS=todos_users_dev
PORT=3000
NODE_ENV=development
DEBUG=true
LOG_LEVEL=verbose
```

### Automatic Environment Detection

The system detects environment based on:

- `NODE_ENV` environment variable
- System paths (`/home/`, `/Users/` = development)
- Database host (`127.0.0.1` = development)

## 🚀 Production Deployment

### Using PM2

```bash
# Copy example config
cp ecosystem.config.cjs.example ecosystem.config.cjs

# Start all environments
pm2 start ecosystem.config.cjs

# Start specific environment
pm2 start ecosystem.config.cjs --only lets-todo-api-prod

# Monitor processes
pm2 logs lets-todo-api-prod
pm2 monit
```

### Automated Deployment

```bash
# Create deployment package
./deploy/create-deployment-package.sh

# Deploy to server
scp deploy/package/lets-todo-api-deployment.tar.gz server:/path/
```

### SSL Setup

The deployment package includes:

- Nginx reverse proxy configurations
- Let's Encrypt SSL certificate setup
- Rate limiting and security headers

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **SQL Injection Prevention**: Prepared statements only
- **Session Isolation**: Complete database separation per session
- **CORS Protection**: Environment-specific allowed origins
- **Environment-aware Cookies**: Secure settings per environment

## 🛠️ Development

### NPM Scripts

```bash
npm run dev      # Development server with auto-reload
npm run dev:db   # Setup/reset development database
npm start        # Production server
npm run prod     # Explicit production mode
```

### Testing

Recommended tools:

- **Thunder Client** (VS Code extension)
- **Postman** (standalone app)
- **curl** (command line)

**⚠️ Important:** Include cookies in requests for authenticated endpoints.

## 🔗 Related Projects

### [Let's Todo Frontend →](../lets-todo-app)

- Vanilla JavaScript SPA with modular architecture
- Automatic environment detection and API connection
- Cookie-based session management
- Live development on `127.0.0.1:5501`

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check if MariaDB is running
sudo systemctl status mariadb

# Test database connection
mysql -u root -p -e "SELECT 1;"

# View user databases
mysql -e "SHOW DATABASES LIKE 'todos_%';"
```

### Environment Issues

```bash
# Force specific environment
NODE_ENV=production npm start

# Check detected environment
npm run dev  # Shows environment detection in logs
```

### Session/Cookie Issues

- Development: Cookies work between `127.0.0.1:5501` ↔ `127.0.0.1:3000`
- Production: Cookies are domain-restricted to `.dev2k.org`
- Modern browsers block insecure cookies

## � Deployment

**Quick Deploy:**

```bash
./deploy/create-deployment-package.sh  # Create package
# Copy to server and run deploy.sh
```

**📚 Complete deployment guide with SSL, multi-environment setup, monitoring, and troubleshooting:** **[DEPLOYMENT.md](./DEPLOYMENT.md)**

## �📚 Documentation

- **[Complete Deployment Guide](./DEPLOYMENT.md)** - Production setup, SSL, monitoring
- **[Architecture & Coding Standards](./copilot-instructions.md)** - For developers
- **[Detailed Development Setup](./DEVELOPMENT.md)** - Database setup, debugging tools

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

**Built with ❤️ for modern full-stack development**
