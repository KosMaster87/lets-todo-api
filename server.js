"use strict";

// Basis-URL ohne abschließenden Slash
const API_BASE = "https://api-restful-notes-user-session.dev2k.org/api";

// Entwicklungs-Flag: KORRIGIERT für .dev2k.org als Production-Domain
const IS_PRODUCTION =
window.location.hostname.includes('.dev2k.org');    // Ihre Production-Domain

const IS_DEVELOPMENT =
!IS_PRODUCTION &&                                   // Alles andere als .dev2k.org
(window.location.hostname === 'localhost' ||
window.location.hostname === '127.0.0.1' ||
window.location.search.includes('debug=true') ||    // URL-Parameter für Debug
window.location.port !== '');                        // Hat einen Port = Development

function todoApp() {
    this.container = "";
    this.mode = "guest";
    this.guestStarted = false;
    this.currentTodo = {};
    this.userLoggedIn = false;

    // Helper function to get cookie value - ERWEITERT MIT DOMAIN-INFO
    this.getCookie = function (name) {
        console.log(`🍪 Alle verfügbaren Cookies:`, document.cookie);
        console.log(`🌐 Aktuelle Domain:`, window.location.hostname);
        console.log(`🌐 Aktuelle URL:`, window.location.href);
        console.log(`🍪 Suche nach Cookie: ${name}`);

        // Alle Cookie-Parsing-Varianten probieren
        const allCookies = document.cookie.split(";").map((c) => c.trim());
        console.log(`🍪 Cookie-Array:`, allCookies);

        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            const cookieValue = parts.pop().split(";").shift();
            console.log(`✅ Cookie ${name} gefunden:`, cookieValue);
            return cookieValue;
        }

        // Alternative: direkter Suchversuch
        const altSearch = allCookies.find((cookie) =>
        cookie.startsWith(`${name}=`)
        );
        if (altSearch) {
            const altValue = altSearch.split("=")[1];
            console.log(`✅ Cookie ${name} alternativ gefunden:`, altValue);
            return altValue;
        }

        console.log(`❌ Cookie ${name} nicht gefunden`);
        return null;
    };

    this.init = function () {
        this.container = document.querySelector("#content");
        this.container.innerHTML = "";

        // VEREINFACHT: Nur Session-Validierung verwenden, Cookie-Reading überspringen
        console.log("🚀 App-Start: Direkte Session-Validierung...");

        // Session-Status vom Backend validieren
        this.validateSession()
        .then((response) => {
            console.log("Session-Validierung Antwort:", response);

            if (response.valid) {
                if (response.type === "user") {
                    this.userLoggedIn = true;
                    this.guestStarted = false;
                    // MODE KORRIGIEREN: Bei gültiger Session auf "list" setzen
                    if (this.mode === "guest") this.mode = "list";
                } else if (response.type === "guest") {
                    this.userLoggedIn = false;
                    this.guestStarted = true;
                    // MODE KORRIGIEREN: Bei gültiger Session auf "list" setzen
                    if (this.mode === "guest") this.mode = "list";
                }
            } else {
                this.userLoggedIn = false;
                this.guestStarted = false;
                this.mode = "guest"; // Zurück zu Auth-Optionen
            }

            this.buildUI();
        })
        .catch(() => {
            // Falls Session-Validierung fehlschlägt
            this.userLoggedIn = false;
            this.guestStarted = false;
            this.mode = "guest";
            this.buildUI();
        });
    };

    // Session-Validierung beim Backend - VERBESSERT
    this.validateSession = function () {
        return this.apiHandler(`${API_BASE}/session/validate`, "GET").then(
            (response) => {
                console.log("Session-Validierung:", response);

                if (response.valid) {
                    if (response.type === "user") {
                        this.userLoggedIn = true;
                        this.guestStarted = false;
                    } else if (response.type === "guest") {
                        this.userLoggedIn = false;
                        this.guestStarted = true;
                    }
                } else {
                    this.userLoggedIn = false;
                    this.guestStarted = false;
                }

                return response;
            }
        );
    };

    // Cookies löschen (falls Session ungültig)
    this.clearAllCookies = function () {
        document.cookie =
        "guestId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.api-restful-notes-user-session.dev2k.org";
                    document.cookie =
                    "userId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.api-restful-notes-user-session.dev2k.org";
    };

    // UI aufbauen basierend auf Status
    this.buildUI = function () {
        // Container leeren für UI-Wechsel
        this.container.innerHTML = "";

        // Session-Info anzeigen
        this.showSessionInfo();

        // UI bauen basierend auf Status
        if (!this.userLoggedIn && !this.guestStarted) {
            // Kein Cookie: Menü mit allen drei Optionen
            this.mode = "guest";
            this.printAuthOptions();
        } else if (this.userLoggedIn) {
            // MODE-FIX: Bei gültiger User-Session immer auf "list" setzen, außer explizit "form"
            if (this.mode === "guest") this.mode = "list";

            this.printLogout();

            if (this.mode === "list") {
                this.printBtn();
                this.getAllTodos();
            } else if (this.mode === "form") {
                this.printBtn();
                this.printForm();
            }
        } else if (this.guestStarted) {
            // MODE-FIX: Bei gültiger Gast-Session immer auf "list" setzen, außer explizit "form"
            if (this.mode === "guest") this.mode = "list";

            this.printGuestInfo(); // Gast-spezifische Buttons

            if (this.mode === "list") {
                this.printBtn();
                this.getAllTodos();
            } else if (this.mode === "form") {
                this.printBtn();
                this.printForm();
            }
        }
    };

    this.showSessionInfo = function () {
        const guestCookie = this.getCookie("guestId");
        const userCookie = this.getCookie("userId");

        if (guestCookie && this.guestStarted) {
            this.container.insertAdjacentHTML(
                "beforeend",
                `<p style="font-size:0.8rem; color:#666">Gast-Session: ${guestCookie}</p>`
            );
        } else if (userCookie && this.userLoggedIn) {
            this.container.insertAdjacentHTML(
                "beforeend",
                `<p style="font-size:0.8rem; color:#666">Benutzer-Session: User ${userCookie}</p>`
            );
        }
    };

    // Gast-spezifische Info und Registrierungs-Option
    this.printGuestInfo = function () {
        const html = `
        <div style="text-align:right; margin-bottom:1rem;">
        <button class="btn-todo btn-register-from-guest" id="btn-register-from-guest" style="font-size:0.8rem;">Account erstellen</button>
        <button class="btn-todo btn-end-guest" id="btn-end-guest" style="font-size:0.8rem;">Gast-Session beenden</button>
        </div>
        `;
        this.container.insertAdjacentHTML("beforeend", html);

        // Account erstellen aus Gast-Session
        this.container
        .querySelector("#btn-register-from-guest")
        .addEventListener("click", () => {
            this.printRegisterForm();
        });

        // Gast-Session beenden
        this.container
        .querySelector("#btn-end-guest")
        .addEventListener("click", () => {
            this.apiHandler(`${API_BASE}/session/guest/end`, "POST")
            .then(() => {
                this.guestStarted = false;
                this.userLoggedIn = false;
                this.mode = "guest";
                this.init();
            })
            .catch(console.error);
        });
    };

    this.resetCurrentTodo = function () {
        this.currentTodo = {
            id: 0,
            title: "",
            description: "",
            completed: 0,
        };
    };

    this.changeMode = function (mode) {
        this.mode = mode;
        // NICHT mehr this.init() aufrufen, sondern nur UI neu bauen
        this.buildUI();
    };

    this.printAuthOptions = function () {
        const html = `
        <div style="text-align:center; margin-top:2rem;">
        <button class="btn-todo btn-login" id="btn-login">Login</button>
        <button class="btn-todo btn-register" id="btn-register">Registrieren</button>
        <button class="btn-todo btn-guest" id="btn-guest">Als Gast starten</button>
        </div>
        `;
        this.container.insertAdjacentHTML("beforeend", html);

        // Login-Button
        this.container.querySelector("#btn-login").addEventListener("click", () => {
            this.printLoginForm();
        });

        // Registrieren-Button
        this.container
        .querySelector("#btn-register")
        .addEventListener("click", () => {
            this.printRegisterForm();
        });

        // Gast starten-Button
        this.container.querySelector("#btn-guest").addEventListener("click", () => {
            // Gast-Session anfordern
            this.apiHandler(`${API_BASE}/session/guest`, "POST") // Changed to POST
            .then(() => {
                this.guestStarted = true;
                this.userLoggedIn = false;
                this.mode = "list";
                this.init();
            })
            .catch(console.error);
        });
    };

    this.printLoginForm = function () {
        const html = `
        <form id="login-form" style="margin:2rem auto; max-width:320px;">
        <input type="email" id="login-email" placeholder="Email" required class="form-input-generally form-input" style="margin-bottom:1rem;width:100%;">
        <input type="password" id="login-password" placeholder="Passwort" required class="form-input-generally form-input" style="margin-bottom:1rem;width:100%;">
        <button class="btn-todo" id="btn-login-submit" type="submit">Login</button>
        <button class="btn-todo" id="btn-login-cancel" type="button">Abbrechen</button>
        </form>
        `;
        this.container.innerHTML = html;
        this.container
        .querySelector("#login-form")
        .addEventListener("submit", (e) => {
            e.preventDefault();
            const email = this.container.querySelector("#login-email").value;
            const password = this.container.querySelector("#login-password").value;
            this.apiHandler(`${API_BASE}/login`, "POST", { email, password })
            .then(() => {
                // Nach Login: UI auf Notizliste
                this.userLoggedIn = true;
                this.guestStarted = false;
                this.mode = "list";
                this.init();
            })
            .catch(() => alert("Login fehlgeschlagen"));
        });
        this.container
        .querySelector("#btn-login-cancel")
        .addEventListener("click", () => this.init());
    };

    this.printRegisterForm = function () {
        const html = `
        <form id="register-form" style="margin:2rem auto; max-width:320px;">
        <input type="email" id="register-email" placeholder="Email" required class="form-input-generally form-input" style="margin-bottom:1rem;width:100%;">
        <input type="password" id="register-password" placeholder="Passwort" required class="form-input-generally form-input" style="margin-bottom:1rem;width:100%;">
        <button class="btn-todo" id="btn-register-submit" type="submit">Registrieren</button>
        <button class="btn-todo" id="btn-register-cancel" type="button">Abbrechen</button>
        </form>
        `;
        this.container.innerHTML = html;
        this.container
        .querySelector("#register-form")
        .addEventListener("submit", (e) => {
            e.preventDefault();
            const email = this.container.querySelector("#register-email").value;
            const password =
            this.container.querySelector("#register-password").value;
            this.apiHandler(`${API_BASE}/register`, "POST", { email, password })
            .then(() => {
                alert("Registrierung erfolgreich! Jetzt einloggen.");
                this.printLoginForm();
            })
            .catch((err) => {
                // Fehlerbehandlung für 409 Conflict (E-Mail bereits registriert)
                if (err && err.message && err.message.includes("409")) {
                    this.showError("Diese E-Mail ist bereits registriert.");
                } else {
                    this.showError("Registrierung fehlgeschlagen.");
                }
            });
        });
        this.container
        .querySelector("#btn-register-cancel")
        .addEventListener("click", () => this.init());
    };

    this.printLogout = function () {
        const html = `
        <div style="text-align:right;">
        <button class="btn-todo btn-logout" id="btn-logout">Logout</button>
        </div>
        `;
        this.container.insertAdjacentHTML("afterbegin", html);
        this.container
        .querySelector("#btn-logout")
        .addEventListener("click", () => {
            this.apiHandler(`${API_BASE}/logout`, "POST").then(() => {
                this.userLoggedIn = false;
                this.mode = "guest";
                this.guestStarted = false;
                this.init();
            });
        });
    };

    // ============================================================

    this.printBtn = function () {
        // "Neues Todo" oder "Zurück"-Button je nach Modus
        if (this.mode === "list") {
            const html = `<div><button class="btn-todo btn-todo-add" id="btn-todo-add">Todo anlegen</button></div>`;
            this.container.insertAdjacentHTML("beforeend", html);
            this.container
            .querySelector("#btn-todo-add")
            .addEventListener("click", (e) => {
                e.preventDefault();
                this.resetCurrentTodo();
                // DIREKT changeMode aufrufen ohne preventDefault
                this.changeMode("form");
            });
        } else if (this.mode === "form") {
            const html = `<div><button class="btn-todo btn-todo-back" id="btn-todo-back">Zurück zur Todo-Liste</button></div>`;
            this.container.insertAdjacentHTML("beforeend", html);
            this.container
            .querySelector("#btn-todo-back")
            .addEventListener("click", (e) => {
                e.preventDefault();
                this.resetCurrentTodo();
                this.changeMode("list");
            });
        }
    };

    // ============================================================

    this.printTodo = function (todo) {
        const html = `
        <div class="todo-item-wrapper" id="todo-item-${todo.id}">
        <div class="todo-item">
        <div class="form-check">
        <input class="form-check-input" type="checkbox" id="todo-${
            todo.id
        }-check" ${todo.completed == 1 ? "checked" : ""} />
        <label class="form-check-label ${
            todo.completed == 1 ? "todo-item-completed" : ""
        }"
        id="todo-${todo.id}-check-label" for="todo-${todo.id}-check">
        ${todo.title}
        </label>
        </div>
        <div class="icon-wrapper">
        <img src="assets/img/edit_note.svg" class="note-icon note-edit" id="note-edit-${
            todo.id
        }" title="bearbeiten" />
        <img src="assets/img/delete_note.svg" class="note-icon note-delete" id="note-delete-${
            todo.id
        }" title="löschen" />
        </div>
        </div>
        </div>
        `;
        this.container.insertAdjacentHTML("beforeend", html);

        // Checkbox-Handler
        this.container
        .querySelector(`#todo-${todo.id}-check`)
        .addEventListener("change", (e) => {
            e.preventDefault();
            this.updateTodo({
                id: todo.id,
                completed: e.target.checked ? 1 : 0,
            }).then(() => {
                this.container
                .querySelector(`#todo-${todo.id}-check-label`)
                .classList.toggle("todo-item-completed", e.target.checked);
            });
        });

        // Bearbeiten
        this.container
        .querySelector(`#note-edit-${todo.id}`)
        .addEventListener("click", () => {
            this.getTodo(todo).then((json) => {
                this.currentTodo = json;
                this.changeMode("form");
            });
        });

        // Löschen
        this.container
        .querySelector(`#note-delete-${todo.id}`)
        .addEventListener("click", () => {
            this.deleteTodo(todo).then(() => {
                this.container.querySelector(`#todo-item-${todo.id}`).remove();
            });
        });
    };

    // ============================================================

    this.printForm = function () {
        const html = `
        <div class="todo-item-wrapper">
        <form class="todo-form" id="todo-form">
        <div class="form-group">
        <label for="todo-title">Titel*</label>
        <input class="form-input-generally form-input" id="todo-title" type="text" name="title" required placeholder="Was ist zu tun?" value="${
            this.currentTodo.title
        }" />
        </div>
        <div class="form-group">
        <label for="todo-description">Beschreibung</label>
        <textarea class="form-input-generally form-textarea" id="todo-description" name="description" rows="3" placeholder="Details (optional)">${
            this.currentTodo.description
        }</textarea>
        </div>
        <div class="form-group form-checkbox">
        <input class="form-checkbox-input" id="todo-completed" type="checkbox" name="completed" ${
            this.currentTodo.completed == 1 ? "checked" : ""
        } />
        <label for="todo-completed">Erledigt</label>
        </div>
        <div class="form-actions">
        <button class="btn-todo btn-todo-submit" id="btn-todo-submit" type="submit" disabled data-id="${
            this.currentTodo.id
        }">Speichern</button>
        ${
            this.currentTodo.id === 0
            ? `<button class="btn-todo btn-todo-submit" id="todo-submit-next" type="submit" disabled data-id="${this.currentTodo.id}">Speichern ++</button>`
            : ""
        }
        </div>
        </form>
        </div>
        `;
        this.container.insertAdjacentHTML("beforeend", html);

        // Save und Next-Handler
        this.container
        .querySelector("#btn-todo-submit")
        .addEventListener("click", (e) => this.saveTodoHandler(e));
        if (this.currentTodo.id === 0) {
            this.container
            .querySelector("#todo-submit-next")
            .addEventListener("click", (e) => this.saveTodoHandler(e, "next"));
        }

        // Formularvalidierung
        setupFormValidation(
            this.container.querySelector("#todo-title"),
                            this.container.querySelector("#btn-todo-submit"),
                            this.currentTodo.id === 0
                            ? this.container.querySelector("#todo-submit-next")
                            : null
        );
    };

    // ============================================================

    this.saveTodoHandler = function (event, mode = "save") {
        event.preventDefault();
        const title = this.container.querySelector("#todo-title").value;
        const description = this.container.querySelector("#todo-description").value;
        const completed = this.container.querySelector("#todo-completed").checked;

        const todo = {
            id: parseInt(event.target.dataset.id),
            title,
            description,
            completed: completed ? 1 : 0,
        };

        if (todo.id > 0) {
            this.updateTodo(todo).then(() => this.changeMode("list"));
        } else if (mode === "save") {
            this.createTodo(todo).then(() => this.changeMode("list"));
        } else {
            this.createTodo(todo).then(() => {
                this.resetCurrentTodo();
                this.changeMode("form");
            });
        }
    };

    // ============================================================

    this.getAllTodos = function () {
        this.apiHandler(`${API_BASE}/todos`, "GET").then((json) => {
            json.forEach((t) => this.printTodo(t));
        });
    };

    this.getTodo = (data) =>
    this.apiHandler(`${API_BASE}/todos/${data.id}`, "GET");

    this.createTodo = (data) =>
    this.apiHandler(`${API_BASE}/todos`, "POST", data);

    this.updateTodo = (data) =>
    this.apiHandler(`${API_BASE}/todos/${data.id}`, "PATCH", data);

    this.deleteTodo = (data) =>
    this.apiHandler(`${API_BASE}/todos/${data.id}`, "DELETE", data);

    // ============================================================
    // API handler mit verbesserter Fehlerbehandlung
    this.apiHandler = function (url, method, data = null) {
        url = url.replace(/([^:]\/)\/+/g, "$1");

        const options = {
            method,
            cache: "no-cache",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
        };
        if (data !== null) options.body = JSON.stringify(data);

        // Logging nur in echten Development-Umgebungen
        if (IS_DEVELOPMENT) {
            console.log(`🔗 API ${method} ${url}`, data || '(keine Daten)');
        }

        return fetch(url, options)
        .then((res) => {
            if (!res.ok) {
                // Fehlertext für spezielle Fehlercodes extrahieren
                return res
                .json()
                .then((json) => {
                    const error = new Error("Netzwerkantwort war nicht ok");
                    error.status = res.status;
                    error.apiMessage =
                    json && json.error ? json.error : json.message || "";
                    throw error;
                })
                .catch(() => {
                    // Falls JSON-Parsing fehlschlägt
                    const error = new Error("Netzwerkantwort war nicht ok");
                    error.status = res.status;
                    error.apiMessage = `HTTP ${res.status} ${res.statusText}`;
                    throw error;
                });
            }
            return res.json();
        })
        .catch((err) => {
            console.error("Fehler bei API-Anfrage:", err, "URL:", url);

            // Session-Validierung: keine UI-Fehlermeldung
            if (url.includes("/session/validate")) {
                throw err;
            }

            // Fehler auch im UI anzeigen für andere Endpoints
            if (err.status === 409) {
                this.showError("Diese E-Mail ist bereits registriert.");
            } else if (err.status === 401) {
                this.showError("Session ungültig. Bitte neu anmelden.");
            } else if (err.apiMessage) {
                this.showError(err.apiMessage);
            } else {
                this.showError(
                    "Fehler bei der Serveranfrage. Bitte später erneut versuchen."
                );
            }
            throw err;
        });
    };

    // Fehleranzeige im UI (optional)
    this.showError = function (msg) {
        let errorDiv = this.container.querySelector(".todo-error");
        if (!errorDiv) {
            errorDiv = document.createElement("div");
            errorDiv.className = "todo-error";
            errorDiv.style.color = "red";
            errorDiv.style.margin = "1rem 0";
            this.container.insertAdjacentElement("afterbegin", errorDiv);
        }
        errorDiv.textContent = msg;
    };
}

// DOM ready
document.addEventListener("DOMContentLoaded", () => {
    const todoAppInstance = new todoApp();
    todoAppInstance.init();
});

/**
 * Form Validation for title input
 */
function setupFormValidation(titleInput, submitBtn, submitNextBtn = null) {
    function toggle() {
        const empty = titleInput.value.trim() === "";
        submitBtn.disabled = empty;
        if (submitNextBtn) submitNextBtn.disabled = empty;
    }
    titleInput.addEventListener("input", toggle);
    toggle();
}
