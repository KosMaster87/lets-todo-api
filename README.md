# RESTful Notes API - Backend

Eine vollständige RESTful API für Todo-Management mit User- und Gast-Sessions, entwickelt mit Express.js und MariaDB.

## 🌟 Features

- **Multi-Session-Support**: Separate User- und Gast-Sessions
- **Database-per-Session**: Vollständige Datenisolation pro User/Gast
- **Environment-Detection**: Automatische Development/Production-Konfiguration
- **Cookie-based Authentication**: Sichere Session-Verwaltung
- **RESTful API**: Vollständiges CRUD für Todos
- **Auto-Pool-Management**: Dynamische Database-Connection-Pools

## 🏗️ Architecture

### Database-Design

- **User Database** (`notes_users_dev`): Zentrale User-Verwaltung
- **Session Databases**: Jeder User/Gast erhält eigene Todo-Database
- **Connection-Pooling**: Separate Pools für Core/User/Guest-Operations

### Session-Management

- **User-Sessions**: Persistent mit bcrypt-Authentication
- **Guest-Sessions**: Temporär mit UUID-basierten Datenbanken
- **Session-Isolation**: Strikte Trennung zwischen User- und Gast-Daten

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MariaDB/MySQL Server
- Git

### Installation

```bash
# Repository klonen
git clone [repository-url]
cd restful-notes-user-session-backend

# Dependencies installieren
npm install

# Development-Datenbank einrichten
npm run dev:db

# Development-Server starten
npm run dev
```

Die API ist dann verfügbar unter: **http://127.0.0.1:3000**

> 💡 **Full-Stack Development**: Das zugehörige [Frontend](../restful-notes-user-session-frontend) startet automatisch auf `127.0.0.1:5501` und verbindet sich mit diesem Backend.

## 🔧 Environment Configuration

### Development (`.env.development`)

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=notes_dev
DB_USERS=notes_users_dev
PORT=3000
NODE_ENV=development
DEBUG=true
LOG_LEVEL=verbose
```

### Production (`.env`)

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=derBenutzer
DB_PASSWORD=desBenutzersPasswort
DB_NAME=RESTful-API-notes
DB_USERS=notes_users
PORT=3000
NODE_ENV=production
```

### Automatische Environment-Detection

Das System erkennt automatisch die Umgebung basierend auf:

- `NODE_ENV` Environment Variable
- Database-Host (127.0.0.1/localhost = Development)
- Dateipfad-Pattern (/home/, /Users/ = Development)

## 📡 API Endpoints

### Authentication

```
POST /api/register       # User-Registrierung + eigene DB
POST /api/login          # User-Login + Cookie-Session
POST /api/logout         # Cookie-Clearing
```

### Session-Management

```
POST /api/session/guest     # Gast-Session starten
GET  /api/session/validate  # Session-Validierung
POST /api/session/guest/end # Gast-Session beenden
```

### Todos (CRUD)

```
GET    /api/todos        # Alle Todos der Session
GET    /api/todos/:id    # Einzelnes Todo
POST   /api/todos        # Neues Todo erstellen
PATCH  /api/todos/:id    # Todo teilweise updaten
DELETE /api/todos/:id    # Todo löschen
```

## 🛠️ Development

### NPM Scripts

```bash
npm run dev      # Development mit Auto-Reload
npm run dev:db   # Database-Setup für Development
npm start        # Production-Server
npm run prod     # Explicit Production-Mode
```

### Database-Management

- **Automatische DB-Erstellung**: User- und Gast-DBs werden on-demand erstellt
- **Pool-Management**: Connection-Pools werden automatisch verwaltet
- **Session-Cleanup**: Beendete Sessions räumen ihre Pools auf

### Debugging

```bash
# MariaDB-Status prüfen
sudo systemctl status mariadb

# Development-Logs anzeigen
npm run dev  # Zeigt debugLog/infoLog in Console

# Database-Inhalt prüfen
mysql -u root -p notes_users_dev -e "SELECT * FROM users;"
```

## 🔐 Security Features

### Authentication

