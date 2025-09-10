# Development Setup Guide

## MariaDB Installation auf Fedora

```bash
# 1. MariaDB installieren
sudo dnf install mariadb mariadb-server

# 2. MariaDB Service starten
sudo systemctl start mariadb
sudo systemctl enable mariadb

# 3. MariaDB Security Setup (optional, aber empfohlen)
sudo mysql_secure_installation
# - Root-Passwort setzen (oder leer lassen für Development)
# - Anonyme User entfernen: Y
# - Root remote login verbieten: Y
# - Test-Datenbank entfernen: Y

# 4. Test der Verbindung
mysql -u root -p
# Wenn kein Passwort gesetzt: mysql -u root
```

## Development Workflow

```bash
# 1. Ins Backend-Verzeichnis
cd lets-todo-api

# 2. Dependencies installieren
npm install

# 3. Development-Datenbank einrichten
npm run dev:db

# 4. Development-Server starten
npm run dev
```

## Environment-Files

### Development (.env.development)

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=todos_main_dev
DB_USERS=todos_users_dev
PORT=3000
NODE_ENV=development
```

### Production (.env)

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=derBenutzer
DB_PASSWORD=desBenutzersPasswort
DB_NAME=todos_main
DB_USERS=todos_users
NODE_ENV=production
```

## Automatische Environment-Detection

Das System erkennt automatisch:

- **Development**: NODE_ENV=development ODER lokale Pfade
- **Production**: Deployment auf Server
- **Staging**: NODE_ENV=staging

## Port-Konfiguration

- **Development**: http://127.0.0.1:3000
- **Production**: Ihr Deployment-Server

## Troubleshooting

### MariaDB startet nicht

```bash
sudo systemctl status mariadb
sudo journalctl -u mariadb
```

### Verbindung verweigert

```bash
# Prüfen ob MariaDB läuft
sudo systemctl status mariadb

# Prüfen welche Ports offen sind
sudo netstat -tlnp | grep :3306

# MariaDB-Log prüfen
sudo tail -f /var/log/mariadb/mariadb.log
```

### Permission-Probleme

```sql
-- Als root in MariaDB
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
```
