import React, { useState, useEffect, useMemo } from 'react';
import { Country, State, City } from 'country-state-city';
import { Client, User, Task, ManagerAnalytics } from '../types';
import { 
  Calendar, CalendarPlus, UserCheck, PhoneCall, MapPin, 
  Clock, CheckCircle, AlertCircle, FileText, BarChart3, Search, TrendingUp, RefreshCw,
  ChevronLeft, ChevronRight, Volume2, User as UserIcon, Menu, Building, Download, Edit2, Trash2
} from 'lucide-react';
import { LOCATION_DATA } from '../utils/locationData';
import DynamicFormRenderer from './DynamicFormRenderer';

interface ManagerDashboardProps {
  token: string;
}

export default function ManagerDashboard({ token }: ManagerDashboardProps) {
  // Navigation active view
  const [activeTab, setActiveTab] = useState<'analytics' | 'scheduler' | 'team-logs' | 'clients'>('analytics');
  
  // Mobile sidebar controls
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load States
  const [clients, setClients] = useState<Client[]>([]);
  const [executives, setExecutives] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [analytics, setAnalytics] = useState<ManagerAnalytics | null>(null);

  // Client addition states
  const [cName, setCName] = useState('');
  const [cCompany, setCCompany] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cCountry, setCCountry] = useState('United States');
  const [cZone, setCZone] = useState('');
  const [cState, setCState] = useState('California');
  const [cCity, setCity] = useState('Los Angeles');

  // Geographic Location memoization
  const allCountries = useMemo(() => Country.getAllCountries(), []);

  const activeCountryObj = useMemo(() => {
    return allCountries.find(c => c.name === cCountry);
  }, [allCountries, cCountry]);

  const activeCountryStates = useMemo(() => {
    return activeCountryObj ? State.getStatesOfCountry(activeCountryObj.isoCode) : [];
  }, [activeCountryObj]);

  const activeStateObj = useMemo(() => {
    return activeCountryStates.find(s => s.name === cState);
  }, [activeCountryStates, cState]);

  const activeStateCities = useMemo(() => {
    return (activeCountryObj && activeStateObj) 
      ? City.getCitiesOfState(activeCountryObj.isoCode, activeStateObj.isoCode) 
      : [];
  }, [activeCountryObj, activeStateObj]);

  // Scheduler Form state
  const [targetClientId, setTargetClientId] = useState('');
  const [targetExecId, setTargetExecId] = useState('');
  const [targetTaskType, setTargetTaskType] = useState<string>('call');
  const [targetScheduledAt, setTargetScheduledAt] = useState('');

  // Dynamic Session Types and Questions
  const [sessionTypes, setSessionTypes] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);

  // Task Completion (Self assigned) states
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [activeTaskForForm, setActiveTaskForForm] = useState<Task | null>(null);
  const [completeLoading, setCompleteLoading] = useState(false);

  // Task Editing states
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editClientId, setEditClientId] = useState('');
  const [editExecId, setEditExecId] = useState('');
  const [editTaskType, setEditTaskType] = useState('');
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [editComments, setEditComments] = useState('');
  const [editStatus, setEditStatus] = useState('');

  // Overlay state to view submission details
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<Task | null>(null);
  const [modalAnswers, setModalAnswers] = useState<any[]>([]);
  const [modalLatitude, setModalLatitude] = useState<number | null>(null);
  const [modalLongitude, setModalLongitude] = useState<number | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Visual Calendar States for Manager
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDateFilter, setSelectedDateFilter] = useState<Date | null>(new Date());

  // Status notes
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [refreshLoading, setRefreshLoading] = useState(false);

  // TASK REPORT GENERATOR STATE FOR SALES MANAGER
  const [rptStartDate, setRptStartDate] = useState('');
  const [rptEndDate, setRptEndDate] = useState('');
  const [rptStatus, setRptStatus] = useState('all');
  const [rptType, setRptType] = useState('all');

  const handleDownloadTaskReport = () => {
    if (!rptStartDate || !rptEndDate) {
      triggerAlert("Please select both a Start Date and End Date for the report.", true);
      return;
    }
    const start = new Date(rptStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(rptEndDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      triggerAlert("Start Date cannot be after End Date.", true);
      return;
    }

    const matchedTasks = tasks.filter(t => {
      if (!t.scheduled_at) return false;
      const tDate = new Date(t.scheduled_at);
      if (tDate < start || tDate > end) return false;
      if (rptStatus !== 'all' && t.status !== rptStatus) return false;
      if (rptType !== 'all' && t.task_type !== rptType) return false;
      return true;
    });

    if (matchedTasks.length === 0) {
      triggerAlert("No task logs found matching the selected range and parameters.", true);
      return;
    }

    // CSV format
    const csvHeaders = [
      "Task ID", 
      "Client", 
      "Company", 
      "Assigned Representative", 
      "Assigned By / Manager", 
      "Task Type", 
      "Scheduled Time", 
      "Scheduled End Time", 
      "Status", 
      "Completed Time", 
      "Comments/Outcomes", 
      "Voice Recording URL", 
      "Created Date"
    ];

    const csvRows = matchedTasks.map(t => {
      let assignee = t.assignee_name;
      if (!assignee) {
        const matchingE = executives.find(e => e.id === t.assigned_to);
        assignee = matchingE ? matchingE.name : `Id: ${t.assigned_to}`;
      }

      let creator = t.creator_name;
      if (!creator) {
        const matchingS = executives.find(s => s.id === t.assigned_by);
        creator = matchingS ? matchingS.name : `Id: ${t.assigned_by}`;
      }

      let clientName = t.client_name;
      let companyName = t.company_name;
      if (!clientName) {
        const matchingCl = clients.find(c => c.id === t.client_id);
        if (matchingCl) {
          clientName = matchingCl.contact_name;
          companyName = matchingCl.company_name;
        }
      }

      return [
        t.id,
        clientName || "N/A",
        companyName || "N/A",
        assignee || "N/A",
        creator || "N/A",
        t.task_type === 'visit' ? 'Office Visit' : 'Phone Call',
        t.scheduled_at ? new Date(t.scheduled_at).toLocaleString() : "N/A",
        t.scheduled_end_at ? new Date(t.scheduled_end_at).toLocaleString() : "N/A",
        t.status === 'completed' ? 'Completed' : 'Pending',
        t.completed_at ? new Date(t.completed_at).toLocaleString() : "N/A",
        t.comments || "",
        t.voice_url || "",
        t.created_at ? new Date(t.created_at).toLocaleString() : "N/A"
      ];
    });

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map(row => row.map(val => {
        const formattedStr = String(val ?? "").replace(/"/g, '""');
        return `"${formattedStr}"`;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `field_dynamics_task_report_${rptStartDate}_to_${rptEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerAlert(`Task report downloaded successfully with ${matchedTasks.length} record(s).`);
  };

  const triggerAlert = (msg: string, isError = false) => {
    if (isError) {
      setErrorNote(msg);
      setTimeout(() => setErrorNote(null), 5000);
    } else {
      setSuccessNote(msg);
      setTimeout(() => setSuccessNote(null), 5000);
    }
  };

  // FETCH SERVICES
  const loadData = async () => {
    setRefreshLoading(true);
    try {
      // 1. Get managed users (Executives)
      const usersRes = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
      let allUsers: User[] = [];
      if (usersRes.ok) {
        allUsers = await usersRes.json();
      }

      // Check current user profile from `/api/auth/me` to filter reporting executives
      const meRes = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
      const meData = await meRes.json();
      setCurrentUserId(meData.id);
      
      const managedSubordinates = allUsers.filter(u => u.manager_id === meData.id || u.id === meData.id);
      setExecutives(managedSubordinates);

      // 2. Get Clients
      const clientsRes = await fetch('/api/clients', { headers: { 'Authorization': `Bearer ${token}` } });
      if (clientsRes.ok) setClients(await clientsRes.json());

      // 3. Get Tasks
      const tasksRes = await fetch('/api/tasks', { headers: { 'Authorization': `Bearer ${token}` } });
      if (tasksRes.ok) setTasks(await tasksRes.json());

      // 4. Get Analytics
      const analyticsRes = await fetch('/api/analytics/manager', { headers: { 'Authorization': `Bearer ${token}` } });
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());

      // 5. Get Session Types
      const stRes = await fetch('/api/session-types', { headers: { 'Authorization': `Bearer ${token}` } });
      if (stRes.ok) setSessionTypes(await stRes.json());

      // 6. Get Questions
      const questionsRes = await fetch('/api/admin/forms', { headers: { 'Authorization': `Bearer ${token}` } });
      if (questionsRes.ok) setQuestions(await questionsRes.json());

    } catch (e: any) {
      console.error(e);
      triggerAlert("Failed to load dashboard logs.", true);
    } finally {
      setRefreshLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // ASSIGN TASK ACTION
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClientId || !targetExecId || !targetTaskType || !targetScheduledAt) {
      triggerAlert("Please fill in all scheduling details.", true);
      return;
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: Number(targetClientId),
          assigned_to: Number(targetExecId),
          task_type: targetTaskType,
          scheduled_at: new Date(targetScheduledAt).toISOString()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to schedule task");

      triggerAlert("Task assigned & scheduled successfully!");
      setTargetClientId('');
      setTargetExecId('');
      setTargetScheduledAt('');
      loadData();
    } catch (err: any) {
      triggerAlert(err.message, true);
    }
  };

  const handleCompleteSelfTask = async (answers: any[]) => {
    if (!activeTaskForForm) return;
    setCompleteLoading(true);
    try {
      const res = await fetch(`/api/tasks/${activeTaskForForm.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit task details");
      triggerAlert("Task completed successfully!", false);
      setActiveTaskForForm(null);
      loadData();
    } catch (err: any) {
      triggerAlert(err.message, true);
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: Number(editClientId),
          assigned_to: Number(editExecId),
          task_type: editTaskType,
          scheduled_at: editScheduledAt,
          comments: editComments || null,
          status: editStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to edit task");
      triggerAlert("Task updated successfully!", false);
      setEditingTask(null);
      loadData();
    } catch (err: any) {
      triggerAlert(err.message, true);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm("Are you sure you want to delete this task assignment? This action is irreversible.")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to delete task");
      }
      triggerAlert("Task assignment deleted successfully!", false);
      loadData();
    } catch (err: any) {
      triggerAlert(err.message, true);
    }
  };

  // CREATE CLIENT API HANDLER
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName || !cCompany) {
      triggerAlert("Contact Name and Company Name are mandatory fields.", true);
      return;
    }

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contact_name: cName,
          company_name: cCompany,
          phone: cPhone,
          email: cEmail,
          address: cAddress,
          country: cCountry,
          zone: cZone,
          state: cState,
          city: cCity
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create client entry");

      triggerAlert(`Client "${cCompany}" added successfully!`);
      setCName('');
      setCCompany('');
      setCPhone('');
      setCEmail('');
      setCAddress('');
      setCCountry('United States');
      setCZone('');
      setCState('');
      setCity('');
      loadData();
    } catch (err: any) {
      triggerAlert(err.message, true);
    }
  };

  // LAUNCH MODAL SUBMISSION VIEWER
  const handleViewAnswers = async (task: Task) => {
    setSelectedTaskForModal(task);
    setModalAnswers([]);
    setModalLatitude(null);
    setModalLongitude(null);
    setModalLoading(true);

    try {
      const res = await fetch(`/api/tasks/${task.id}/submission`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setModalAnswers(data.answers || []);
        setModalLatitude(data.latitude || null);
        setModalLongitude(data.longitude || null);
      } else {
        triggerAlert(data.detail || "Failed to retrieve form response values.", true);
        setSelectedTaskForModal(null);
      }
    } catch (e) {
      console.error(e);
      triggerAlert("Network error fetching answers.", true);
      setSelectedTaskForModal(null);
    } finally {
      setModalLoading(false);
    }
  };

  // VISUAL CALENDAR COMPUTATIONS FOR TEAM CALENDAR
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(year, month + 1, 1));
  };

  const isSameDay = (date1: Date, date2String: string) => {
    const d2 = new Date(date2String);
    return date1.getFullYear() === d2.getFullYear() &&
           date1.getMonth() === d2.getMonth() &&
           date1.getDate() === d2.getDate();
  };

  // Filter tasks matching active day
  const filteredTasksByCalendar = tasks.filter(t => {
    if (!selectedDateFilter) return true;
    return isSameDay(selectedDateFilter, t.scheduled_at);
  });

  const getTaskDurationDisplay = (task: Task) => {
    const start = new Date(task.scheduled_at);
    if (!task.scheduled_end_at || task.scheduled_end_at === task.scheduled_at) {
      return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    const end = new Date(task.scheduled_end_at);
    return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* SIDEBAR TABS */}
      <div className="w-full lg:w-64 shrink-0">
        <div className="bg-white rounded-2xl border border-slate-205 shadow-sm p-4 space-y-4 lg:sticky lg:top-20">
          
          <div className="flex items-center justify-between lg:block border-b border-slate-100 pb-3 lg:pb-0 lg:border-b-0">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 font-display animate-pulse">Navigation Menu</p>
              <p className="hidden lg:block text-[11px] text-slate-500 px-3 mt-1 font-semibold">Track Team & Tasks</p>
            </div>
            
            {/* Hamburger helper for mobile screens */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden flex items-center space-x-1.5 p-2 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold uppercase tracking-wider transition border border-slate-200"
            >
              <Menu className="h-4 w-4" />
              <span>{mobileMenuOpen ? 'Hide Menu' : 'Show Sections'}</span>
            </button>
          </div>

          <div className={`flex flex-col space-y-1.5 transition-all ${mobileMenuOpen ? 'block animate-fade-in' : 'hidden lg:flex'}`}>
            <button
              id="manager-tab-analytics"
              onClick={() => { setActiveTab('analytics'); setMobileMenuOpen(false); }}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left ${
                activeTab === 'analytics'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10 font-bold'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-850'
              }`}
            >
              <BarChart3 className="h-4 w-4 shrink-0 font-bold" />
              <span>General Analytics</span>
            </button>

            <button
              id="manager-tab-scheduler"
              onClick={() => { setActiveTab('scheduler'); setMobileMenuOpen(false); }}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left ${
                activeTab === 'scheduler'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10 font-bold'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-850'
              }`}
            >
              <CalendarPlus className="h-4 w-4 shrink-0 font-bold" />
              <span>Task Assignment</span>
            </button>

            <button
              id="manager-tab-logs"
              onClick={() => { setActiveTab('team-logs'); setMobileMenuOpen(false); }}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left ${
                activeTab === 'team-logs'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10 font-bold'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-855'
              }`}
            >
              <Calendar className="h-4 w-4 shrink-0 font-bold" />
              <span>Team Schedule Registry</span>
            </button>

            <button
              id="manager-tab-clients"
              onClick={() => { setActiveTab('clients'); setMobileMenuOpen(false); }}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left ${
                activeTab === 'clients'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10 font-bold'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-855'
              }`}
            >
              <Building className="h-4 w-4 shrink-0 font-bold" />
              <span>Commercial Accounts</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT COMPARTMENT */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Dynamic Alerts */}
        {successNote && (
          <div className="p-4 bg-emerald-50 border-l-4 border-emerald-505 text-emerald-800 text-sm rounded-lg animate-fade-in shadow-sm flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-emerald-600 shrink-0" />
            {successNote}
          </div>
        )}
        {errorNote && (
          <div className="p-4 bg-rose-50 border-l-4 border-rose-505 text-rose-800 text-sm rounded-lg shadow-sm flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 text-rose-500 shrink-0" />
            {errorNote}
          </div>
        )}

        {/* HEADER CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-6 w-6 text-emerald-600 animate-pulse" />
            <div>
              <h2 className="text-xl font-extrabold text-slate-905 tracking-tight">Team Operations Manager</h2>
              <p className="text-xs text-slate-450">Assign schedules & inspect activity submissions and field insights</p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={refreshLoading}
            className="flex items-center space-x-2 p-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-650 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${refreshLoading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{refreshLoading ? "Reloading..." : "Refresh Dashboard"}</span>
          </button>
        </div>

      {/* RENDER VIEW - TAB 1: GENERAL ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* STATS HIGHLIGHT cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
              <div className="p-3.5 rounded-xl bg-orange-100/80 text-orange-600 text-sm">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-850">
                  {analytics?.total_pending_tasks ?? 0}
                </div>
                <div className="text-xs text-slate-450 font-bold uppercase tracking-wide">Pending Schedules</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
              <div className="p-3.5 rounded-xl bg-rose-100/80 text-rose-600 text-xs">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-850">
                  {analytics?.total_completed_visits ?? 0}
                </div>
                <div className="text-xs text-slate-450 font-bold uppercase tracking-wide">Visits Completed</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
              <div className="p-3.5 rounded-xl bg-blue-100/80 text-blue-600 text-xs">
                <PhoneCall className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-850">
                  {analytics?.total_completed_calls ?? 0}
                </div>
                <div className="text-xs text-slate-450 font-bold uppercase tracking-wide font-medium">Calls Logged</div>
              </div>
            </div>
          </div>

          {/* TASK REPORT RANGE DOWNLOADER CARD */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <Download className="h-5 w-5 text-emerald-600" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-sans uppercase tracking-wide">Generate & Download Task Report</h4>
                <p className="text-xs text-slate-450 mt-0.5">Select a start/end date range to download matching field operation and visit logs as CSV.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 shadow-sm">Start Date</label>
                <input 
                  type="date"
                  value={rptStartDate}
                  onChange={(e) => setRptStartDate(e.target.value)}
                  className="w-full max-w-xs md:max-w-none text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 shadow-sm">End Date</label>
                <input 
                  type="date"
                  value={rptEndDate}
                  onChange={(e) => setRptEndDate(e.target.value)}
                  className="w-full max-w-xs md:max-w-none text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 shadow-sm">Filters</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={rptStatus}
                    onChange={(e) => setRptStatus(e.target.value)}
                    className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-700"
                  >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>

                  <select
                    value={rptType}
                    onChange={(e) => setRptType(e.target.value)}
                    className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-700"
                  >
                    <option value="all">All Types</option>
                    <option value="visit">Visits</option>
                    <option value="call">Calls</option>
                  </select>
                </div>
              </div>

              <div>
                <button
                  onClick={handleDownloadTaskReport}
                  className="w-full text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-lg shadow-sm font-sans flex items-center justify-center space-x-2 hover:shadow-emerald-500/10 transition-all cursor-pointer transform hover:-translate-y-0.5"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Report</span>
                </button>
              </div>
            </div>
          </div>

          {/* PER-EXECUTIVE TRACKER TABLE */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Direct Subordinates Performance Track</h3>
              <p className="text-xs text-slate-400">List of Executives reporting to your sector and their metrics contribution</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm text-left">
                <thead className="bg-slate-50 text-slate-650 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3">Sales Personnel</th>
                    <th className="px-4 py-3">Reporting Tasks Completed</th>
                    <th className="px-4 py-3">Open Schedules Remaining</th>
                    <th className="px-4 py-3">Total Activity Volume</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {analytics?.executive_performance.map((exec) => {
                    const totalVolume = exec.completed_tasks + exec.pending_tasks;
                    return (
                      <tr key={exec.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 flex items-center space-x-2">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                            {exec.name[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{exec.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Report Subordinate</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">
                          {exec.completed_tasks} completed
                        </td>
                        <td className="px-4 py-3 text-slate-500 italic">
                          {exec.pending_tasks} scheduled
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-slate-700">{totalVolume}</span>
                            <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
                              <div 
                                className="bg-emerald-505 bg-emerald-600 h-full rounded-full" 
                                style={{ width: `${totalVolume > 0 ? (exec.completed_tasks / totalVolume) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!analytics || analytics.executive_performance.length === 0) && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                        No subordinate performance logs loaded yet. Get started by assigning schedules.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RENDER VIEW - TAB 2: TASK ASSIGNMENT SCHEDULER */}
      {activeTab === 'scheduler' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* TASK ASSIGNER FORM */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-150 pb-3">
                Schedule Assignment
              </h3>
            </div>

            <form onSubmit={handleAssignTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Client Account</label>
                <select
                  required
                  value={targetClientId}
                  onChange={(e) => setTargetClientId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">-- Choose Target Account --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name} (Contact: {c.contact_name})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Assign Executive</label>
                <select
                  required
                  value={targetExecId}
                  onChange={(e) => setTargetExecId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">-- Assign Personnel --</option>
                  {executives.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Field Session Type</label>
                <select
                  required
                  value={targetTaskType}
                  onChange={(e) => setTargetTaskType(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">-- Select Session Type --</option>
                  {sessionTypes.map(st => (
                    <option key={st.id} value={st.name}>{st.name.toUpperCase()}</option>
                  ))}
                  {sessionTypes.length === 0 && (
                    <>
                      <option value="call">💼 Phone Session / Pitch Call</option>
                      <option value="visit">📍 In-Person Office Visit</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Scheduled Target Day & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={targetScheduledAt}
                  onChange={(e) => setTargetScheduledAt(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900"
                />
              </div>

              <button
                id="manager-task-assign-submit"
                type="submit"
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all"
              >
                <span>Deploy Schedule Assignment</span>
              </button>
            </form>
          </div>

          {/* ACTIVE TEAM PENDING TIMELINE */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-3 flex items-center justify-between">
              <span>Active Target Assignments</span>
              <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-bold">
                {tasks.filter(t => t.status === 'pending').length} Open Schedules
              </span>
            </h3>

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
              {tasks.filter(t => t.status === 'pending').map((task) => (
                <div key={task.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                        task.task_type === 'visit' ? 'bg-indigo-150 bg-indigo-50 text-indigo-700' : 'bg-blue-150 bg-blue-50 text-blue-700'
                      }`}>
                        {task.task_type === 'visit' ? '📍 Visit' : '✉ Call'}
                      </span>
                      <strong className="text-slate-800 text-sm">{task.company_name}</strong>
                    </div>

                    <div className="text-xs text-slate-650 flex flex-col space-y-0.5">
                      <div>Representative: <span className="font-semibold">{task.assignee_name}</span></div>
                      <div className="flex items-center text-slate-450 text-[10px] space-x-1.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-700">Scheduled: {getTaskDurationDisplay(task)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {task.assigned_to === currentUserId && (
                      <button
                        onClick={() => setActiveTaskForForm(task)}
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                      >
                        Complete Task
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingTask(task);
                        setEditClientId(String(task.client_id));
                        setEditExecId(String(task.assigned_to));
                        setEditTaskType(task.task_type);
                        setEditScheduledAt(new Date(task.scheduled_at).toISOString().slice(0, 16));
                        setEditComments(task.comments || '');
                        setEditStatus(task.status);
                      }}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition"
                      title="Edit Assignment"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition"
                      title="Delete Assignment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {tasks.filter(t => t.status === 'pending').length === 0 && (
                <div className="p-12 text-center italic text-slate-400">
                  No pending task schedules active right now for your team. Use the form to assign one.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RENDER VIEW - TAB 3: FULL SCHEDULES REGISTRY LOGS + INTERACTIVE COLLABORATIVE TEAM CALENDAR */}
      {activeTab === 'team-logs' && (
        <div className="space-y-6">
          
          {/* TEAM VISUAL CALENDAR PANEL */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 mb-6 gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                  <span>Team Visual Sync Calendar</span>
                </h3>
                <p className="text-xs text-slate-450 mt-0.5">Inspect entire direct report schedules throughout the active operations month. Click a cell to inspect specific days.</p>
              </div>

              {/* MONTH NAVIGATION */}
              <div className="flex items-center space-x-3 self-start md:self-center">
                <button 
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-55 bg-slate-50 text-slate-600 transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-slate-800 min-w-[120px] text-center uppercase tracking-wide">
                  {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-55 bg-slate-50 text-slate-600 transition"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                
                {selectedDateFilter && (
                  <button
                    onClick={() => setSelectedDateFilter(null)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2.5 py-1.5 rounded-lg transition"
                  >
                    All Team Logs
                  </button>
                )}
              </div>
            </div>

            {/* CALENDAR WEEKDAYS HEADER */}
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 uppercase tracking-widest mb-2 border-b pb-1">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {/* Empty offset days */}
              {Array.from({ length: firstDayOfWeek }).map((_, index) => (
                <div key={`offset-mgr-${index}`} className="h-20 bg-slate-50/40 rounded-lg border border-slate-100/50"></div>
              ))}

              {/* Days of current month */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const dayNum = index + 1;
                const thisDate = new Date(year, month, dayNum);
                const isSelected = selectedDateFilter && 
                  selectedDateFilter.getFullYear() === thisDate.getFullYear() &&
                  selectedDateFilter.getMonth() === thisDate.getMonth() &&
                  selectedDateFilter.getDate() === thisDate.getDate();

                const dayTasks = tasks.filter(t => isSameDay(thisDate, t.scheduled_at));
                const dayPending = dayTasks.filter(t => t.status === 'pending');
                const dayCompleted = dayTasks.filter(t => t.status === 'completed');

                const isToday = isSameDay(new Date(), thisDate.toISOString());

                return (
                  <button
                    key={`day-mgr-${dayNum}`}
                    onClick={() => setSelectedDateFilter(thisDate)}
                    className={`h-22 p-2 rounded-xl border flex flex-col items-start justify-between text-left transition-all ${
                      isSelected 
                        ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20' 
                        : isToday
                        ? 'border-indigo-200 bg-indigo-50/30'
                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className={`text-xs font-bold ${
                        isSelected 
                          ? 'text-emerald-700' 
                          : isToday 
                          ? 'text-indigo-700 underline font-semibold' 
                          : 'text-slate-700'
                      }`}>
                        {dayNum}
                      </span>
                    </div>

                    <div className="w-full space-y-1 mt-1">
                      {dayTasks.length > 0 ? (
                        <div className="flex flex-col items-start w-full">
                          <span className="text-[9px] font-extrabold text-slate-600 block truncate max-w-full">
                            {dayTasks.length} Team session{dayTasks.length > 1 ? 's' : ''}
                          </span>
                          <div className="flex space-x-1 mt-0.5">
                            {dayPending.length > 0 && (
                              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                            )}
                            {dayCompleted.length > 0 && (
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[8px] text-slate-350 italic">Empty</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE DAY HIGHLIGHT LISTINGS OR REGISTRY LIST LEDGER */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
            <div className="flex justify-between items-center border-b pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedDateFilter 
                    ? `Team Schedules for ${selectedDateFilter.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : "Full Task Activity Records Ledger"}
                </h3>
                <p className="text-xs text-slate-400">Total historical interactions logs for reporting sales personnel.</p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-bold">
                {filteredTasksByCalendar.length} interaction record{filteredTasksByCalendar.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm text-left">
                <thead className="bg-slate-50 text-slate-650 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3">Task Details</th>
                    <th className="px-4 py-3">Schedule Window Duration</th>
                    <th className="px-4 py-3">Responsible Rep</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Details Form</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredTasksByCalendar.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1.5 mb-1 flex-wrap gap-y-1">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            task.task_type === 'visit' ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {task.task_type}
                          </span>
                          <span className="font-semibold text-slate-800 ml-1">{task.company_name}</span>
                        </div>
                        <div className="text-xs text-slate-450 font-medium">Contact: {task.client_name}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs text-slate-700">
                        {getTaskDurationDisplay(task)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-semibold text-slate-705 flex items-center space-x-1">
                          <UserIcon className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{task.assignee_name}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 uppercase">Deployed by: {task.creator_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          task.status === 'completed' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-orange-105 bg-orange-100 text-orange-800'
                        }`}>
                          {task.status === 'completed' ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              <span>Completed</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              <span>Pending</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        <div className="flex items-center justify-end space-x-2">
                          {task.status === 'completed' ? (
                            <button
                              onClick={() => handleViewAnswers(task)}
                              className="flex items-center space-x-1 border border-slate-200 hover:bg-slate-100 p-1 px-2.5 rounded-lg text-emerald-600 font-semibold transition"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>View Entry</span>
                            </button>
                          ) : (
                            <>
                              {task.assigned_to === currentUserId && (
                                <button
                                  onClick={() => setActiveTaskForForm(task)}
                                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-2 py-1 rounded-lg text-xs font-bold transition"
                                >
                                  Complete Task
                                </button>
                              )}
                              <span className="text-slate-350 italic text-[10.5px]">Pending</span>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setEditingTask(task);
                              setEditClientId(String(task.client_id));
                              setEditExecId(String(task.assigned_to));
                              setEditTaskType(task.task_type);
                              setEditScheduledAt(new Date(task.scheduled_at).toISOString().slice(0, 16));
                              setEditComments(task.comments || '');
                              setEditStatus(task.status);
                            }}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition"
                            title="Edit Assignment"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition"
                            title="Delete Assignment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTasksByCalendar.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 italic">No task interaction logs listed for this filter date range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-slate-800">
          {/* SINGLE CLIENT CREATE FORM */}
          <div className="bg-white p-6 rounded-2xl border border-slate-105 shadow-sm flex flex-col space-y-4 h-fit">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Building className="h-5 w-5 text-emerald-600" />
                <span>Add Commercial Account</span>
              </h3>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Person</label>
                <input
                  type="text"
                  required
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. Larry Page"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Company Name</label>
                <input
                  type="text"
                  required
                  value={cCompany}
                  onChange={(e) => setCCompany(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. Alphabet Inc"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Phone</label>
                <input
                  type="text"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none"
                  placeholder="Phone link"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none"
                  placeholder="Email link"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Headquarters Address</label>
                <textarea
                  rows={2}
                  value={cAddress}
                  onChange={(e) => setCAddress(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none"
                  placeholder="1600 Amphitheatre Pkwy"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Country</label>
                  <select
                    value={cCountry}
                    onChange={(e) => {
                      const selectedCountryName = e.target.value;
                      setCCountry(selectedCountryName);
                      
                      const countryObj = allCountries.find(c => c.name === selectedCountryName);
                      const states = countryObj ? State.getStatesOfCountry(countryObj.isoCode) : [];
                      const firstState = states[0]?.name || '';
                      setCState(firstState);
                      
                      const stateObj = firstState ? states.find(s => s.name === firstState) : null;
                      const cities = (countryObj && stateObj) ? City.getCitiesOfState(countryObj.isoCode, stateObj.isoCode) : [];
                      setCity(cities[0]?.name || '');
                    }}
                    className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select Country</option>
                    {allCountries.map(country => (
                      <option key={country.isoCode} value={country.name}>{country.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Zone</label>
                  <input
                    type="text"
                    value={cZone}
                    onChange={(e) => setCZone(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. West Coast"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">State</label>
                  <select
                    value={cState}
                    onChange={(e) => {
                      const selectedStateName = e.target.value;
                      setCState(selectedStateName);
                      
                      const stateObj = activeCountryStates.find(s => s.name === selectedStateName);
                      const cities = (activeCountryObj && stateObj) ? City.getCitiesOfState(activeCountryObj.isoCode, stateObj.isoCode) : [];
                      setCity(cities[0]?.name || '');
                    }}
                    className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none"
                    disabled={!cCountry}
                  >
                    <option value="">Select State</option>
                    {activeCountryStates.map(state => (
                      <option key={state.isoCode} value={state.name}>{state.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">City</label>
                  <select
                    value={cCity}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none"
                    disabled={!cState}
                  >
                    <option value="">Select City</option>
                    {activeStateCities.map(city => (
                      <option key={city.name} value={city.name}>{city.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-bold tracking-wider text-xs uppercase shadow-lg shadow-emerald-500/15 hover:shadow-emerald-555/20 transition-all active:scale-95"
              >
                Add Commercial Account
              </button>
            </form>
          </div>

          {/* TABLE OF CLIENTS */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Commercial Directory</h3>
                <p className="text-xs text-slate-500 mt-1">Directory listing of registered commercial accounts managed by team managers.</p>
              </div>
              <span className="text-xs font-bold text-slate-555 px-3 py-1 bg-slate-150 rounded-full">{clients.length} ACCOUNTS</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse text-slate-850">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Company Name</th>
                    <th className="p-4">Contact Person</th>
                    <th className="p-4">Phone / Email</th>
                    <th className="p-4">Location Zone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {clients.map(client => (
                    <tr key={client.id} className="hover:bg-slate-55/40 transition">
                      <td className="p-4">
                        <div className="font-bold text-slate-850 text-xs">{client.company_name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{client.address}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-700 font-semibold">{client.contact_name}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-750">{client.phone || "—"}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">{client.email || "—"}</div>
                      </td>
                      <td className="p-4 text-slate-550">
                        <span className="inline-block px-1.5 py-0.5 bg-slate-100 border rounded text-[10.5px] font-mono capitalize">
                          {client.zone ? `${client.zone} / ${client.city || "—"}` : "Unspecified"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-400 italic">
                        No commercial accounts registered. Try adding one on the left.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CLOSE MAIN CONTENT COMPARTMENT COLUMN */}
      </div>

      {/* DETAILED RESPONSES MODAL OVERLAY */}
      {selectedTaskForModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-5 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <div>
                <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded uppercase font-bold text-slate-500">Form Observation Record</span>
                <h4 className="text-base font-bold text-slate-900 mt-1">{selectedTaskForModal.company_name}</h4>
              </div>
              <button 
                onClick={() => setSelectedTaskForModal(null)} 
                className="text-slate-400 hover:text-slate-700 font-extrabold text-lg bg-slate-200/50 p-1 px-2.5 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* PLAYBACK SAVED AUDIO IN STRUCTURAL VOICE MESSAGE CONTAINER */}
              {selectedTaskForModal.voice_url && (
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2">
                  <div className="flex items-center space-x-1.5 text-emerald-850 font-bold text-xs uppercase tracking-wider">
                    <Volume2 className="h-4 w-4 text-emerald-650" />
                    <span>Attached Field Report Voice Memo</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Play/listen to the recorded voice diagnostic saved on the server for this visit activity:</p>
                  <audio src={selectedTaskForModal.voice_url} controls className="w-full h-8 mt-1 text-xs" />
                </div>
              )}

              {/* DISPLAY SAVED GEOLOCATION COORDINATES */}
              {(!modalLoading) && (
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    <span>Captured Check-in Location</span>
                  </div>
                  {modalLatitude !== null && modalLongitude !== null ? (
                    <div>
                      <p className="text-xs text-slate-700 font-medium">Automatic location successfully logged on submission:</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[11px] font-mono bg-white px-2.5 py-1 border border-slate-200 rounded text-slate-700">
                          Lat: <strong className="text-slate-900">{modalLatitude.toFixed(6)}</strong>
                        </span>
                        <span className="text-[11px] font-mono bg-white px-2.5 py-1 border border-slate-200 rounded text-slate-700">
                          Lng: <strong className="text-slate-900">{modalLongitude.toFixed(6)}</strong>
                        </span>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${modalLatitude},${modalLongitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-250 py-1 px-3.5 rounded font-bold underline cursor-pointer inline-flex items-center space-x-1"
                        >
                          View Map
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No geolocation coordinates recorded for this submission.</p>
                  )}
                </div>
              )}

              {modalLoading ? (
                <div className="p-12 text-center text-xs text-slate-450 italic">Retrieving submission answers...</div>
              ) : modalAnswers.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-450 italic">Answers are unavailable or empty.</div>
              ) : (
                <div className="space-y-4">
                  {modalAnswers.map((ans, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border rounded-lg flex flex-col space-y-1">
                      <span className="text-xs font-semibold text-slate-500">Q: {ans.question_text}</span>
                      <strong className="text-sm text-slate-800">{ans.answer_value || "—"}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 text-right">
              <button 
                onClick={() => setSelectedTaskForModal(null)}
                className="py-1.5 px-4 bg-slate-700 hover:bg-slate-800 text-white border rounded-lg font-semibold text-xs"
              >
                Dismiss Details
              </button>
            </div>
          </div>
        </div>
      )}
      {/* TASK EDIT OVERLAY */}
      {editingTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <div>
                <span className="text-[10px] bg-emerald-100 px-2 py-0.5 rounded uppercase font-bold text-emerald-700">Modify Assignment</span>
                <h4 className="text-base font-bold text-slate-900 mt-1">Edit Task Schedule</h4>
              </div>
              <button 
                onClick={() => setEditingTask(null)} 
                className="text-slate-400 hover:text-slate-700 font-extrabold text-lg bg-slate-200/50 p-1 px-2.5 rounded-full"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Client Account</label>
                <select
                  required
                  value={editClientId}
                  onChange={(e) => setEditClientId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Assign Representative</label>
                <select
                  required
                  value={editExecId}
                  onChange={(e) => setEditExecId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  {executives.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Field Session Type</label>
                <select
                  required
                  value={editTaskType}
                  onChange={(e) => setEditTaskType(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  {sessionTypes.map(st => (
                    <option key={st.id} value={st.name}>{st.name.toUpperCase()}</option>
                  ))}
                  {sessionTypes.length === 0 && (
                    <>
                      <option value="call">CALL</option>
                      <option value="visit">VISIT</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Scheduled At</label>
                <input
                  type="datetime-local"
                  required
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                <select
                  required
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Comments / Instructions</label>
                <textarea
                  value={editComments}
                  onChange={(e) => setEditComments(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  placeholder="Instructions for representative..."
                />
              </div>

              <div className="pt-4 flex items-center justify-end space-x-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SELF ASSIGNED TASK COMPLETION OVERLAY */}
      {activeTaskForForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-5 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <div>
                <span className="text-[10px] bg-emerald-100 px-2 py-0.5 rounded uppercase font-bold text-emerald-700">Self-Assigned Submission</span>
                <h4 className="text-base font-bold text-slate-900 mt-1">Complete Scheduled Session</h4>
                <p className="text-xs text-slate-500 mt-0.5">Account: {activeTaskForForm.company_name}</p>
              </div>
              <button 
                onClick={() => setActiveTaskForForm(null)} 
                className="text-slate-400 hover:text-slate-700 font-extrabold text-lg bg-slate-200/50 p-1 px-2.5 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Render Dynamic Form */}
              <DynamicFormRenderer
                questions={(() => {
                  const activeSessionType = sessionTypes.find(st => st.name === activeTaskForForm.task_type);
                  return questions.filter(q => {
                    if (activeSessionType && activeSessionType.template_id) {
                      return q.template_id === activeSessionType.template_id;
                    }
                    return !q.session_type_id || q.session_type_id === activeSessionType?.id;
                  });
                })()}
                onSubmit={handleCompleteSelfTask}
                loading={completeLoading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
