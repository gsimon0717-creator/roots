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
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
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
    key_result TEXT,
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

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    subtask_id INTEGER,
    content TEXT NOT NULL,
    attachment_name TEXT,
    attachment_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (subtask_id) REFERENCES subtasks (id) ON DELETE CASCADE
  );
`);

// Migration: Add key_result to tasks if not exists
try {
  db.prepare("ALTER TABLE tasks ADD COLUMN key_result TEXT").run();
} catch (e) {
  // Column already exists or other error
}

// Migration: Add organization_id to teams if not exists
try {
  db.prepare("ALTER TABLE teams ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE").run();
} catch (e) {
  // Already exists
}

// Seed default data if empty
const orgCount = db.prepare("SELECT COUNT(*) as count FROM organizations").get() as { count: number };
let defaultOrgId: any;
if (orgCount.count === 0) {
  const info = db.prepare("INSERT INTO organizations (name) VALUES (?)").run("Default Organization");
  defaultOrgId = info.lastInsertRowid;
} else {
  const firstOrg = db.prepare("SELECT id FROM organizations LIMIT 1").get() as any;
  defaultOrgId = firstOrg.id;
}

const teamCount = db.prepare("SELECT COUNT(*) as count FROM teams").get() as { count: number };
if (teamCount.count === 0) {
  const teamInfo = db.prepare("INSERT INTO teams (name, organization_id) VALUES (?, ?)").run("Personal", defaultOrgId);
  db.prepare("INSERT INTO projects (team_id, name, description) VALUES (?, ?, ?)")
    .run(teamInfo.lastInsertRowid, "General", "Default project for miscellaneous tasks");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const apiRouter = express.Router();

  // Organizations API
  apiRouter.get("/organizations", (req, res) => {
    const orgs = db.prepare("SELECT * FROM organizations ORDER BY name ASC").all();
    res.json(orgs);
  });

  apiRouter.post("/organizations", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const info = db.prepare("INSERT INTO organizations (name) VALUES (?)").run(name);
    res.status(201).json(db.prepare("SELECT * FROM organizations WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/organizations/:id", (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    db.prepare("UPDATE organizations SET name = ? WHERE id = ?").run(name, id);
    res.json(db.prepare("SELECT * FROM organizations WHERE id = ?").get(id));
  });

  apiRouter.delete("/organizations/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM organizations WHERE id = ?").run(id);
    res.status(204).send();
  });

  // Teams API
  apiRouter.get("/teams", (req, res) => {
    const { organization_id } = req.query;
    let teams;
    if (organization_id) {
      teams = db.prepare("SELECT * FROM teams WHERE organization_id = ? ORDER BY name ASC").all(organization_id);
    } else {
      teams = db.prepare("SELECT * FROM teams ORDER BY name ASC").all();
    }
    res.json(teams);
  });

  apiRouter.post("/teams", (req, res) => {
    const { name } = req.body;
    let { organization_id } = req.body;
    
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    // Fallback to first organization if not provided
    if (!organization_id) {
      const firstOrg = db.prepare("SELECT id FROM organizations LIMIT 1").get() as any;
      if (firstOrg) {
        organization_id = firstOrg.id;
      }
    }
    
    const info = db.prepare("INSERT INTO teams (name, organization_id) VALUES (?, ?)").run(name, organization_id || null);
    res.status(201).json(db.prepare("SELECT * FROM teams WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/teams/:id", (req, res) => {
    const { id } = req.params;
    const { name, organization_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (organization_id !== undefined) { updates.push("organization_id = ?"); values.push(organization_id); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    db.prepare(`UPDATE teams SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    res.json(db.prepare("SELECT * FROM teams WHERE id = ?").get(id));
  });

  apiRouter.delete("/teams/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM teams WHERE id = ?").run(id);
    res.status(204).send();
  });

  // Projects API
  apiRouter.get("/projects", (req, res) => {
    const { team_id } = req.query;
    let projects;
    if (team_id) {
      projects = db.prepare("SELECT * FROM projects WHERE team_id = ? ORDER BY name ASC").all(team_id);
    } else {
      projects = db.prepare("SELECT * FROM projects ORDER BY name ASC").all();
    }
    res.json(projects);
  });

  apiRouter.post("/projects", (req, res) => {
    const { team_id, name, description } = req.body;
    if (!team_id || !name) return res.status(400).json({ error: "team_id and name are required" });
    const info = db.prepare("INSERT INTO projects (team_id, name, description) VALUES (?, ?, ?)")
      .run(team_id, name, description || "");
    res.status(201).json(db.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/projects/:id", (req, res) => {
    const { id } = req.params;
    const { name, description, team_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (description !== undefined) { updates.push("description = ?"); values.push(description); }
    if (team_id !== undefined) { updates.push("team_id = ?"); values.push(team_id); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(id);
    db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    res.json(db.prepare("SELECT * FROM projects WHERE id = ?").get(id));
  });

  apiRouter.delete("/projects/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    res.status(204).send();
  });

  // Tasks API
  apiRouter.get("/tasks", (req, res) => {
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
        const stComments = db.prepare("SELECT * FROM comments WHERE subtask_id = ? ORDER BY created_at ASC").all(st.id);
        return { ...st, attachments: stAttachments, comments: stComments };
      });
      const attachments = db.prepare("SELECT * FROM attachments WHERE task_id = ? AND subtask_id IS NULL").all(task.id);
      const comments = db.prepare("SELECT * FROM comments WHERE task_id = ? AND subtask_id IS NULL ORDER BY created_at ASC").all(task.id);
      return { ...task, project_ids: projectIds, section_assignments: sectionAssignments, subtasks, attachments, comments };
    });

    res.json(hydratedTasks);
  });

  apiRouter.post("/tasks", (req, res) => {
    const { title, description, priority, due_date, key_result, project_ids, section_id } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    
    const insertTask = db.transaction(() => {
      const info = db.prepare(
        "INSERT INTO tasks (title, description, priority, due_date, key_result) VALUES (?, ?, ?, ?, ?)"
      ).run(title, description || "", priority || "moderate", due_date || null, key_result || "");
      
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

  apiRouter.patch("/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { title, description, status, priority, due_date, key_result, project_ids, section_id, current_project_id } = req.body;
    
    const updateTask = db.transaction(() => {
      const updates: string[] = [];
      const values: any[] = [];

      if (title !== undefined) { updates.push("title = ?"); values.push(title); }
      if (description !== undefined) { updates.push("description = ?"); values.push(description); }
      if (status !== undefined) { updates.push("status = ?"); values.push(status); }
      if (priority !== undefined) { updates.push("priority = ?"); values.push(priority); }
      if (due_date !== undefined) { updates.push("due_date = ?"); values.push(due_date); }
      if (key_result !== undefined) { updates.push("key_result = ?"); values.push(key_result); }
      
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
      console.log(`Updating task ${id} with status: ${status}`);
      updateTask();
      const updatedTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
      console.log(`Updated task:`, updatedTask);
      res.json(updatedTask);
    } catch (e) {
      console.error(`Failed to update task ${id}:`, e);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  apiRouter.delete("/tasks/:id", (req, res) => {
    const { id } = req.params;
    const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(204).send();
  });

  // Subtasks API
  apiRouter.post("/subtasks", (req, res) => {
    const { task_id, title } = req.body;
    if (!task_id || !title) return res.status(400).json({ error: "task_id and title are required" });
    const info = db.prepare("INSERT INTO subtasks (task_id, title) VALUES (?, ?)").run(task_id, title);
    res.status(201).json(db.prepare("SELECT * FROM subtasks WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/subtasks/:id", (req, res) => {
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

  apiRouter.delete("/subtasks/:id", (req, res) => {
    db.prepare("DELETE FROM subtasks WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  // Attachments API
  apiRouter.post("/attachments", (req, res) => {
    const { task_id, subtask_id, name, url } = req.body;
    if (!name || !url) return res.status(400).json({ error: "name and url are required" });
    const info = db.prepare("INSERT INTO attachments (task_id, subtask_id, name, url) VALUES (?, ?, ?, ?)")
      .run(task_id || null, subtask_id || null, name, url);
    res.status(201).json(db.prepare("SELECT * FROM attachments WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.delete("/attachments/:id", (req, res) => {
    db.prepare("DELETE FROM attachments WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  // Comments API
  apiRouter.post("/comments", (req, res) => {
    const { task_id, subtask_id, content, attachment_name, attachment_url } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });
    if (!task_id && !subtask_id) return res.status(400).json({ error: "task_id or subtask_id is required" });
    
    const info = db.prepare(`
      INSERT INTO comments (task_id, subtask_id, content, attachment_name, attachment_url) 
      VALUES (?, ?, ?, ?, ?)
    `).run(task_id || null, subtask_id || null, content, attachment_name || null, attachment_url || null);
    
    res.status(201).json(db.prepare("SELECT * FROM comments WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.delete("/comments/:id", (req, res) => {
    db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  // Sections API
  apiRouter.get("/sections", (req, res) => {
    const { project_id } = req.query;
    if (project_id) {
      const sections = db.prepare("SELECT * FROM sections WHERE project_id = ? ORDER BY order_index ASC").all(project_id);
      return res.json(sections);
    }
    const sections = db.prepare("SELECT * FROM sections ORDER BY project_id, order_index ASC").all();
    res.json(sections);
  });

  apiRouter.post("/sections", (req, res) => {
    const { project_id, name, color } = req.body;
    if (!project_id || !name) return res.status(400).json({ error: "project_id and name are required" });
    const info = db.prepare("INSERT INTO sections (project_id, name, color) VALUES (?, ?, ?)")
      .run(project_id, name, color || "slate");
    res.status(201).json(db.prepare("SELECT * FROM sections WHERE id = ?").get(info.lastInsertRowid));
  });

  apiRouter.patch("/sections/:id", (req, res) => {
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

  apiRouter.delete("/sections/:id", (req, res) => {
    db.prepare("DELETE FROM sections WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  // Mount the API router
  app.use("/api", apiRouter);

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
