<!-- copilot-instructions.md -->

# Copilot Instructions für dieses Projekt

## Allgemeine Vorgaben
- Schreibe alle Kommentare und Fehlermeldungen auf Deutsch.
- Halte dich an die bestehende Struktur und Syntax der vorhandenen Dateien.
- Nutze ES6+ Syntax (import/export, async/await, Destructuring).
- Verwende keine externen Frameworks außer express, mysql2, dotenv, cors, cookie-parser und uuid.

## Code-Stil
- Einrückung: 2 Leerzeichen.
- Semikolons am Zeilenende verwenden.
- Strings bevorzugt mit doppelten Anführungszeichen (`"`).
- Funktions- und Variablennamen im camelCase.
- Konstanten in GROSSBUCHSTABEN nur, wenn sie wirklich konstant sind.

## Architektur
- Jeder Gast bekommt eine eigene Datenbank, die nach dem Muster `notes_guest_<guestId>` benannt ist.
- Die Datenbankverbindung für den aktuellen Gast liegt immer in `req.pool`.
- Schreibe keine globalen Variablen, außer sie sind für das Pool-Management notwendig.

## Sicherheit & Best Practices
- Keine sensiblen Daten loggen.
- Keine SQL-Injektionen: Immer Parameterbindung verwenden (`?`-Platzhalter).
- Input-Validierung für alle POST/PATCH-Routen (z. B. express-validator vorschlagen).
- Cookies immer mit `httpOnly`, `secure` und `sameSite` setzen.

## Tests & Fehlerbehandlung
- Jede neue Route sollte einen sinnvollen Fehlerfall behandeln (404, 400, 500).
- Schreibe Unit-Tests für neue Funktionen, wenn möglich.

## Sonstiges
- Schreibe kurze, prägnante Commit-Messages auf Deutsch.
- Dokumentiere neue Umgebungsvariablen in einer `.env.example`.

---

# Copilot Instructions - RESTful Guest Access API

## 📦 Architektur
```javascript
DB_PER_GUEST: true          # Separate DB pro Gast (UUID-basiert)
POOL_MANAGEMENT: dynamic    # Dynamische Pool-Erstellung + Caching
TIMESTAMP_FORMAT: unix_millis # BIGINT statt DATETIME
COOKIE_ID_STRATEGY: uuidv4  # UUIDv4 als Gast-Identifier
```

## 🔒 CORS
```javascript
{
  "origin": [
    "https://app-restful-guest-access.dev2k.org"
  ],
  "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  "credentials": true
}
```

## 🍪 Cookies
```javascript
{
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  domain: "restful-guest-access.dev2k.space",
  maxAge: 604800000,  // 7 Tage
  path: "/"
}
```

## 💾 Datenbank
# Tabellenschema (todos)
```sql
CREATE TABLE IF NOT EXISTS todos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created BIGINT,   -- Unix-Zeit in Millisekunden
  updated BIGINT,   -- Unix-Zeit in Millisekunden
  completed TINYINT -- 0 = false, 1 = true
);
```
# Verbindungspools
```javascript
Core-Pool:
  purpose: Datenbank-Verwaltung (DDL)
  connectionLimit: 10
  database: none

Guest-Pools:
  purpose: Gast-Datenbankzugriffe
  connectionLimit: 5 pro Gast
  storage: guestPools Objekt (key = guestId)
```

## 👨‍💻 Code-Richtlinien
# Middleware-Order
```javascript
express.json() - Body Parsing
cookieParser() - Cookie Handling
cors() - Cross-Origin Policy
Custom Auth- & DB-Provisionierung (User- oder Gast-DB)
Routes
```

# Fehlerbehandlung
# Pattern: unified_json_error
```javascript
// Erfolg
res.json(data)

// Client-Fehler (4xx)
res.status(404).json({ message: "Nicht gefunden" })

// Server-Fehler (5xx)
res.status(500).json({ error: err.message })
```

# Update-Logik
# PATCH-Strategie: coalesce_partial_update
```javascript
// Beispiel-Implementation
const updates = [];
const params = [];

if (req.body.title !== undefined) {
  updates.push("title = COALESCE(?, title)");
  params.push(req.body.title);
}

// Immer updated setzen
updates.push("updated = ?");
params.push(Date.now());

const sql = `UPDATE todos SET ${updates.join(', ')} WHERE id = ?`;
```

## 🛣️ Routen-Spezifikation
```javascript
GET    /api/todos      - Alle Todos laden
GET    /api/todos/:id  - Einzelnes Todo
POST   /api/todos      - Todo erstellen
PATCH  /api/todos/:id  - Todo teilweise aktualisieren
DELETE /api/todos/:id  - Todo löschen
```

## ⚙️ Umgebungsvariablen
```env
PORT=3000
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=db-user
DB_PASSWORD=db-password
```

## 🚧 Tech Debt & Optimierungen
```PlainText
- [ ] **Input-Validierung**:  
      `express-validator` für alle POST/PATCH-Routen
- [ ] **Zeitstempel-Format**:  
      BIGINT vs. DATETIME evaluieren
- [ ] **Idempotenz**:  
      PUT-Endpoints für idempotente Updates
- [ ] **Pool-Cleaning**:  
      Inaktive Pools nach 30min bereinigen
- [ ] **Sicherheit**:  
      Rate-Limiting für POST-Routen
```

## 📜 Lizenz & Style
```javascript
Comment-Style: German + English mix
Error-Messages: Deutsch in Responses
License: MIT
```

## User-Accounts
- Jeder registrierte User bekommt eine eigene Datenbank: `notes_user_<userId>`
- Registrierung: `POST /api/register` (email, password)
- Login:        `POST /api/login` (email, password)
- Passwort als Hash speichern (bcrypt)
- Nach Login: Setze httpOnly, secure Cookie mit userId
- Middleware prüft: userId-Cookie → User-DB, sonst Gast-DB

## Neue Routen
```javascript
POST   /api/register   - User registrieren (E-Mail, Passwort)
POST   /api/login      - Login (E-Mail, Passwort)
POST   /api/logout     - Logout (Cookie löschen)
```

