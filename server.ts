import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("tasks.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'moderate',
    due_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS task_projects (
    task_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    section_id INTEGER,
    PRIMARY KEY (task_id, project_id),
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'slate',
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    subtask_id INTEGER,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (subtask_id) REFERENCES subtasks (id) ON DELETE CASCADE
  );
`);

// Seed default data if empty
const teamCount = db.prepare("SELECT COUNT(*) as count FROM teams").get() as { count: number };
if (teamCount.count === 0) {
  const teamInfo = db.prepare("INSERT INTO teams (name) VALUES (?)").run("Personal");
  db.prepare("INSERT INTO projects (team_id, name, description) VALUES (?, ?, ?)")
    .run(teamInfo.lastInsertRowid, "General", "Default project for miscellaneous tasks");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Teams API
  app.get("/api/teams", (req, res) => {
    const teams = db.prepare("SELECT * FROM teams ORDER BY name ASC").all();
    res.json(teams);
  });

  app.post("/api/teams", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const info = db.prepare("INSERT INTO teams (name) VALUES (?)").run(name);
    res.status(201).json(db.prepare("SELECT * FROM teams WHERE id = ?").get(info.lastInsertRowid));
  });

  // Projects API
  app.get("/api/projects", (req, res) => {
    const { team_id } = req.query;
    let projects;
    if (team_id) {
      projects = db.prepare("SELECT * FROM projects WHERE team_id = ? ORDER BY name ASC").all(team_id);
    } else {
      projects = db.prepare("SELECT * FROM projects ORDER BY name ASC").all();
    }
    res.json(projects);
  });

  app.post("/api/projects", (req, res) => {
    const { team_id, name, description } = req.body;
    if (!team_id || !name) return res.status(400).json({ error: "team_id and name are required" });
    const info = db.prepare("INSERT INTO projects (team_id, name, description) VALUES (?, ?, ?)")
      .run(team_id, name, description || "");
    res.status(201).json(db.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid));
  });

  // API Routes
  app.get("/api/tasks", (req, res) => {
    const { project_id } = req.query;
    let tasks;
    if (project_id) {
      tasks = db.prepare(`
        SELECT t.* FROM tasks t
        JOIN task_projects tp ON t.id = tp.task_id
        WHERE tp.project_id = ?
        ORDER BY t.created_at DESC
      `).all(project_id);
    } else {
      tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
    }

    // Hydrate tasks with project_ids, subtasks, and attachments
    const hydratedTasks = tasks.map((task: any) => {
      const projectAssignments = db.prepare("SELECT project_id, section_id FROM task_projects WHERE task_id = ?").all(task.id);
      const projectIds = projectAssignments.map((p: any) => p.project_id);
      const sectionAssignments = projectAssignments.reduce((acc: any, p: any) => {
        acc[p.project_id] = p.section_id;
        return acc;
      }, {});

      const subtasks = db.prepare("SELECT * FROM subtasks WHERE task_id = ?").all(task.id).map((st: any) => {
        const stAttachments = db.prepare("SELECT * FROM attachments WHERE subtask_id = ?").all(st.id);
        return { ...st, attachments: stAttachments };
      });
      const attachments = db.prepare("SELECT * FROM attachments WHERE task_id = ? AND subtask_id IS NULL").all(task.id);
      return { ...task, project_ids: projectIds, section_assignments: sectionAssignments, subtasks, attachments };
    });

    res.json(hydratedTasks);
  });

  app.post("/api/tasks", (req, res) => {
    const { title, description, priority, due_date, project_ids, section_id } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    
    const insertTask = db.transaction(() => {
      const info = db.prepare(
        "INSERT INTO tasks (title, description, priority, due_date) VALUES (?, ?, ?, ?)"
      ).run(title, description || "", priority || "moderate", due_date || null);
      
      const taskId = info.lastInsertRowid;
      
      if (project_ids && Array.isArray(project_ids)) {
        const stmt = db.prepare("INSERT INTO task_projects (task_id, project_id, section_id) VALUES (?, ?, ?)");
        for (const pid of project_ids) {
          // If a section_id is provided, we use it for the primary project (first in list)
          // or if it's explicitly for this project. For now, apply to all selected projects if provided.
          stmt.run(taskId, pid, section_id || null);
        }
      }
      
      return taskId;
    });

    const taskId = insertTask();
    const newTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
    res.status(201).json(newTask);
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { title, description, status, priority, due_date, project_ids, section_id, current_project_id } = req.body;
    
    const updateTask = db.transaction(() => {
      const updates: string[] = [];
      const values: any[] = [];

      if (title !== undefined) { updates.push("title = ?"); values.push(title); }
      if (description !== undefined) { updates.push("description = ?"); values.push(description); }
      if (status !== undefined) { updates.push("status = ?"); values.push(status); }
      if (priority !== undefined) { updates.push("priority = ?"); values.push(priority); }
      if (due_date !== undefined) { updates.push("due_date = ?"); values.push(due_date); }
      
      updates.push("updated_at = CURRENT_TIMESTAMP");

      if (updates.length > 1) {
        values.push(id);
        const sql = `UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`;
        db.prepare(sql).run(...values);
      }

      if (project_ids && Array.isArray(project_ids)) {
        // Keep existing section assignments if possible
        const existing = db.prepare("SELECT project_id, section_id FROM task_projects WHERE task_id = ?").all(id);
        const sectionMap = existing.reduce((acc: any, p: any) => { acc[p.project_id] = p.section_id; return acc; }, {});

        db.prepare("DELETE FROM task_projects WHERE task_id = ?").run(id);
        const stmt = db.prepare("INSERT INTO task_projects (task_id, project_id, section_id) VALUES (?, ?, ?)");
        for (const pid of project_ids) {
          stmt.run(id, pid, sectionMap[pid] || null);
        }
      }

      if (section_id !== undefined && current_project_id !== undefined) {
        db.prepare("UPDATE task_projects SET section_id = ? WHERE task_id = ? AND project_id = ?")
          .run(section_id, id, current_project_id);
      }
    });

    try {
      updateTask();
      const updatedTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
      res.json(updatedTask);
    } catch (e) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Subtasks API
  app.post("/api/subtasks", (req, res) => {
    const { task_id, title } = req.body;
    if (!task_id || !title) return res.status(400).json({ error: "task_id and title are required" });
    const info = db.prepare("INSERT INTO subtasks (task_id, title) VALUES (?, ?)").run(task_id, title);
    res.status(201).json(db.prepare("SELECT * FROM subtasks WHERE id = ?").get(info.lastInsertRowid));
  });

  app.patch("/api/subtasks/:id", (req, res) => {
    const { id } = req.params;
    const { title, status } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (title !== undefined) { updates.push("title = ?"); values.push(title); }
    if (status !== undefined) { updates.push("status = ?"); values.push(status); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    db.prepare(`UPDATE subtasks SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    res.json(db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id));
  });

  app.delete("/api/subtasks/:id", (req, res) => {
    db.prepare("DELETE FROM subtasks WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  // Attachments API
  app.post("/api/attachments", (req, res) => {
    const { task_id, subtask_id, name, url } = req.body;
    if (!name || !url) return res.status(400).json({ error: "name and url are required" });
    const info = db.prepare("INSERT INTO attachments (task_id, subtask_id, name, url) VALUES (?, ?, ?, ?)")
      .run(task_id || null, subtask_id || null, name, url);
    res.status(201).json(db.prepare("SELECT * FROM attachments WHERE id = ?").get(info.lastInsertRowid));
  });

  app.delete("/api/attachments/:id", (req, res) => {
    db.prepare("DELETE FROM attachments WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  // Sections API
  app.get("/api/sections", (req, res) => {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: "project_id is required" });
    const sections = db.prepare("SELECT * FROM sections WHERE project_id = ? ORDER BY order_index ASC").all(project_id);
    res.json(sections);
  });

  app.post("/api/sections", (req, res) => {
    const { project_id, name, color } = req.body;
    if (!project_id || !name) return res.status(400).json({ error: "project_id and name are required" });
    const info = db.prepare("INSERT INTO sections (project_id, name, color) VALUES (?, ?, ?)")
      .run(project_id, name, color || "slate");
    res.status(201).json(db.prepare("SELECT * FROM sections WHERE id = ?").get(info.lastInsertRowid));
  });

  app.patch("/api/sections/:id", (req, res) => {
    const { id } = req.params;
    const { name, color, order_index } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (color !== undefined) { updates.push("color = ?"); values.push(color); }
    if (order_index !== undefined) { updates.push("order_index = ?"); values.push(order_index); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    db.prepare(`UPDATE sections SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    res.json(db.prepare("SELECT * FROM sections WHERE id = ?").get(id));
  });

  app.delete("/api/sections/:id", (req, res) => {
    db.prepare("DELETE FROM sections WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(204).send();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
