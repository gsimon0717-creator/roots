import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Clock, 
  AlertCircle, 
  Terminal, 
  ChevronRight,
  Calendar,
  Filter,
  Users,
  FolderKanban,
  LayoutDashboard,
  Settings,
  MoreVertical,
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Team, Project, Section } from './types';

export default function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('moderate');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskProjectIds, setNewTaskProjectIds] = useState<number[]>([]);
  const [newTaskSectionId, setNewTaskSectionId] = useState<number | null>(null);
  const [showApiDocs, setShowApiDocs] = useState(false);
  
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');

  const [sections, setSections] = useState<Section[]>([]);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionColor, setNewSectionColor] = useState('slate');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const SECTION_COLORS = [
    { name: 'slate', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
    { name: 'red', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
    { name: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    { name: 'amber', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    { name: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    { name: 'blue', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    { name: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
    { name: 'violet', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const teamsRes = await fetch('/api/teams');
      const teamsData = await teamsRes.json();
      setTeams(teamsData);
      
      if (teamsData.length > 0 && !selectedTeam) {
        setSelectedTeam(teamsData[0]);
      }

      const projectsRes = await fetch('/api/projects');
      const projectsData = await projectsRes.json();
      setProjects(projectsData);

      if (projectsData.length > 0 && !selectedProject) {
        // Find first project of the selected team
        const teamId = selectedTeam?.id || teamsData[0]?.id;
        const firstProject = projectsData.find((p: Project) => p.team_id === teamId);
        if (firstProject) setSelectedProject(firstProject);
      }

      if (selectedProject) {
        const tasksRes = await fetch(`/api/tasks?project_id=${selectedProject.id}`);
        const tasksData = await tasksRes.json();
        setTasks(tasksData);

        const sectionsRes = await fetch(`/api/sections?project_id=${selectedProject.id}`);
        const sectionsData = await sectionsRes.json();
        setSections(sectionsData);
      } else {
        const tasksRes = await fetch('/api/tasks');
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Refresh tasks and sections when project changes
  useEffect(() => {
    const fetchProjectData = async () => {
      if (!selectedProject) return;
      try {
        const tasksRes = await fetch(`/api/tasks?project_id=${selectedProject.id}`);
        const tasksData = await tasksRes.json();
        setTasks(tasksData);

        const sectionsRes = await fetch(`/api/sections?project_id=${selectedProject.id}`);
        const sectionsData = await sectionsRes.json();
        setSections(sectionsData);
      } catch (e) {
        console.error(e);
      }
    };
    fetchProjectData();
  }, [selectedProject]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const projectIds = newTaskProjectIds.length > 0 
      ? newTaskProjectIds 
      : (selectedProject ? [selectedProject.id] : []);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newTaskTitle,
          project_ids: projectIds,
          priority: newTaskPriority,
          due_date: newTaskDueDate || null,
          section_id: newTaskSectionId
        }),
      });
      if (response.ok) {
        setNewTaskTitle('');
        setNewTaskPriority('moderate');
        setNewTaskDueDate('');
        setNewTaskProjectIds([]);
        setNewTaskSectionId(null);
        fetchData(); // Refresh everything to get hydrated task
      }
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  const addSubtask = async (taskId: number) => {
    if (!newSubtaskTitle.trim()) return;
    try {
      const res = await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, title: newSubtaskTitle }),
      });
      if (res.ok) {
        setNewSubtaskTitle('');
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const toggleSubtask = async (subtask: any) => {
    const newStatus = subtask.status === 'completed' ? 'pending' : 'completed';
    try {
      await fetch(`/api/subtasks/${subtask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const addAttachment = async (taskId?: number, subtaskId?: number) => {
    if (!newAttachmentName.trim() || !newAttachmentUrl.trim()) return;
    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          task_id: taskId, 
          subtask_id: subtaskId, 
          name: newAttachmentName, 
          url: newAttachmentUrl 
        }),
      });
      if (res.ok) {
        setNewAttachmentName('');
        setNewAttachmentUrl('');
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const addSection = async () => {
    if (!newSectionName.trim() || !selectedProject) return;
    try {
      const res = await fetch('/api/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          project_id: selectedProject.id, 
          name: newSectionName, 
          color: newSectionColor 
        }),
      });
      if (res.ok) {
        setNewSectionName('');
        setIsAddingSection(false);
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const moveTaskToSection = async (taskId: number, sectionId: number | null) => {
    if (!selectedProject) return;
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          section_id: sectionId, 
          current_project_id: selectedProject.id 
        }),
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const deleteSection = async (sectionId: number) => {
    if (!confirm('Are you sure you want to delete this section? Tasks will be moved to Uncategorized.')) return;
    try {
      await fetch(`/api/sections/${sectionId}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };
  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const deleteTask = async (id: number) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const addTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName }),
      });
      if (!res.ok) throw new Error('Failed to create team');
      const newTeam = await res.json();
      setTeams([...teams, newTeam]);
      setSelectedTeam(newTeam);
      setNewTeamName('');
      setIsAddingTeam(false);
      // Reset projects for the new team
      setSelectedProject(null);
    } catch (e) { console.error(e); }
  };

  const addProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !newProjectName.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: selectedTeam.id, name: newProjectName }),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const newProject = await res.json();
      setProjects([...projects, newProject]);
      setSelectedProject(newProject);
      setNewProjectName('');
      setIsAddingProject(false);
    } catch (e) { console.error(e); }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-purple-500 bg-purple-50 border-purple-100';
      case 'high': return 'text-red-500 bg-red-50 border-red-100';
      case 'moderate': return 'text-amber-500 bg-amber-50 border-amber-100';
      case 'low': return 'text-emerald-500 bg-emerald-50 border-emerald-100';
      default: return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const filteredProjects = projects.filter(p => p.team_id === selectedTeam?.id);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
              <CheckCircle2 className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Mission Control</h1>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-8">
          {/* Teams Section */}
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Users size={12} /> Teams
              </h2>
              <button onClick={() => setIsAddingTeam(!isAddingTeam)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                <PlusCircle size={14} />
              </button>
            </div>

            {isAddingTeam && (
              <form onSubmit={addTeam} className="px-2 mb-3 space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Team Name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                />
                <div className="flex gap-1">
                  <button type="submit" className="flex-grow bg-indigo-600 text-white py-1 rounded-lg text-[10px] font-bold">Save</button>
                  <button type="button" onClick={() => setIsAddingTeam(false)} className="px-2 text-slate-400 text-[10px] font-bold">Cancel</button>
                </div>
              </form>
            )}

            <div className="space-y-1">
              {teams.map(team => (
                <button
                  key={team.id}
                  onClick={() => {
                    setSelectedTeam(team);
                    const firstProj = projects.find(p => p.team_id === team.id);
                    setSelectedProject(firstProj || null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-between group ${selectedTeam?.id === team.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className="truncate">{team.name}</span>
                  {selectedTeam?.id === team.id && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />}
                </button>
              ))}
            </div>
          </div>

          {/* Projects Section */}
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FolderKanban size={12} /> Projects
              </h2>
              <button onClick={() => setIsAddingProject(!isAddingProject)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                <PlusCircle size={14} />
              </button>
            </div>

            {isAddingProject && (
              <form onSubmit={addProject} className="px-2 mb-3 space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project Name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                />
                <div className="flex gap-1">
                  <button type="submit" className="flex-grow bg-indigo-600 text-white py-1 rounded-lg text-[10px] font-bold">Save</button>
                  <button type="button" onClick={() => setIsAddingProject(false)} className="px-2 text-slate-400 text-[10px] font-bold">Cancel</button>
                </div>
              </form>
            )}

            <div className="space-y-1">
              {filteredProjects.length === 0 ? (
                <p className="text-[10px] text-slate-400 px-3 italic">No projects in this team</p>
              ) : (
                filteredProjects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProject(project)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-3 ${selectedProject?.id === project.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${selectedProject?.id === project.id ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                    <span className="truncate">{project.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={() => setShowApiDocs(true)}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Terminal size={16} />
            Agent API
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-grow flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
              <span>{selectedTeam?.name}</span>
              <ChevronRight size={12} />
              <span className="text-slate-600">{selectedProject?.name}</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">{selectedProject?.name || 'Select a Project'}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                  U{i}
                </div>
              ))}
            </div>
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Add Task Input */}
            {selectedProject && (
              <form onSubmit={addTask} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="relative group">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder={`Add a task...`}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                    <Plus size={20} />
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                    <select 
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as Task['priority'])}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</label>
                    <input 
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Projects</label>
                    <div className="flex flex-wrap gap-1">
                      {projects.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            if (newTaskProjectIds.includes(p.id)) {
                              setNewTaskProjectIds(newTaskProjectIds.filter(id => id !== p.id));
                            } else {
                              setNewTaskProjectIds([...newTaskProjectIds, p.id]);
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${newTaskProjectIds.includes(p.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Section</label>
                    <select 
                      value={newTaskSectionId || ''}
                      onChange={(e) => setNewTaskSectionId(e.target.value ? Number(e.target.value) : null)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">No Section</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="ml-auto px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
                  >
                    Add Task
                  </button>
                </div>
              </form>
            )}

            {/* Section Controls */}
            {selectedProject && (
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sections</h2>
                <button 
                  onClick={() => setIsAddingSection(!isAddingSection)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Plus size={14} /> Add Section
                </button>
              </div>
            )}

            {isAddingSection && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="Section Name (e.g. In Progress)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex flex-wrap gap-2">
                  {SECTION_COLORS.map(c => (
                    <button
                      key={c.name}
                      onClick={() => setNewSectionColor(c.name)}
                      className={`w-6 h-6 rounded-full border-2 ${c.bg} ${newSectionColor === c.name ? 'border-slate-900' : 'border-transparent'}`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={addSection} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold">Save Section</button>
                  <button onClick={() => setIsAddingSection(false)} className="text-slate-400 px-4 py-2 text-xs font-bold">Cancel</button>
                </div>
              </div>
            )}

            {/* Task List Grouped by Sections */}
            <div className="space-y-8">
              {loading ? (
                <div className="py-20 text-center text-slate-400">Loading tasks...</div>
              ) : !selectedProject ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                  <LayoutDashboard className="mx-auto text-slate-300 mb-3" size={32} />
                  <p className="text-slate-500 font-medium">Select a project to see tasks</p>
                </div>
              ) : (
                <>
                  {/* Render Sections */}
                  {sections.length === 0 && tasks.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                      <CheckCircle2 className="mx-auto text-slate-300 mb-3" size={32} />
                      <p className="text-slate-500 font-medium">No tasks yet. Create your first task above!</p>
                    </div>
                  ) : (
                    [...sections, { id: null, name: 'Uncategorized', color: 'slate' }].map((section: any) => {
                    const sectionTasks = tasks.filter(t => {
                      const sid = t.section_assignments?.[selectedProject.id];
                      return section.id === null ? !sid : sid === section.id;
                    });

                    if (section.id === null && sectionTasks.length === 0) return null;

                    const colorConfig = SECTION_COLORS.find(c => c.name === section.color) || SECTION_COLORS[0];

                    return (
                      <div key={section.id || 'uncategorized'} className="space-y-4">
                        <div className={`flex items-center justify-between px-4 py-2 rounded-xl border ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs uppercase tracking-wider">{section.name}</span>
                            <span className="text-[10px] opacity-60 font-medium">({sectionTasks.length})</span>
                          </div>
                          {section.id !== null && (
                            <button onClick={() => deleteSection(section.id)} className="opacity-40 hover:opacity-100 transition-opacity">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          <AnimatePresence mode="popLayout">
                            {sectionTasks.map((task) => (
                              <motion.div
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={task.id}
                                className={`group bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 hover:shadow-md hover:border-indigo-100 transition-all ${task.status === 'completed' ? 'opacity-60' : ''}`}
                              >
                                <div className="flex items-center gap-4">
                                  <button 
                                    onClick={() => toggleTask(task)}
                                    className={`flex-shrink-0 transition-colors ${task.status === 'completed' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'}`}
                                  >
                                    {task.status === 'completed' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                  </button>
                                  
                                  <div className="flex-grow min-w-0 cursor-pointer" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                                    <h3 className={`font-medium truncate ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                      {task.title}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getPriorityColor(task.priority)}`}>
                                        {task.priority}
                                      </span>
                                      {task.due_date && (
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                          <Calendar size={10} />
                                          {formatDate(task.due_date)}
                                        </span>
                                      )}
                                      <select 
                                        value={task.section_assignments?.[selectedProject.id] || ''}
                                        onChange={(e) => moveTaskToSection(task.id, e.target.value ? Number(e.target.value) : null)}
                                        className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1 py-0.5 focus:outline-none"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <option value="">Move to Section...</option>
                                        {sections.map(s => (
                                          <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  <button 
                                    onClick={() => deleteTask(task.id)}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>

                                {/* Expanded Content: Subtasks & Attachments */}
                                {expandedTaskId === task.id && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    className="border-t border-slate-100 pt-4 space-y-6"
                                  >
                                    {/* Subtasks */}
                                    <div className="space-y-3">
                                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        Subtasks
                                      </h4>
                                      <div className="space-y-2 pl-4">
                                        {task.subtasks?.map(st => (
                                          <div key={st.id} className="space-y-1">
                                            <div className="flex items-center gap-3 group/st">
                                              <button onClick={() => toggleSubtask(st)} className={st.status === 'completed' ? 'text-indigo-500' : 'text-slate-300'}>
                                                {st.status === 'completed' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                              </button>
                                              <span className={`text-sm flex-grow ${st.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                                                {st.title}
                                              </span>
                                            </div>
                                            {/* Subtask Attachments */}
                                            {st.attachments && st.attachments.length > 0 && (
                                              <div className="pl-7 flex flex-wrap gap-2">
                                                {st.attachments.map(at => (
                                                  <a key={at.id} href={at.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline flex items-center gap-1">
                                                    <FolderKanban size={8} /> {at.name}
                                                  </a>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                        <div className="flex items-center gap-2 mt-2">
                                          <input 
                                            type="text" 
                                            placeholder="New subtask..."
                                            value={newSubtaskTitle}
                                            onChange={e => setNewSubtaskTitle(e.target.value)}
                                            className="text-sm bg-slate-50 border border-slate-100 rounded-lg px-3 py-1 focus:outline-none focus:border-indigo-300 flex-grow"
                                            onKeyDown={e => e.key === 'Enter' && addSubtask(task.id)}
                                          />
                                          <button onClick={() => addSubtask(task.id)} className="text-indigo-600 hover:text-indigo-700">
                                            <PlusCircle size={20} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Attachments */}
                                    <div className="space-y-3">
                                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        Attachments (Google Drive)
                                      </h4>
                                      <div className="space-y-2 pl-4">
                                        {task.attachments?.map(at => (
                                          <a 
                                            key={at.id} 
                                            href={at.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                                          >
                                            <FolderKanban size={14} />
                                            {at.name}
                                          </a>
                                        ))}
                                        <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                          <input 
                                            type="text" 
                                            placeholder="Link name (e.g. Project Brief)"
                                            value={newAttachmentName}
                                            onChange={e => setNewAttachmentName(e.target.value)}
                                            className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none"
                                          />
                                          <div className="flex gap-2">
                                            <input 
                                              type="text" 
                                              placeholder="Google Drive URL"
                                              value={newAttachmentUrl}
                                              onChange={e => setNewAttachmentUrl(e.target.value)}
                                              className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none flex-grow"
                                            />
                                            <button onClick={() => addAttachment(task.id)} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-bold">
                                              Add Link
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })
                )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* API Documentation Modal/Drawer */}
      <AnimatePresence>
        {showApiDocs && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApiDocs(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold">Audrey API Docs</h2>
                  <button 
                    onClick={() => setShowApiDocs(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>

                <div className="space-y-8">
                  <section>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Base URL</h3>
                    <code className="block bg-slate-100 p-3 rounded-xl text-sm font-mono text-indigo-600">
                      {window.location.origin}
                    </code>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Endpoints</h3>
                    
                    <div className="space-y-4">
                      <div className="border border-slate-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase">GET</span>
                          <span className="font-mono text-sm">/api/teams</span>
                        </div>
                        <p className="text-xs text-slate-500">List all teams.</p>
                      </div>

                      <div className="border border-slate-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase">GET</span>
                          <span className="font-mono text-sm">/api/projects?team_id=1</span>
                        </div>
                        <p className="text-xs text-slate-500">List projects for a team.</p>
                      </div>

                      <div className="border border-slate-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase">POST</span>
                          <span className="font-mono text-sm">/api/tasks</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">Create a task in a project.</p>
                        <pre className="bg-slate-900 text-slate-300 p-3 rounded-lg text-[10px] font-mono">
{`{
  "title": "String",
  "project_id": Number
}`}
                        </pre>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
