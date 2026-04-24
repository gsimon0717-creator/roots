# Roots: Task Management Manual

## 1. What it is and what it's for
**Roots** is a local-first, high-performance task management ecosystem engineered for zero-latency operations. It serves as a central orchestration hub for organizing work across a four-tier hierarchy: **Organization > Team > Project > Task**. 

It is designed to eliminate the friction of traditional task managers by providing a "powerhouse" interface that runs locally (hosted at `http://localhost:3000`), ensuring that search, filtering, and data entry are instantaneous.

## 2. Agent Interaction & Capabilities
Agents have full CRUD (Create, Read, Update, Delete) autonomy over all system entities. Interactions include:

*   **Structure Management:** Creating and managing Organizations, Teams, and Projects. 
    *   **Organizations:** Top-level containers for teams.
    *   **Teams:** Functional units that own projects. Teams can be "Unassigned" (orphaned) if not linked to a specific organization.
    *   **Orphaned Teams:** Any team without an organization assignment is highlighted at the top of the sidebar for immediate visibility and can be re-assigned at any time.
*   **Workflow Organization:** Defining Sections within projects to categorize work (e.g., "Backlog", "Sprint", "Complete").
*   **Task Orchestration:** Creating tasks with metadata including priority (Low to Urgent), due dates, and descriptive notes.
*   **Granular Control:** Managing Subtasks for complex items and adding Comments/Logs to maintain an activity trail.
*   **Relational Mapping:** Assigning tasks to multiple projects across different teams.
*   **Querying:** Using the "All Tasks" engine with complex filters. Orphaned tasks (those without projects) appear in all organization-filtered views to ensure they are never lost.

## 3. API & Access Method
Roots exposes a RESTful API for seamless integration. All data is persisted in a SQLite database (`tasks.db`) at the project root.

*   **Base URL:** `https://ais-dev-zszfeqfty5oaoaoprvyc2n-448152886749.us-east1.run.app/api`
*   **Authentication:** No-friction access (No login required for local-first operations).
*   **Primary Endpoints:**
    *   `GET /organizations` | `POST /organizations`: Manage top-level organization containers.
    *   `GET /teams` | `POST /teams`: Manage teams (linked to an `organization_id`).
    *   `GET /projects` | `POST /projects`: Manage project containers (linked to a `team_id`).
    *   `GET /tasks` | `POST /tasks`: Core task operations.
    *   `PATCH /tasks/:id`: Update status, priority, description, or project/section assignments.
    *   `DELETE /tasks/:id`: Remove tasks and associated subtasks.
    *   `POST /comments`: Add logs or attachments to specific items.

## 4. Running Log of Updates

| Version | Update Highlights |
| :--- | :--- |
| **v1.0** | **Initial Release:** Core hierarchy implementation (Teams/Projects/Tasks) with SQLite persistence. |
| **v1.1** | **Search & Discovery:** Added global search, project selection grid for teams, and advanced multi-filter "All Tasks" view. |
| **v1.2** | **View Control:** Fixed task status toggle responsiveness and implemented global "Show/Hide Completed" toggles. |
| **v1.4** | **Team Mastery:** Implemented explicit "Team Assignment" labels, interactive Team selectors in the All Tasks table, and a dedicated "Orphaned Only" filter to find tasks with no project/team assignment. |
| **v1.3** | **Relational Flexibility:** Added the ability to re-assign tasks to different projects directly from the Project View or All Tasks table. |
| **v1.5** | **Organization Hierarchy:** High-level "Organization" layer added. The hierarchy is now **Organization > Team > Project > Task**. Existing teams were migrated to a default organization. |

---
*Manual Generated: April 20, 2026*
