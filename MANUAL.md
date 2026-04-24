# Roots: Task Management Manual

## 1. What it is and what it's for
**Roots** is a local-first, high-performance task management ecosystem engineered for zero-latency operations. It serves as a central orchestration hub for organizing work across a four-tier hierarchy: **Organization > Team > Project > Task**. 

It is designed to eliminate the friction of traditional task managers by providing a "powerhouse" interface that runs locally (hosted at `http://localhost:3000`), ensuring that search, filtering, and data entry are instantaneous.

## 2. Agent Interaction & Capabilities
Agents have full CRUD (Create, Read, Update, Delete) autonomy over all system entities. Interactions include:

*   **Structure Management:** Creating and managing Organizations, Teams, and Projects. Organizations serve as the top-level container for different business entities or large silos.
*   **Workflow Organization:** Defining Sections within projects to categorize work (e.g., "Backlog", "Sprint", "Complete").
*   **Task Orchestration:** Creating tasks with metadata including priority (Low to Urgent), due dates, and descriptive notes.
*   **Granular Control:** Managing Subtasks for complex items and adding Comments/Logs to maintain an activity trail.
*   **Relational Mapping:** Assigning tasks to multiple projects across different teams within the same organization. You can manage these assignments in the task drilldown view, where projects are grouped by their parent teams. 
*   **Querying:** Using the "All Tasks" engine to aggregate data across the entire organization with complex filters (Status, Priority, Team, Completion state) and full-text search.

## 3. API & Access Method
Roots exposes a RESTful API for seamless integration.

*   **Base URL:** `https://ais-dev-zszfeqfty5oaoaoprvyc2n-448152886749.us-east1.run.app/api`
*   **Authentication:** No-friction access (No login required for local-first operations).
*   **Primary Endpoints:**
    *   `GET /teams` | `POST /teams`: Manage top-level teams.
    *   `GET /projects` | `POST /projects`: Manage project containers.
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

---
*Manual Generated: April 20, 2026*
