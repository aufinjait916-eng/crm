import React, { useState, useEffect } from 'react';
import { User, Client, FormQuestion, UserRole, InputType, Task } from '../types';
import { 
  Users, UserPlus, ClipboardType, Briefcase, Plus, Search, 
  Trash2, ToggleLeft, ToggleRight, Check, CheckCircle2, CloudUpload, Sparkles, Building, MapPin, Download, Upload,
  Database, Settings, Menu, ChevronLeft, ChevronRight, Volume2, Calendar, ClipboardCheck, Clock, User as UserIcon, AlertCircle
} from 'lucide-react';

interface AdminDashboardProps {
  token: string;
  role?: string | null;
}

export default function AdminDashboard({ token, role }: AdminDashboardProps) {
  const currentRole = role || localStorage.getItem('crm_role') || 'admin';

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'users' | 'clients' | 'form-builder' | 'database-settings' | 'calendars-tasks'>(
    (role || localStorage.getItem('crm_role')) === 'management' ? 'users' : 'users'
  );

  // Mobile menu open status for side-bar tabs
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Unified notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  // Calendars / Tasks sync states
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDateFilter, setSelectedDateFilter] = useState<Date | null>(new Date());

  // Task detail report modal states
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<any | null>(null);
  const [modalAnswers, setModalAnswers] = useState<any[]>([]);
  const [modalLatitude, setModalLatitude] = useState<number | null>(null);
  const [modalLongitude, setModalLongitude] = useState<number | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Search parameters
  const [userQuery, setUserQuery] = useState('');
  const [clientQuery, setClientQuery] = useState('');

  // USER CREATE STATE
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('executive');
  const [newUserManagerId, setNewUserManagerId] = useState<string>('');

  // CLIENT CREATE STATE
  const [cName, setCName] = useState('');
  const [cCompany, setCCompany] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cCountry, setCCountry] = useState('');
  const [cZone, setCZone] = useState('');
  const [cState, setCState] = useState('');
  const [cCity, setCCity] = useState('');

  // FORM BUILDER DYNAMIC QUESTION CREATE STATE
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState<InputType>('text');
  const [qOptionsRaw, setQOptionsRaw] = useState(''); // comma-separated options
  const [qRequired, setQRequired] = useState(false);

  // TASK REPORT GENERATOR STATE FOR MANAGEMENT OFFICER
  const [rptStartDate, setRptStartDate] = useState('');
  const [rptEndDate, setRptEndDate] = useState('');
  const [rptStatus, setRptStatus] = useState('all');
  const [rptType, setRptType] = useState('all');

  const handleDownloadTaskReport = () => {
    if (!rptStartDate || !rptEndDate) {
      setErrorMsg("Please select both a Start Date and End Date for the report.");
      return;
    }
    const start = new Date(rptStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(rptEndDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      setErrorMsg("Start Date cannot be after End Date.");
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
      setErrorMsg("No task logs matched your chosen date range and criteria.");
      return;
    }

    // CSV compile
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
      "Comments", 
      "Voice Recording URL", 
      "Created Date"
    ];

    const csvRows = matchedTasks.map(t => {
      let assignee = t.assignee_name;
      if (!assignee) {
        const matchingU = users.find(u => u.id === t.assigned_to);
        assignee = matchingU ? matchingU.name : `Id: ${t.assigned_to}`;
      }

      let creator = t.creator_name;
      if (!creator) {
        const matchingC = users.find(u => u.id === t.assigned_by);
        creator = matchingC ? matchingC.name : `Id: ${t.assigned_by}`;
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

    setSuccessMsg(`Task Report downloaded successfully with ${matchedTasks.length} record(s).`);
  };

  // Load baseline statistics
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setClients(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/admin/forms', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setQuestions(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setTasks(await res.json());
    } catch (e) { console.error(e); }
  };

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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  // POSTGRES SERVER CONNECTION SETTINGS STATE
  const [pgHost, setPgHost] = useState('');
  const [pgPort, setPgPort] = useState('5432');
  const [pgDatabase, setPgDatabase] = useState('');
  const [pgUser, setPgUser] = useState('');
  const [pgPassword, setPgPassword] = useState('');
  const [pgSsl, setPgSsl] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success?: boolean; msg?: string; details?: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchPgConfig = async () => {
    try {
      const res = await fetch('/api/admin/postgres-config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const config = await res.json();
        if (config) {
          setPgHost(config.host || '');
          setPgPort(config.port ? String(config.port) : '5432');
          setPgDatabase(config.database || '');
          setPgUser(config.user || '');
          setPgPassword(config.password || '');
          setPgSsl(!!config.ssl);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // SAVE POSTGRES CONFIG
  const handleSavePgConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setConnectionStatus(null);
    try {
      const res = await fetch('/api/admin/postgres-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          host: pgHost,
          port: Number(pgPort),
          database: pgDatabase,
          user: pgUser,
          password: pgPassword,
          ssl: pgSsl
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerNote("PostgreSQL connection settings saved successfully!");
      } else {
        triggerNote(data.detail || "Failed to save Postgres configuration.", true);
      }
    } catch (err: any) {
      triggerNote(err.message, true);
    } finally {
      setSavingSettings(false);
    }
  };

  // TEST POSTGRES CONFIG
  const handleTestPgConfig = async () => {
    if (!pgHost || !pgDatabase || !pgUser) {
      triggerNote("Please fill in Host, Database Name, and User before testing.", true);
      return;
    }
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch('/api/admin/postgres-config/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          host: pgHost,
          port: Number(pgPort),
          database: pgDatabase,
          user: pgUser,
          password: pgPassword,
          ssl: pgSsl
        })
      });

      const data = await res.json();
      if (res.ok) {
        setConnectionStatus({
          success: true,
          msg: data.message || "Connection succeeded!",
          details: data.details || ""
        });
      } else {
        setConnectionStatus({
          success: false,
          msg: data.detail || "Connection failed. Please check host, credentials, or firewalls."
        });
      }
    } catch (err: any) {
      setConnectionStatus({
        success: false,
        msg: "Error validating PostgreSQL connection server: " + err.message
      });
    } finally {
      setTestingConnection(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchClients();
    fetchQuestions();
    fetchPgConfig();
    fetchTasks();
  }, [token]);

  // Handle Notifications
  const triggerNote = (message: string, isError = false) => {
    if (isError) {
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(null), 4000);
    } else {
      setSuccessMsg(message);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // CREATE USER API HANDLER
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword || !newUserRole) {
      triggerNote("Please enter all mandatory fields.", true);
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          manager_id: newUserRole === 'executive' && newUserManagerId ? Number(newUserManagerId) : null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to register user");

      triggerNote(`Account for "${newUserName}" successfully registered as ${newUserRole}!`);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserManagerId('');
      fetchUsers();
    } catch (err: any) {
      triggerNote(err.message, true);
    }
  };

  // CREATE CLIENT API HANDLER
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName || !cCompany) {
      triggerNote("Contact Name and Company Name are mandatory fields.", true);
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

      triggerNote(`Client "${cCompany}" added successfully!`);
      setCName('');
      setCCompany('');
      setCPhone('');
      setCEmail('');
      setCAddress('');
      setCCountry('');
      setCZone('');
      setCState('');
      setCCity('');
      fetchClients();
    } catch (err: any) {
      triggerNote(err.message, true);
    }
  };

  // BULK UPLOAD MOCK TRIGGERS
  const triggerBulkPlaceholder = () => {
    const list = [
      { contact_name: "Tony Stark", company_name: "Stark Industries", phone: "1-800-IRONMAN", email: "tony@stark.com", address: "Malibu Cliff Estates, CA", country: "United States", zone: "West Coast", state: "California", city: "Malibu" },
      { contact_name: "Bruce Wayne", company_name: "Wayne Enterprises", phone: "1-800-BATMAN", email: "bruce@wayne.com", address: "Gotham City Highway 1", country: "United States", zone: "Northeast", state: "New Jersey", city: "Gotham" },
      { contact_name: "Peter Parker", company_name: "Daily Bugle", phone: "555-BUGLE", email: "peter.parker@dailybugle.org", address: "Queens, NY", country: "United States", zone: "Northeast", state: "New York", city: "New York City" }
    ];

    list.forEach(async (clObj) => {
      await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(clObj)
      });
    });

    setTimeout(() => {
      triggerNote("Seeded 3 new commercial client accounts with geographic tags!");
      fetchClients();
    }, 800);
  };

  // DELETE CLIENT
  const handleDeleteClient = async (clientId: number) => {
    if (!window.confirm("Are you sure you want to delete this commercial client record? This cascades task logs.")) return;
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        triggerNote("Client entry deleted.");
        fetchClients();
      } else {
        const errorData = await res.json();
        triggerNote(errorData.detail || "Failed to delete client", true);
      }
    } catch (e: any) {
      triggerNote(e.message, true);
    }
  };

  // CREATE FORM BUILDER DYNAMIC QUESTION
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qText || !qType) {
      triggerNote("Question text and input style are required.", true);
      return;
    }

    // Process Comma separated options if needed
    let options: string[] | null = null;
    const isOptionsNeeded = ["dropdown", "checkbox", "radio"].includes(qType);

    if (isOptionsNeeded && qOptionsRaw.trim()) {
      options = qOptionsRaw.split(',').map(s => s.trim()).filter(Boolean);
    } else if (isOptionsNeeded && !qOptionsRaw.trim()) {
      triggerNote("Choice selection options are required when choosing selection lists.", true);
      return;
    }

    try {
      const res = await fetch('/api/admin/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question_text: qText,
          input_type: qType,
          options,
          is_required: qRequired,
          is_active: true
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to build question");

      triggerNote("Dynamic question added to fields successfully!");
      setQText('');
      setQOptionsRaw('');
      setQRequired(false);
      fetchQuestions();
    } catch (err: any) {
      triggerNote(err.message, true);
    }
  };

  // TOGGLE FORM QUESTION STATUS
  const handleToggleQuestion = async (q: FormQuestion) => {
    try {
      const res = await fetch(`/api/admin/forms/${q.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !q.is_active })
      });
      if (res.ok) {
        triggerNote(`Acknowledge state transition: Question field toggle success.`);
        fetchQuestions();
      }
    } catch (e: any) { triggerNote(e.message, true); }
  };

  // DELETE FORM QUESTION
  const handleDeleteQuestion = async (qId: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this questionnaire field? Doing so will remove it from the list.")) return;
    try {
      const res = await fetch(`/api/admin/forms/${qId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        triggerNote("Dynamic question text deleted from fields.");
        fetchQuestions();
      } else {
        const errorData = await res.json();
        triggerNote(errorData.detail || "Failed to delete question.", true);
      }
    } catch (e: any) {
      triggerNote(e.message, true);
    }
  };

  // CSV TEMPLATE GENERATOR & DOWNLOAD
  const downloadCsvTemplate = () => {
    const headers = ["Contact Name", "Company Name", "Phone", "Email", "Address", "Country", "Zone", "State", "City"];
    const row = ["John Doe", "Acme Corporation", "+1-555-0100", "john@acme.com", "123 Business Rd", "United States", "North America", "California", "San Francisco"];
    const csvContent = [headers.join(","), row.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "client_crm_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerNote("CSV import template downloaded!");
  };

  // CSV FILE PARSER & MASS UPLOADER
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        if (lines.length < 2) {
          triggerNote("CSV file is empty or missing data rows.", true);
          return;
        }

        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_]/g, ""));
        
        let successCount = 0;
        let failCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const values = parseCsvLine(lines[i]);
          if (values.length === 0 || (values.length === 1 && values[0] === "")) continue;

          const clientData: any = {};
          
          headers.forEach((header, idx) => {
            const val = values[idx] || "";
            if (header.includes("contactname") || header === "contact" || header === "name") {
              clientData.contact_name = val;
            } else if (header.includes("companyname") || header === "company") {
              clientData.company_name = val;
            } else if (header === "phone" || header.includes("telephone")) {
              clientData.phone = val;
            } else if (header === "email") {
              clientData.email = val;
            } else if (header === "address" || header.includes("headquarter") || header.includes("street")) {
              clientData.address = val;
            } else if (header === "country") {
              clientData.country = val;
            } else if (header === "zone") {
              clientData.zone = val;
            } else if (header === "state") {
              clientData.state = val;
            } else if (header === "city") {
              clientData.city = val;
            }
          });

          // Validation
          if (!clientData.contact_name || !clientData.company_name) {
            failCount++;
            continue;
          }

          try {
            const res = await fetch('/api/clients', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(clientData)
            });
            if (res.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (err) {
            failCount++;
          }
        }

        if (successCount > 0) {
          triggerNote(`Successfully imported ${successCount} Client accounts from CSV! ${failCount > 0 ? `(${failCount} rows failed)` : ""}`);
          fetchClients();
        } else {
          triggerNote("No client accounts could be imported. Please verify that Contact Name and Company Name columns are present in CSV.", true);
        }
      } catch (err: any) {
        triggerNote("Failed to process CSV file: " + err.message, true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Filter lists
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(userQuery.toLowerCase())
  );

  const filteredClients = clients.filter(c => 
    c.contact_name.toLowerCase().includes(clientQuery.toLowerCase()) ||
    c.company_name.toLowerCase().includes(clientQuery.toLowerCase()) ||
    (c.address && c.address.toLowerCase().includes(clientQuery.toLowerCase())) ||
    (c.country && c.country.toLowerCase().includes(clientQuery.toLowerCase())) ||
    (c.zone && c.zone.toLowerCase().includes(clientQuery.toLowerCase())) ||
    (c.state && c.state.toLowerCase().includes(clientQuery.toLowerCase())) ||
    (c.city && c.city.toLowerCase().includes(clientQuery.toLowerCase()))
  );

  const managersOnly = users.filter(u => u.role === "manager");

  const isSameDay = (date1: Date, date2Str: string) => {
    if (!date2Str) return false;
    const d2 = new Date(date2Str);
    return date1.getFullYear() === d2.getFullYear() &&
           date1.getMonth() === d2.getMonth() &&
           date1.getDate() === d2.getDate();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* SIDEBAR TABS */}
      <div className="w-full lg:w-64 shrink-0">
        <div className="bg-white rounded-2xl border border-slate-205 shadow-sm p-4 space-y-4 lg:sticky lg:top-20">
          
          <div className="flex items-center justify-between lg:block border-b border-slate-100 pb-3 lg:pb-0 lg:border-b-0">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 font-display">Navigation Menu</p>
              <p className="hidden lg:block text-[11px] text-slate-500 px-3 mt-1 font-semibold">Manage Operations & Users</p>
            </div>
            
            {/* Hamburger button for mobile scale */}
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
              id="admin-tab-users"
              onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left ${
                activeTab === 'users'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-850'
              }`}
            >
              <Users className="h-4 w-4 shrink-0 font-bold animate-pulse" />
              <span>User Directory</span>
            </button>

            <button
              id="admin-tab-clients"
              onClick={() => { setActiveTab('clients'); setMobileMenuOpen(false); }}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left ${
                activeTab === 'clients'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-850'
              }`}
            >
              <Building className="h-4 w-4 shrink-0 font-bold" />
              <span>Commercial Accounts</span>
            </button>

            <button
              id="admin-tab-forms"
              onClick={() => { setActiveTab('form-builder'); setMobileMenuOpen(false); }}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left ${
                activeTab === 'form-builder'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-855'
              }`}
            >
              <ClipboardType className="h-4 w-4 shrink-0 font-bold" />
              <span>Dynamic Questionnaire</span>
            </button>

            {currentRole !== 'management' && (
              <button
                id="admin-tab-database-settings"
                onClick={() => { setActiveTab('database-settings'); setMobileMenuOpen(false); }}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left ${
                  activeTab === 'database-settings'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10'
                    : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-855'
                }`}
              >
                <Database className="h-4 w-4 shrink-0 font-bold" />
                <span>Database Server</span>
              </button>
            )}

            <button
              id="admin-tab-calendars-tasks"
              onClick={() => { setActiveTab('calendars-tasks'); setMobileMenuOpen(false); }}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left ${
                activeTab === 'calendars-tasks'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-855'
              }`}
            >
              <Calendar className="h-4 w-4 shrink-0 font-bold" />
              <span>All Calendars & Tasks</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT REGION CONTAINER */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Alert Banners */}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border-l-4 border-emerald-505 text-emerald-800 text-sm rounded-lg flex items-center space-x-2 shadow-sm animate-fade-in">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border-l-4 border-rose-505 text-rose-800 text-sm rounded-lg shadow-sm flex items-center">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500 mr-2" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

      {/* RENDER - TAB 1: USERS DIRECTORY */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* USER REGISTRATION FORM */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4 h-fit">
            <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-150 pb-3">
              <UserPlus className="h-5 w-5 text-emerald-600" />
              <span>Register Account</span>
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm"
                  placeholder="e.g. Kenneth Baker"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm"
                  placeholder="e.g. baker@agency.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">System Password</label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm"
                  placeholder="Password string"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Organizational Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm"
                >
                  <option value="admin">Admin Partner</option>
                  <option value="management">Management Officer</option>
                  <option value="manager">Sales Manager</option>
                  <option value="executive">Sales Executive</option>
                </select>
              </div>

              {newUserRole === 'executive' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Assign Reporting Line (Sales Manager)</label>
                  <select
                    value={newUserManagerId}
                    onChange={(e) => setNewUserManagerId(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm"
                  >
                    <option value="">-- No Direct Line assigned --</option>
                    {managersOnly.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                id="admin-create-user-submit"
                type="submit"
                className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Register User</span>
              </button>
            </form>
          </div>

          {/* USERS DIRECTORY VIEW */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">Current Directory</h3>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all w-full sm:w-64"
                  placeholder="Search by name, role, email..."
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm text-left">
                <thead className="bg-slate-50 text-slate-650 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3">User ID</th>
                    <th className="px-4 py-3">General Profile & Identity</th>
                    <th className="px-4 py-3">Designation / Role</th>
                    <th className="px-4 py-3">Reporting Line Assignment</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredUsers.map((item) => {
                    const manager = users.find(u => u.id === item.manager_id);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">#{item.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{item.name}</div>
                          <div className="text-xs text-slate-400">{item.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                            item.role === 'admin' 
                              ? 'bg-violet-100 text-violet-700' 
                              : item.role === 'manager'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {item.role === 'executive' ? (
                            manager ? (
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-700">{manager.name}</span>
                                <span className="text-[10px] text-slate-400">Reports to</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic font-medium">None reports to (Unassigned)</span>
                            )
                          ) : (
                            <span className="text-slate-350">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RENDER - TAB 2: CLIENT DIRECTORY */}
      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SINGLE CLIENT CREATE FORM */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4 h-fit">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Building className="h-5 w-5 text-emerald-600" />
                <span>Add Client Account</span>
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
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-505/10 focus:border-emerald-505 focus:outline-none"
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
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-505/10 focus:border-emerald-505 focus:outline-none"
                  placeholder="e.g. Alphabet Inc"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Phone</label>
                <input
                  type="text"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-505/10 focus:border-emerald-505 focus:outline-none"
                  placeholder="Phone link"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-505/10 focus:border-emerald-505 focus:outline-none"
                  placeholder="Email link"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Headquarters Address</label>
                <textarea
                  rows={2}
                  value={cAddress}
                  onChange={(e) => setCAddress(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-505/10 focus:border-emerald-505 focus:outline-none"
                  placeholder="Corporate Location"
                />
              </div>

              {/* Country & Zone / State & City fields */}
              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Country</label>
                  <input
                    type="text"
                    value={cCountry}
                    onChange={(e) => setCCountry(e.target.value)}
                    className="mt-1 block w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-505/10"
                    placeholder="e.g. India"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Zone / Region</label>
                  <input
                    type="text"
                    value={cZone}
                    onChange={(e) => setCZone(e.target.value)}
                    className="mt-1 block w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-505/10"
                    placeholder="e.g. South Zone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">State / Province</label>
                  <input
                    type="text"
                    value={cState}
                    onChange={(e) => setCState(e.target.value)}
                    className="mt-1 block w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-505/10"
                    placeholder="e.g. Karnataka"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">City</label>
                  <input
                    type="text"
                    value={cCity}
                    onChange={(e) => setCCity(e.target.value)}
                    className="mt-1 block w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-505/10"
                    placeholder="e.g. Bangalore"
                  />
                </div>
              </div>

              <button
                id="admin-create-client-submit"
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition-all"
              >
                Save Client Account
              </button>
            </form>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-150"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold"><span className="px-2 bg-white text-slate-400">CSV Bulk Imports</span></div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-col space-y-1">
                <span className="text-[11px] font-bold text-slate-700">Mass Imports API</span>
                <p className="text-[10px] text-slate-500">Provide a formatted CSV file with headers corresponding to database fields.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="flex items-center justify-center space-x-1.5 py-2 px-3 border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Template</span>
                </button>

                <label className="flex items-center justify-center space-x-1.5 py-2 px-3 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer">
                  <Upload className="h-3.5 w-3.5 text-slate-500" />
                  <span>Upload CSV</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={triggerBulkPlaceholder}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-650 text-[10px] font-bold rounded border border-slate-200/60 transition-all uppercase tracking-wider"
              >
                <Sparkles className="h-3 w-3 text-emerald-600 animate-pulse" />
                <span>Simulate Demo Seeds</span>
              </button>
            </div>
          </div>

          {/* CLIENT DIRECTORY TABLE */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">Commercial Directory</h3>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                  placeholder="Search client index..."
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm text-left">
                <thead className="bg-slate-50 text-slate-650 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3">Client details</th>
                    <th className="px-4 py-3">Phone & Email contacts</th>
                    <th className="px-4 py-3">Address coordinates</th>
                    <th className="px-4 py-3 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{client.company_name}</div>
                        <div className="text-xs text-slate-400 font-medium mb-1.5">Contact: {client.contact_name}</div>
                        
                        {/* Geography Fields */}
                        {(client.city || client.state || client.zone || client.country) && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {client.country && (
                              <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase font-semibold">
                                {client.country}
                              </span>
                            )}
                            {client.zone && (
                              <span className="text-[9px] bg-sky-50 border border-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-semibold">
                                Zone: {client.zone}
                              </span>
                            )}
                            {client.state && (
                              <span className="text-[9px] bg-amber-50 border border-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                                {client.state}
                              </span>
                            )}
                            {client.city && (
                              <span className="text-[9px] bg-emerald-50 border border-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                                {client.city}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-slate-700">{client.phone || "No phone link"}</div>
                        <div className="text-slate-400">{client.email || "No email link"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 break-words max-w-[180px]">
                        {client.address || "No address directory"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="p-1 px-2.5 border border-rose-100 hover:bg-rose-50 rounded-md text-rose-500 hover:text-rose-700 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredClients.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 italic">No client records found. Add one on the left.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RENDER - TAB 3: DYNAMIC FORM BUILDER */}
      {activeTab === 'form-builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* BUILD QUESTION CONTROL */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4 h-fit">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-150 pb-3 flex items-center space-x-2">
              <ClipboardType className="h-5 w-5 text-emerald-600" />
              <span>Define Question Field</span>
            </h3>

            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Question Label</label>
                <input
                  type="text"
                  required
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  placeholder="e.g. Client's principal bottleneck?"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Input Field Type</label>
                <select
                  value={qType}
                  onChange={(e) => setQType(e.target.value as InputType)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="text">Paragraph Answer</option>
                  <option value="number">Numeric Counter</option>
                  <option value="dropdown">Dropdown List Selector</option>
                  <option value="checkbox">Checkbox (Multiple options)</option>
                  <option value="radio">Radio Buttons (Exclusive options)</option>
                  <option value="datetime">Timestamp / Date Time picker</option>
                </select>
              </div>

              {["dropdown", "checkbox", "radio"].includes(qType) && (
                <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-xl space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">Selection Choice Values</label>
                  <input
                    type="text"
                    required
                    value={qOptionsRaw}
                    onChange={(e) => setQOptionsRaw(e.target.value)}
                    className="block w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs"
                    placeholder="Choice A, Choice B, Choice C"
                  />
                  <p className="text-[10px] text-amber-805">
                    Type a comma-separated list of choice possibilities above. Space pads are trimmed.
                  </p>
                </div>
              )}

              <div className="flex items-center">
                <input
                  id="q-required-check"
                  type="checkbox"
                  checked={qRequired}
                  onChange={(e) => setQRequired(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <label htmlFor="q-required-check" className="ml-2.5 text-xs font-semibold text-slate-650 cursor-pointer select-none">
                  Make this a Mandatory field (is_required)
                </label>
              </div>

              <button
                id="admin-form-builder-submit"
                type="submit"
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition"
              >
                <Plus className="h-4 w-4" />
                <span>Append Question Field</span>
              </button>
            </form>
          </div>

          {/* QUESTIONS LIST STATUS COGNIZANT */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
            <h3 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center justify-between">
              <span>Configured Dynamic Questionnaire</span>
              <span className="text-xs px-2.5 py-1 bg-slate-50 border rounded-full text-slate-500 font-medium">
                {questions.filter(q => q.is_active).length} Active / {questions.length} Total
              </span>
            </h3>

            <div className="space-y-3">
              {questions.map((q) => (
                <div 
                  key={q.id} 
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    q.is_active 
                      ? 'border-slate-100 bg-slate-50/20' 
                      : 'border-slate-150 bg-slate-100/30 opacity-75'
                  }`}
                >
                  <div className="flex-1 min-w-0 flex flex-col space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400">Q#{q.id}</span>
                      <span className="text-sm font-bold text-slate-800 break-words">{q.question_text}</span>
                      {q.is_required && (
                        <span className="text-[9px] bg-rose-100/80 text-rose-700 font-bold px-1.5 py-0.5 rounded uppercase">
                          Mandatory
                        </span>
                      )}
                      {!q.is_active && (
                        <span className="text-[9px] bg-slate-100 border text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">
                          Deactivated
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 text-xs text-slate-500 mt-1">
                      <span className="bg-slate-100 rounded px-2 py-0.5 text-[10px] uppercase font-bold text-slate-600 shrink-0 self-start">
                        Style: {q.input_type}
                      </span>
                      {q.options && q.options.length > 0 && (
                        <div className="flex flex-wrap gap-1 items-center min-w-0">
                          <span className="text-[11px] text-slate-400 font-medium shrink-0">Choices:</span>
                          {q.options.map((opt, idx) => (
                            <span 
                              key={idx} 
                              className="bg-slate-50 px-2 py-0.5 text-[10px] text-slate-605 border border-slate-150 rounded font-medium max-w-[150px] truncate"
                              title={opt}
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleToggleQuestion(q)}
                      className={`flex items-center space-x-1 p-1 px-3.5 rounded-lg border text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        q.is_active 
                          ? 'border-emerald-150 text-emerald-600 hover:bg-emerald-50 bg-emerald-50/20' 
                          : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {q.is_active ? "Active" : "Archived (Inactive)"}
                    </button>

                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1 px-2 border border-rose-100 hover:bg-rose-50 rounded-md text-rose-500 hover:text-rose-700 transition cursor-pointer shrink-0"
                      title="Permanently Delete Question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {questions.length === 0 && (
                <div className="p-8 text-center italic text-slate-400">
                  No dynamic form fields configured yet in the database registry. Create some above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'database-settings' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-2xl mx-auto flex flex-col space-y-6 animate-fade-in" id="postgres-settings-card">
          <div className="border-b border-slate-100 pb-5">
            <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2.5">
              <Database className="h-5 w-5 text-emerald-600 animate-pulse" />
              <span>PostgreSQL Database Server Integration</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Configure your primary corporate relational PostgreSQL server to stream collected field activities, commercial clients CRM data, and audit tracking.
            </p>
          </div>

          <form onSubmit={handleSavePgConfig} className="space-y-4" id="postgres-connection-form">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="pg-host" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Database Host Address *
                </label>
                <input
                  id="pg-host"
                  type="text"
                  required
                  value={pgHost}
                  onChange={(e) => setPgHost(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none placeholder-slate-400"
                  placeholder="e.g. localhost, pg.neon.tech, or 10.0.0.4"
                />
              </div>

              <div>
                <label htmlFor="pg-port" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Port *
                </label>
                <input
                  id="pg-port"
                  type="number"
                  required
                  value={pgPort}
                  onChange={(e) => setPgPort(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none placeholder-slate-400"
                  placeholder="5432"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pg-database" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Database Name *
                </label>
                <input
                  id="pg-database"
                  type="text"
                  required
                  value={pgDatabase}
                  onChange={(e) => setPgDatabase(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none placeholder-slate-400"
                  placeholder="e.g. crm_field_app"
                />
              </div>

              <div>
                <label htmlFor="pg-user" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Username *
                </label>
                <input
                  id="pg-user"
                  type="text"
                  required
                  value={pgUser}
                  onChange={(e) => setPgUser(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none placeholder-slate-400"
                  placeholder="e.g. postgres"
                />
              </div>
            </div>

            <div>
              <label htmlFor="pg-password" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Password
              </label>
              <input
                id="pg-password"
                type="password"
                value={pgPassword}
                onChange={(e) => setPgPassword(e.target.value)}
                className="mt-1.5 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none placeholder-slate-400"
                placeholder="••••••••••••"
              />
            </div>

            <div className="flex items-center space-x-2.5 pt-1.5 select-none">
              <input
                id="pg-ssl"
                type="checkbox"
                checked={pgSsl}
                onChange={(e) => setPgSsl(e.target.checked)}
                className="h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="pg-ssl" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Enable SSL Encrypted Connection (recommended for cloud servers e.g. AWS RDS, Neon, Supabase)
              </label>
            </div>

            {/* LIVE CONNECTION STATUS FEEDBACK */}
            {connectionStatus && (
              <div 
                id="postgres-test-status"
                className={`p-4 rounded-xl border text-xs leading-relaxed transition-all ${
                  connectionStatus.success 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                    : 'bg-rose-50 border-rose-100 text-rose-800'
                }`}
              >
                <p className="font-bold uppercase tracking-wider mb-1">
                  {connectionStatus.success ? "✓ Test Connection Succeeded" : "✗ Test Connection Failed"}
                </p>
                <p className="font-medium">{connectionStatus.msg}</p>
                {connectionStatus.details && (
                  <p className="mt-2 font-mono text-[10px] bg-white/70 p-2 border border-emerald-150 rounded text-slate-700 max-h-32 overflow-y-auto">
                    {connectionStatus.details}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0 pt-4 border-t border-slate-100">
              <button
                id="postgres-btn-test"
                type="button"
                disabled={testingConnection || savingSettings}
                onClick={handleTestPgConfig}
                className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-all text-center flex items-center justify-center space-x-1.5"
              >
                {testingConnection ? "Testing Gateway..." : "Test Connection"}
              </button>

              <button
                id="postgres-btn-save"
                type="submit"
                disabled={testingConnection || savingSettings}
                className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-all text-center flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {savingSettings ? "Saving Settings..." : "Save Connection Details"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RENDER DYNAMIC CALENDAR & USER TASKS SYNC VIEW */}
      {activeTab === 'calendars-tasks' && (
        <div className="space-y-6 animate-fade-in w-full">
          {/* USER CALENDAR CONTROLLERS */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-905 flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-emerald-600" />
                <span>Unified Calendars Sync Hub</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">Monitor daily schedule timelines, interactive agendas, and completed check-in reporting logs across all user roles.</p>
            </div>

            {/* FILTERS PANEL */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 self-stretch sm:self-auto min-w-[280px]">
              {/* Personnel Select */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Personnel</label>
                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">👥 All Employees</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              {/* Status Select */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</label>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">✨ All Statuses</option>
                  <option value="pending">⏳ Pending Tasks</option>
                  <option value="completed">✓ Completed Tasks</option>
                </select>
              </div>

              {/* Type Select */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Type</label>
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none"
                >
                  <option value="all">📱 All Types</option>
                  <option value="visit">📍 Office Visits</option>
                  <option value="call">💼 Phone Calls</option>
                </select>
              </div>
            </div>
          </div>

          {/* TASK REPORT RANGE DOWNLOADER CARD */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <Download className="h-5 w-5 text-emerald-600" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-sans uppercase tracking-wide">Generate & Download Task Report</h4>
                <p className="text-xs text-slate-450 mt-0.5 font-medium">Select a start/end date range to download matching field operation and visit logs as CSV.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 shadow-sm">Start Date</label>
                <input 
                  type="date"
                  value={rptStartDate}
                  onChange={(e) => setRptStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 shadow-sm">End Date</label>
                <input 
                  type="date"
                  value={rptEndDate}
                  onChange={(e) => setRptEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 shadow-sm">Filters</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={rptStatus}
                    onChange={(e) => setRptStatus(e.target.value)}
                    className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none font-medium text-slate-700"
                  >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>

                  <select
                    value={rptType}
                    onChange={(e) => setRptType(e.target.value)}
                    className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none font-medium text-slate-700"
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

          {/* VISUAL SYNC CALENDAR PANEL */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 mb-6 gap-4">
              <div>
                <h4 className="text-base font-bold text-slate-905">Monthly Roster Schedule</h4>
                <p className="text-xs text-slate-450 mt-1">Select any highlighted date cell to view matching activities.</p>
              </div>

              {/* MONTH NAVIGATION */}
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 bg-slate-50 text-slate-650 transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-slate-800 min-w-[120px] text-center uppercase tracking-wide">
                  {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 bg-slate-50 text-slate-650 transition"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {selectedDateFilter && (
                  <button
                    onClick={() => setSelectedDateFilter(null)}
                    className="text-xs bg-slate-100 hover:bg-slate-204 text-slate-600 font-bold px-2.5 py-1.5 rounded-lg transition"
                  >
                    Clear Filter
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
              {/* Offset days */}
              {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }).map((_, idx) => (
                <div key={`offset-admin-${idx}`} className="h-20 bg-slate-50/40 rounded-lg border border-slate-100/50"></div>
              ))}

              {/* Day cells */}
              {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }).map((_, idx) => {
                const dayNum = idx + 1;
                const thisDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), dayNum);
                const isSelected = selectedDateFilter && 
                  selectedDateFilter.getFullYear() === thisDate.getFullYear() &&
                  selectedDateFilter.getMonth() === thisDate.getMonth() &&
                  selectedDateFilter.getDate() === thisDate.getDate();

                // Find matching tasks for this day of current selection
                const dayTasks = tasks.filter(t => {
                  if (!isSameDay(thisDate, t.scheduled_at)) return false;
                  if (selectedUserFilter !== 'all' && String(t.assigned_to) !== selectedUserFilter) return false;
                  if (selectedStatusFilter !== 'all' && t.status !== selectedStatusFilter) return false;
                  if (selectedTypeFilter !== 'all' && t.task_type !== selectedTypeFilter) return false;
                  return true;
                });

                const pending = dayTasks.filter(t => t.status === 'pending');
                const completed = dayTasks.filter(t => t.status === 'completed');
                const isToday = isSameDay(new Date(), thisDate.toISOString());

                return (
                  <button
                    key={`day-admin-${dayNum}`}
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
                          : 'text-slate-705'
                      }`}>
                        {dayNum}
                      </span>
                    </div>

                    <div className="w-full space-y-1 mt-1">
                      {dayTasks.length > 0 ? (
                        <div className="flex flex-col items-start w-full">
                          <span className="text-[9.5px] font-bold text-slate-700 block truncate max-w-full">
                            {dayTasks.length} Task{dayTasks.length > 1 ? 's' : ''}
                          </span>
                          <div className="flex space-x-1 mt-0.5">
                            {pending.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />}
                            {completed.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
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

          {/* TASKS TIMELINE RECORDS LEDGER */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
            <div className="flex justify-between items-center border-b pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-905">
                  {selectedDateFilter 
                    ? `Tasks Agenda for ${selectedDateFilter.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : "Comprehensive User Tasks Ledger"}
                </h3>
                <p className="text-xs text-slate-450 mt-1">List of schedules and check-in logs based on your selection filters.</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3">Task Details</th>
                    <th className="px-4 py-3">Scheduled At</th>
                    <th className="px-4 py-3">Responsible User</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {tasks
                    .filter(t => {
                      if (selectedDateFilter && !isSameDay(selectedDateFilter, t.scheduled_at)) return false;
                      if (selectedUserFilter !== 'all' && String(t.assigned_to) !== selectedUserFilter) return false;
                      if (selectedStatusFilter !== 'all' && t.status !== selectedStatusFilter) return false;
                      if (selectedTypeFilter !== 'all' && t.task_type !== selectedTypeFilter) return false;
                      return true;
                    })
                    .map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1.5 mb-1 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              task.task_type === 'visit' ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {task.task_type}
                            </span>
                            <span className="font-semibold text-slate-800">{task.company_name}</span>
                          </div>
                          <div className="text-xs text-slate-500">Contact Person: {task.client_name}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-xs text-slate-700">
                          {new Date(task.scheduled_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-semibold text-slate-700 flex items-center space-x-1">
                            <UserIcon className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{task.assignee_name}</span>
                          </div>
                          <div className="text-[9px] text-slate-400 uppercase font-bold text-slate-500">Created by: {task.creator_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            task.status === 'completed' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-orange-100 text-orange-855'
                          }`}>
                            {task.status === 'completed' ? 'Completed' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          {task.status === 'completed' ? (
                            <button
                              onClick={() => handleViewAnswers(task)}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold border border-emerald-202 hover:bg-emerald-100 rounded-lg transition"
                            >
                              View Submission Report
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">No report filed</span>
                          )}
                        </td>
                      </tr>
                    ))}

                  {tasks.filter(t => {
                    if (selectedDateFilter && !isSameDay(selectedDateFilter, t.scheduled_at)) return false;
                    if (selectedUserFilter !== 'all' && String(t.assigned_to) !== selectedUserFilter) return false;
                    if (selectedStatusFilter !== 'all' && t.status !== selectedStatusFilter) return false;
                    if (selectedTypeFilter !== 'all' && t.task_type !== selectedTypeFilter) return false;
                    return true;
                  }).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-450 italic bg-slate-50/50">
                        No operations tasks or agendas matching this setup. Select another date or clear filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CLOSE CONTENT REGION CONTAINER */}
      </div>

      {/* DETAILED RESPONSES MODAL OVERLAY */}
      {selectedTaskForModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-5 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <div>
                <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded uppercase font-bold text-slate-500 font-display font-semibold">Form Observation Record</span>
                <h4 className="text-base font-bold text-slate-900 mt-1">{selectedTaskForModal.company_name}</h4>
              </div>
              <button 
                onClick={() => setSelectedTaskForModal(null)} 
                className="text-slate-400 hover:text-slate-700 font-extrabold text-lg bg-slate-200/50 p-1 px-2.5 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-left">
              {/* DISPLAY SAVED CHECK-IN / CLOSURE COMMENTS */}
              {selectedTaskForModal.comments && (
                <div className="p-4 bg-emerald-50 bg-opacity-30 border border-emerald-100 rounded-xl space-y-1 text-left shadow-sm">
                  <div className="flex items-center space-x-1.5 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                    <span>📝 Check-In comments / Closure Notes</span>
                  </div>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed italic mt-1 font-medium bg-white p-2.5 rounded-lg border border-slate-100">
                    "{selectedTaskForModal.comments}"
                  </p>
                </div>
              )}

              {/* PLAYBACK SAVED AUDIO */}
              {selectedTaskForModal.voice_url && (
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2">
                  <div className="flex items-center space-x-1.5 text-emerald-850 font-bold text-xs uppercase tracking-wider">
                    <Volume2 className="h-4 w-4 text-emerald-600" />
                    <span>Attached Field Report Voice Memo</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Play/listen to the recorded voice diagnostic saved on the server for this activity:</p>
                  <audio src={selectedTaskForModal.voice_url} controls className="w-full h-8 mt-1 text-xs" />
                </div>
              )}

              {/* DISPLAY SAVED GEOLOCATION COORDINATES */}
              {(!modalLoading) && (
                <div className="p-4 bg-slate-50 border border-slate-155 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <MapPin className="h-4 w-4 text-emerald-600 animate-pulse" />
                    <span>Captured Check-in Location</span>
                  </div>
                  {modalLatitude !== null && modalLongitude !== null ? (
                    <div>
                      <p className="text-xs text-slate-700 font-medium">Automatic location successfully logged on submission:</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[11px] font-mono bg-white px-2.5 py-1 border border-slate-200 rounded text-slate-700">
                          Lat: <strong className="text-slate-900">{modalLatitude.toFixed(6)}</strong>
                        </span>
                        <span className="text-[11px] font-mono bg-white px-2.5 py-1 border border-slate-200 rounded text-slate-705">
                          Lng: <strong className="text-slate-900">{modalLongitude.toFixed(6)}</strong>
                        </span>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${modalLatitude},${modalLongitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 py-1 px-3.5 rounded font-bold underline inline-flex items-center space-x-1 text-xs"
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
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