- **bcrypt Password Hashing**: 10 Rounds für sichere Passwort-Speicherung
- **SQL-Injection Prevention**: Prepared Statements für alle Queries
- **Session-Isolation**: Database-per-Session für vollständige Datentrennung

### Cookie-Management

- **Environment-aware Cookies**: Development vs Production Settings
- **httpOnly=false**: Für Frontend-Zugriff auf Session-Daten
- **Secure Cookies**: Nur über HTTPS in Production
- **Domain-Restriction**: Production-Cookies beschränkt auf .dev2k.org

### CORS-Configuration

- **Development**: Alle lokalen Ports (5500, 5501, 8000, 8080)
- **Production**: Nur vertrauenswürdige Domains
- **Credentials**: true für Cookie-Support

## 🗄️ Database Schema

### Users Database

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  db_name VARCHAR(255) NOT NULL,
  created BIGINT
);
```

### Todos Database (pro Session)

```sql
CREATE TABLE todos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created BIGINT,
  updated BIGINT,
  completed TINYINT
);
```

## 🚀 Production Deployment

### Environment Setup

1. **MariaDB**: Production-Database einrichten
2. **Environment**: `.env`-Datei mit Production-Credentials
3. **CORS**: Frontend-Domain in CORS_ORIGINS eintragen
4. **SSL**: HTTPS für secure Cookies aktivieren

### Performance Optimization

- **Connection-Pooling**: Optimierte Pool-Limits für Production
- **Logging**: Error-only Logging für Performance
- **Database-Cleanup**: Automatisches Cleanup für Gast-Sessions

## 🤝 Development Guidelines

### Code-Standards

- **ES6 Modules**: Import/Export statt CommonJS
- **Environment-Detection**: Automatische Development/Production-Switches
- **Error-Handling**: Try/catch mit Environment-spezifischem Logging
- **Database-Patterns**: Pool-Management mit Lifecycle-Cleanup

### Neue Features hinzufügen

1. **Router**: Neue Endpoints in `routing/` erstellen
2. **Middleware**: Pool-Assignment für neue Routes nutzen
3. **Environment**: Configs in `config/environment.js` ergänzen
4. **Testing**: API-Tests mit Thunder Client/Postman

## 📚 Related Projects

### 🎨 Frontend Application

**[RESTful Notes Frontend →](../restful-notes-user-session-frontend)**

- **Technologie**: Vanilla JavaScript SPA mit Function Constructor Pattern
- **Features**: Automatische Environment-Detection, Cookie-based Sessions
- **Live Demo**: Direkt mit VS Code Live Server startbar
- **Dokumentation**: [Frontend README](../restful-notes-user-session-frontend/README.md)

### 📦 Full-Stack Setup

```bash
# Beide Repositories parallel einrichten
git clone [main-repository]
cd restful-notes-user-session-mariadb

# Backend starten
cd restful-notes-user-session-backend
npm install && npm run dev:db && npm run dev

# Frontend starten (neues Terminal)
cd ../restful-notes-user-session-frontend
# Live Server auf 127.0.0.1:5501 starten
```

### 🔗 Development Links

- **Frontend Development**: http://127.0.0.1:5501
- **Backend API**: http://127.0.0.1:3000/api
- **API Documentation**: Siehe Frontend README für vollständige Endpoint-Liste
- **Debugging Tools**: Frontend beinhaltet `test-cookies.html` und `test-direct.html`

## 🐛 Troubleshooting

### Database-Probleme

```bash
# MariaDB starten
sudo systemctl start mariadb

# Connection testen
mysql -u root -p -e "SELECT 1;"

# User-Permissions prüfen
mysql -u root -p -e "SHOW GRANTS FOR 'root'@'localhost';"
```

### Cookie-Probleme

- **Development**: Cookies zwischen 127.0.0.1:5501 ↔ 127.0.0.1:3000
- **Production**: Domain-restricted Cookies (.dev2k.org)
- **Browser**: Moderne Browser blockieren unsichere Cookies

### Environment-Detection

- **Check**: Welches Environment wird erkannt?
- **Override**: `NODE_ENV=production` für explizite Steuerung
- **Logs**: `debugLog()` zeigt Environment-Detection Details

---

**Entwickelt mit ❤️ für moderne Full-Stack Development**
