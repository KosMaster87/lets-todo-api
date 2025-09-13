// routing/todosRouter.js
import { Router } from "express";

const router = Router();

/**
 * GET /api/todos - Alle Todos des aktuellen Users/Gasts abrufen
 * Sortierung: Unerledigte zuerst, dann nach Update-Zeit
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await req.pool.query(
      `SELECT * FROM todos ORDER BY completed ASC, updated DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/todos/:id - Einzelnes Todo abrufen
 * @param {string} req.params.id - Todo-ID
 */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await req.pool.query(`SELECT * FROM todos WHERE id = ?`, [
      req.params.id,
    ]);
    if (!rows.length)
      return res.status(404).json({ message: "Todo nicht gefunden" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/todos - Neues Todo erstellen
 * @param {Object} req.body - Todo-Daten
 * @param {string} req.body.title - Todo-Titel (erforderlich)
 * @param {string} [req.body.description] - Todo-Beschreibung
 * @param {number} [req.body.completed] - Erledigt-Status (0/1)
 */
router.post("/", async (req, res) => {
  const { title, description = "", completed = 0 } = req.body;
  const timestamp = Date.now();
  try {
    const [result] = await req.pool.query(
      `INSERT INTO todos (title, description, created, updated, completed) VALUES (?, ?, ?, ?, ?)`,
      [title, description, timestamp, timestamp, completed]
    );
    res.status(201).json({
      id: result.insertId,
      title,
      description,
      created: timestamp,
      updated: timestamp,
      completed,
      message: "Todo erfolgreich erstellt",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/todos/:id - Todo teilweise aktualisieren
 * Unterstützt partielle Updates mit COALESCE-Strategie
 *
 * @example
 * PATCH /api/todos/5
 * { "title": "Neuer Titel" }  → Nur Titel wird geändert
 *
 * @example
 * PATCH /api/todos/5
 * { "completed": 1 }          → Nur Status wird geändert
 *
 * @param {string} req.params.id - Todo-ID
 * @param {Object} req.body - Update-Daten (title, description, completed)
 */
router.patch("/:id", async (req, res) => {
  const { title, description, completed } = req.body;

  // Dynamischer SQL-Builder für partielle Updates
  const updates = []; // ["title = COALESCE(?, title)", ...]
  const params = []; // ["Neuer Titel", ...]

  // Nur vorhandene Felder in Update einbeziehen
  if (title !== undefined) {
    updates.push("title = COALESCE(?, title)"); // SQL-Fragment
    params.push(title);
  }
  if (description !== undefined) {
    updates.push("description = COALESCE(?, description)");
    params.push(description);
  }
  if (completed !== undefined) {
    updates.push("completed = COALESCE(?, completed)");
    params.push(completed);
  }

  // Mindestens ein Feld muss für Update vorhanden sein
  if (!updates.length)
    return res.status(400).json({ error: "Keine Update-Daten" });

  // Timestamp immer aktualisieren
  updates.push("updated = ?");
  params.push(Date.now());

  // Todo-ID als letzten Parameter hinzufügen
  params.push(req.params.id);

  // SQL-Query dynamisch zusammenbauen
  const sql = `UPDATE todos SET ${updates.join(", ")} WHERE id = ?`;

  try {
    const [result] = await req.pool.query(sql, params);

    // Prüfen ob Todo existierte
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Todo nicht gefunden" });

    res.json({
      message: "Todo aktualisiert",
      changes: result.affectedRows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/todos/:id - Todo löschen
 * @param {string} req.params.id - Todo-ID
 */
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await req.pool.query(`DELETE FROM todos WHERE id = ?`, [
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Todo nicht gefunden" });
    }
    res.json({
      message: "Todo erfolgreich gelöscht",
      deletedId: req.params.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
