import React, { useState, useEffect } from 'react';
import { Task, Client, FormQuestion } from '../types';
import { 
  Calendar as CalendarIcon, ClipboardCheck, Clock, MapPin, PhoneCall, PlusCircle, 
  BookOpen, CheckSquare, ClipboardList, CheckCircle, AlertCircle, ChevronLeft, ChevronRight,
  Mic, Square, Play, Volume2, RotateCcw, UploadCloud, Edit3, Trash2, Menu
} from 'lucide-react';
import DynamicFormRenderer from './DynamicFormRenderer';

interface ExecutiveDashboardProps {
  token: string;
  userId: number;
}

export default function ExecutiveDashboard({ token, userId }: ExecutiveDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'schedule' | 'create-task'>('schedule');

  // Mobile menu open status
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // List States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);

  // Self scheduling form state
  const [clientId, setClientId] = useState('');
  const [taskType, setTaskType] = useState<'visit' | 'call'>('call');
  const [scheduledAt, setScheduledAt] = useState('');

  // Active Task Completing workflow modal
  const [activeTaskForForm, setActiveTaskForForm] = useState<Task | null>(null);
  const [editAnswers, setEditAnswers] = useState<any[]>([]);

  // Follow-up flow after report submissions
  const [showFollowUpPrompt, setShowFollowUpPrompt] = useState(false);
  const [justCompletedTask, setJustCompletedTask] = useState<Task | null>(null);
  const [followUpType, setFollowUpType] = useState<'visit' | 'call'>('call');
  const [followUpDateTime, setFollowUpDateTime] = useState('');
  const [followUpComments, setFollowUpComments] = useState('');

  // Location States
  const [sessionTypes, setSessionTypes] = useState<any[]>([]);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Sound/Voice Recording State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [voiceSavedNote, setVoiceSavedNote] = useState<boolean>(false);

  // Selected date filter for the Calendar
  const [selectedDateFilter, setSelectedDateFilter] = useState<Date | null>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Status notes
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const triggerNotify = (msg: string, isError = false) => {
    if (isError) {
      setErrorText(msg);
      setTimeout(() => setErrorText(null), 5000);
    } else {
      setSuccessText(msg);
      setTimeout(() => setSuccessText(null), 5000);
    }
  };

  const isFutureTask = (task: Task) => {
    if (!task || !task.scheduled_at) return false;
    const taskDate = new Date(task.scheduled_at);
    const today = new Date();
    const taskDateMidnight = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return taskDateMidnight > todayMidnight;
  };

  // LOAD SERVICES
  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setTasks(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setClients(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/admin/forms', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setQuestions(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchSessionTypes = async () => {
    try {
      const res = await fetch('/api/session-types', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setSessionTypes(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchTasks();
    fetchClients();
    fetchQuestions();
    fetchSessionTypes();
  }, [token]);

  useEffect(() => {
    if (activeTaskForForm) {
      if (activeTaskForForm.status === 'completed') {
        // If editing, we do not query geolocation. We retain the previously loaded location.
      } else {
        // New completion: request geolocation automatically
        setLatitude(null);
        setLongitude(null);
        setLocationError(null);
        setIsCapturingLocation(true);
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLatitude(position.coords.latitude);
              setLongitude(position.coords.longitude);
              setIsCapturingLocation(false);
            },
            (error) => {
              console.error("Geolocation error:", error);
              setIsCapturingLocation(false);
              if (error.code === error.PERMISSION_DENIED) {
                setLocationError("Access denied. Please enable location permissions in browser settings.");
              } else {
                setLocationError("Error getting automatic coordinates: " + error.message);
              }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        } else {
          setIsCapturingLocation(false);
          setLocationError("Web browser does not support Geolocation.");
        }
      }
    } else {
      // Clear when closing modal
      setLatitude(null);
      setLongitude(null);
      setLocationError(null);
      setIsCapturingLocation(false);
    }
  }, [activeTaskForForm]);

  // SELF SCHEDULING SUBMIT HANDLER
  const handleCreateSelfTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !taskType || !scheduledAt) {
      triggerNotify("Please enter all details.", true);
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
          client_id: Number(clientId),
          assigned_to: Number(userId), // self assignation
          task_type: taskType,
          scheduled_at: new Date(scheduledAt).toISOString()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create task");

      triggerNotify("Personal field session scheduled successfully!");
      setClientId('');
      setScheduledAt('');
      setActiveTab('schedule');
      fetchTasks();
    } catch (err: any) {
      triggerNotify(err.message, true);
    }
  };

  // OPEN EDIT FOR ALREADY ACTIONED TASK (WITHIN 24 HOURS MAPPED ACCORDINGLY)
  const handleOpenEditWorkflow = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/submission`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error("Answers are unavailable or could not be loaded for editing.");
      }
      const data = await res.json();
      setEditAnswers(data.answers || []);
      setAudioUrl(task.voice_url || null);
      setAudioBase64(null);
      setVoiceSavedNote(!!task.voice_url);
      setLatitude(data.latitude || null);
      setLongitude(data.longitude || null);
      setShowFollowUpPrompt(false);
      setActiveTaskForForm(task);
    } catch (err: any) {
      triggerNotify(err.message, true);
    }
  };

  // COMPLETE MULTIPART FORM FLOW HANDLER
  const handleCompleteTaskWithAnswers = async (answers: any[]) => {
    if (!activeTaskForForm) return;
    setSubmitLoading(true);

    try {
      const res = await fetch(`/api/tasks/${activeTaskForForm.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          answers,
          latitude,
          longitude
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to finalize task");

      triggerNotify(
        activeTaskForForm.status === 'completed' 
          ? "Report submitted successfully!" 
          : "Report filed successfully! Task marked completed."
      );
      
      setJustCompletedTask(activeTaskForForm);
      setShowFollowUpPrompt(true);
      setFollowUpDateTime('');
      setFollowUpType('call');
      setFollowUpComments('');

      // Cleanup voice states
      setAudioUrl(null);
      setAudioBase64(null);
      setVoiceSavedNote(false);
      fetchTasks();
    } catch (err: any) {
      triggerNotify(err.message, true);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSkipFollowUp = async () => {
    const taskObj = justCompletedTask || activeTaskForForm;
    if (taskObj && followUpComments.trim()) {
      setSubmitLoading(true);
      try {
        await fetch(`/api/tasks/${taskObj.id}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ comments: followUpComments })
        });
        triggerNotify("Closure comments recorded successfully!");
      } catch (err) {
        console.error("Failed to save closure comments", err);
      } finally {
        setSubmitLoading(false);
      }
    }
    setActiveTaskForForm(null);
    setShowFollowUpPrompt(false);
    setJustCompletedTask(null);
    setFollowUpComments('');
    fetchTasks();
  };

  const handleScheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const taskObj = justCompletedTask || activeTaskForForm;
    if (!taskObj) return;
    if (!followUpDateTime) {
      triggerNotify("Please select a date and time for the follow-up.", true);
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: taskObj.client_id,
          assigned_to: userId,
          task_type: followUpType,
          scheduled_at: new Date(followUpDateTime).toISOString(),
          comments: followUpComments
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create follow-up task");

      triggerNotify("Follow-up task scheduled and added to your calendar successfully!");
      fetchTasks();
      setActiveTaskForForm(null);
      setShowFollowUpPrompt(false);
      setJustCompletedTask(null);
      setFollowUpComments('');
    } catch (err: any) {
      triggerNotify(err.message, true);
    } finally {
      setSubmitLoading(false);
    }
  };

  // AUDIO RECORDING UTILITIES
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
      };

      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setIsRecording(true);
      setVoiceSavedNote(false);
    } catch (err: any) {
      console.error(err);
      triggerNotify("Could not access microphone. Ensure hardware permissions are set up.", true);
    }
  };

  const handleStopRecording = () => {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      recorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleUploadVoice = async () => {
    if (!audioBase64 || !activeTaskForForm) return;
    setUploadingVoice(true);
    try {
      const res = await fetch(`/api/tasks/${activeTaskForForm.id}/voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ voice_base64: audioBase64 })
      });
      const data = await res.json();
      if (res.ok) {
        setVoiceSavedNote(true);
        triggerNotify("Voice message saved on the server successfully!");
        fetchTasks(); // Refresh so we store updated details
      } else {
        throw new Error(data.detail || "Upload rejected");
      }
    } catch (err: any) {
      triggerNotify(err.message, true);
    } finally {
      setUploadingVoice(false);
    }
  };

  const handleClearVoice = () => {
    setAudioUrl(null);
    setAudioBase64(null);
    setVoiceSavedNote(false);
  };

  // VISUAL CALENDAR DATE COMPUTATIONS
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

  // FILTER LOGS
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  // Filter pending/and completed tasks for target selected calendar day (if clicked)
  const scheduledOnCalendarDate = tasks.filter(t => {
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 font-display">Navigation Menu</p>
              <p className="hidden lg:block text-[11px] text-slate-500 px-3 mt-1 font-semibold">My Operations Hub</p>
            </div>
            
            {/* Mobile screen hamburger drawer button */}
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
              id="exec-tab-schedule"
              onClick={() => { setActiveTab('schedule'); setMobileMenuOpen(false); }}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left ${
                activeTab === 'schedule'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10 font-bold'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-850'
              }`}
            >
              <ClipboardCheck className="h-4 w-4 shrink-0 font-bold" />
              <span>My Schedule ({pendingTasks.length})</span>
            </button>

            <button
              id="exec-tab-create-task"
              onClick={() => { setActiveTab('create-task'); setMobileMenuOpen(false); }}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-left ${
                activeTab === 'create-task'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-850'
              }`}
            >
              <PlusCircle className="h-4 w-4 shrink-0 font-bold" />
              <span>Self-Assign Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT REGION COLUMN CONTAINER */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Alert panels */}
        {successText && (
          <div className="p-4 bg-emerald-50 border-l-4 border-emerald-505 text-emerald-800 text-sm rounded-lg flex items-center shadow-sm animate-fade-in">
            <BookOpen className="h-4 w-4 mr-2 text-emerald-600 shrink-0" />
            <span>{successText}</span>
          </div>
        )}
        {errorText && (
          <div className="p-4 bg-rose-50 border-l-4 border-rose-505 text-rose-800 text-sm rounded-lg shadow-sm flex items-center animate-fade-in">
            <AlertCircle className="h-4 w-4 mr-2 text-rose-505 shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

      {activeTab === 'schedule' && (
        <div className="space-y-6">
          
          {/* VISUAL MONTH CALENDAR PANEL */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 mb-6 gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <CalendarIcon className="h-5 w-5 text-emerald-600" />
                  <span>My Visual Operational Calendar</span>
                </h3>
                <p className="text-xs text-slate-450 mt-0.5">Click any calendar cell to filter field activities corresponding to that date</p>
              </div>

              {/* MONTH NAVIGATION */}
              <div className="flex items-center space-x-3 self-start md:self-center">
                <button 
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-55 bg-slate-50 text-slate-600 transition"
                  id="calendar-prev-month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-slate-800 min-w-[120px] text-center uppercase tracking-wide">
                  {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-55 bg-slate-50 text-slate-600 transition"
                  id="calendar-next-month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                
                {selectedDateFilter && (
                  <button
                    onClick={() => setSelectedDateFilter(null)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2.5 py-1.5 rounded-lg transition"
                  >
                    Show All Dates
                  </button>
                )}
              </div>
            </div>

            {/* CALENDAR ROW ELEMENTS */}
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
                <div key={`offset-${index}`} className="h-20 bg-slate-50/40 rounded-lg border border-slate-100/50"></div>
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
                    key={`day-${dayNum}`}
                    onClick={() => setSelectedDateFilter(thisDate)}
                    className={`h-22 p-2.5 rounded-xl border flex flex-col items-start justify-between text-left transition-all ${
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
                          ? 'text-indigo-700 underline font-extrabold' 
                          : 'text-slate-700'
                      }`}>
                        {dayNum}
                      </span>
                      {isToday && (
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded font-extrabold">TDY</span>
                      )}
                    </div>

                    <div className="w-full space-y-1 mt-1">
                      {/* Show tiny pill previews to avoid visual clutter */}
                      {dayTasks.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {dayPending.length > 0 && (
                            <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" title={`${dayPending.length} pending`} />
                          )}
                          {dayCompleted.length > 0 && (
                            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title={`${dayCompleted.length} completed`} />
                          )}
                          <span className="text-[9px] font-bold text-slate-500 font-mono">
                            {dayTasks.length} task{dayTasks.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-300 italic">No visits</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE DAY HIGHLIGHT LISTINGS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* PENDING TASKS PANEL */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b pb-3 flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <span>
                    {selectedDateFilter 
                      ? `Schedules for ${selectedDateFilter.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                      : "Pending Field Work Sessions"}
                  </span>
                </span>
                <span className="text-xs bg-orange-100 text-orange-700 px-2 rounded-full font-bold">
                  {selectedDateFilter 
                    ? `${scheduledOnCalendarDate.filter(t => t.status === 'pending').length} pending`
                    : `${pendingTasks.length} total tasks`}
                </span>
              </h3>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {(selectedDateFilter ? scheduledOnCalendarDate.filter(t => t.status === 'pending') : pendingTasks).map((task) => (
                  <div 
                    key={task.id} 
                    className="p-5 bg-slate-50 hover:bg-slate-50/80 rounded-xl border border-slate-100 flex flex-col space-y-3 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            task.task_type === 'visit' 
                              ? 'bg-indigo-50 text-indigo-700' 
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {task.task_type === 'visit' ? '📍 Field Visit' : '📞 Pitch Call'}
                          </span>
                          <strong className="text-slate-800 text-sm ml-1">{task.company_name}</strong>
                        </div>
                        <div className="text-xs text-slate-550 font-semibold mt-1">Contact: {task.client_name}</div>
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono font-bold uppercase shrink-0">
                        ID: #{task.id}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 text-xs text-slate-450 border-t border-slate-205 py-2">
                      <CalendarIcon className="h-4 w-4 text-slate-400" />
                      <span className="font-semibold text-slate-700">
                        {getTaskDurationDisplay(task)}
                      </span>
                    </div>

                    <button
                      id={`exec-complete-task-${task.id}`}
                      onClick={() => {
                        if (isFutureTask(task)) {
                          triggerNotify("The task assigned on a future date cannot be completed now.", true);
                          return;
                        }
                        setEditAnswers([]);
                        setAudioUrl(task.voice_url || null);
                        setVoiceSavedNote(!!task.voice_url);
                        setShowFollowUpPrompt(false);
                        setActiveTaskForForm(task);
                      }}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs rounded-lg transition shadow-md shadow-emerald-500/10"
                    >
                      Open Dynamic Form & Complete Task
                    </button>
                  </div>
                ))}

                {(selectedDateFilter ? scheduledOnCalendarDate.filter(t => t.status === 'pending') : pendingTasks).length === 0 && (
                  <div className="p-12 text-center italic text-slate-400 border border-dashed rounded-xl">
                    No pending field sessions scheduled on this date selection! You are completely up to date.
                  </div>
                )}
              </div>
            </div>

            {/* COMPLETED TASKS JOURNAL */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b pb-3 flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <span>Session Records Submitted</span>
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 rounded-full font-bold">
                  {selectedDateFilter 
                    ? `${scheduledOnCalendarDate.filter(t => t.status === 'completed').length} completed`
                    : `${completedTasks.length} total done`}
                </span>
              </h3>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {(selectedDateFilter ? scheduledOnCalendarDate.filter(t => t.status === 'completed') : completedTasks).map((task) => {
                  // Determine 24 hour editing window eligibility
                  const completionTime = task.completed_at ? new Date(task.completed_at).getTime() : 0;
                  const hoursSinceCompletion = (Date.now() - completionTime) / (1000 * 60 * 60);
                  const isEligibleToEdit = hoursSinceCompletion < 24;

                  return (
                    <div key={task.id} className="p-4 bg-slate-50/70 border border-slate-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-800">{task.company_name}</span>
                          <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                            {task.task_type}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Submitted: {task.completed_at ? new Date(task.completed_at).toLocaleString() : "Date unavailable"}
                        </div>
                        {task.voice_url && (
                          <div className="flex items-center text-[10px] text-emerald-600 mt-1 space-x-1">
                            <Volume2 className="h-3.5 w-3.5" />
                            <span>✓ Attached voice note report</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {isEligibleToEdit ? (
                          <button
                            id={`exec-edit-task-${task.id}`}
                            onClick={() => handleOpenEditWorkflow(task)}
                            className="text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-150 px-2.5 py-1.5 rounded-lg font-bold flex items-center space-x-1 transition active:scale-95"
                            title="Edit this submission (Available for 24 hours)"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Edit Form (24h)</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded italic">
                            Locked after 24h
                          </span>
                        )}

                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-150 px-2 py-1 rounded-lg font-bold inline-flex items-center">
                          <CheckCircle className="h-3 w-3 mr-1" /> Submitted
                        </span>
                      </div>
                    </div>
                  );
                })}

                {(selectedDateFilter ? scheduledOnCalendarDate.filter(t => t.status === 'completed') : completedTasks).length === 0 && (
                  <div className="p-12 text-center text-slate-400 italic">
                    No completed task sessions listed on this date selection.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE PERSONAL SELF SCHEDULE */}
      {activeTab === 'create-task' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-lg mx-auto">
          <div className="border-b pb-3 mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              <span>Self-Assign Session Target</span>
            </h3>
            <p className="text-xs text-slate-450 mt-1">Add details below to queue up a personal client session in your schedule</p>
          </div>

          <form onSubmit={handleCreateSelfTask} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Select Commercial client</label>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-1 block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none"
              >
                <option value="">-- Choose Account --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name} (Contact: {c.contact_name})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest font-semibold">Session Type</label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setTaskType('call')}
                  className={`py-3 px-4 rounded-xl border text-center text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                    taskType === 'call' 
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-700 shadow-sm' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-705'
                  }`}
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>Pitch Call (15m default)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTaskType('visit')}
                  className={`py-3 px-4 rounded-xl border text-center text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                    taskType === 'visit' 
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-700 shadow-sm' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-705'
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                  <span>Office Visit (45m default)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Date and time</label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-1 block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900"
              />
            </div>

            <button
              id="exec-self-scheduler-submit"
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-emerald-500/10 active:scale-95"
            >
              Queue Task Target
            </button>
          </form>
        </div>
      )}

      {/* CLOSE MAIN CONTENT REGION COLUMN CONTAINER */}
      </div>

      {/* DYNAMIC FORM FILLING DRAWER MODAL UPON CLICKING TASK */}
      {activeTaskForForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-50 border-b flex items-center justify-between">
              <div>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase">
                  {showFollowUpPrompt ? 'Next Steps' : (activeTaskForForm.status === 'completed' ? 'Edit field check-in report' : 'Active field check-in Form')}
                </span>
                <h4 className="text-base font-extrabold text-slate-900 mt-1">{activeTaskForForm.company_name}</h4>
                <p className="text-xs text-slate-450 mt-0.5">
                  {showFollowUpPrompt ? 'Select next follow-up action option below' : 'Please review observations carefully before submitting.'}
                </p>
              </div>
              <button 
                onClick={() => {
                  if (showFollowUpPrompt) {
                    handleSkipFollowUp();
                  } else if (confirm("Discard entries? Changes will be lost.")) {
                    setActiveTaskForForm(null);
                  }
                }}
                className="text-slate-400 hover:text-slate-700 font-extrabold text-md p-1 px-3.5 bg-slate-200/50 rounded-full"
              >
                ✕
              </button>
            </div>

            {showFollowUpPrompt ? (
              <div className="p-6 space-y-6 flex-1 flex flex-col justify-between overflow-y-auto" id="followup-step-panel">
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                    <p className="text-sm font-bold text-emerald-800">🎉 Report Saved Successfully!</p>
                    <p className="text-xs text-emerald-600 mt-1">Your response for <strong>{activeTaskForForm.company_name}</strong> has been saved.</p>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold text-slate-800 text-center">Schedule Next Focus Follow-Up</h5>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed text-center">
                      Please select a customized date and time for the next session below to automatically add it to your calendar schedule. If no further contact is needed, select <strong>No Follow-up</strong>.
                    </p>
                  </div>

                  <form onSubmit={handleScheduleFollowUp} className="space-y-4" id="followup-inputs-form">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-semibold">Follow-Up Action Type</label>
                      <div className="grid grid-cols-2 gap-3 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setFollowUpType('call')}
                          className={`py-2.5 px-3 rounded-lg border text-center text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                            followUpType === 'call' 
                              ? 'border-emerald-600 bg-emerald-50/50 text-emerald-700 shadow-sm font-bold' 
                              : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Pitch Call</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFollowUpType('visit')}
                          className={`py-2.5 px-3 rounded-lg border text-center text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                            followUpType === 'visit' 
                              ? 'border-emerald-600 bg-emerald-50/50 text-emerald-700 shadow-sm font-bold' 
                              : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Office Visit</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="followup-datetime" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-semibold tracking-wider">Follow-Up Date & Time *</label>
                      <input
                        id="followup-datetime"
                        type="datetime-local"
                        required
                        value={followUpDateTime}
                        onChange={(e) => setFollowUpDateTime(e.target.value)}
                        className="mt-1.5 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="followup-comments" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-semibold tracking-wider">Comments / Follow-up Notes</label>
                      <textarea
                        id="followup-comments"
                        rows={3}
                        value={followUpComments}
                        onChange={(e) => setFollowUpComments(e.target.value)}
                        placeholder="Add checklist notes, client comments, or closure details..."
                        className="mt-1.5 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 focus:outline-none placeholder-slate-400"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0 pt-4 border-t border-slate-100">
                      <button
                        id="followup-btn-skip"
                        type="button"
                        onClick={handleSkipFollowUp}
                        className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                      >
                        No Follow-up
                      </button>

                      <button
                        id="followup-btn-schedule"
                        type="submit"
                        disabled={submitLoading}
                        className="flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-all text-center flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        {submitLoading ? "Scheduling..." : "Schedule Event"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                
                {/* AUDIO VOICE RECORDING COMPONENT */}
                <div className="p-5 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center space-x-1.5">
                      <Mic className="h-4 w-4 text-emerald-600" />
                      <span>Report Voice Message Memo</span>
                    </h5>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Save to Server</span>
                  </div>
                  
                  <p className="text-xs text-slate-500">Record a localized voice note detailing client reactions or operational summaries.</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 font-semibold">
                    {!isRecording ? (
                      <button
                        id="voice-start-btn"
                        type="button"
                        onClick={handleStartRecording}
                        className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs p-2 px-3.5 rounded-lg shadow-sm transition active:scale-95"
                      >
                        <Mic className="h-3.5 w-3.5 animate-pulse" />
                        <span>Record new message</span>
                      </button>
                    ) : (
                      <button
                        id="voice-stop-btn"
                        type="button"
                        onClick={handleStopRecording}
                        className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs p-2 px-3.5 rounded-lg shadow-sm transition animate-pulse"
                      >
                        <Square className="h-3.5 w-3.5 fill-white" />
                        <span>Stop recording</span>
                      </button>
                    )}

                    {audioUrl && !isRecording && (
                      <>
                        <div className="flex items-center space-x-2 border bg-white p-1 px-2.5 rounded-lg">
                          <audio src={audioUrl} controls className="h-8 max-w-[180px] text-xs" />
                        </div>

                        <button
                          id="voice-save-btn"
                          type="button"
                          onClick={handleUploadVoice}
                          disabled={uploadingVoice || !audioBase64}
                          className="flex items-center space-x-1.5 bg-emerald-650 hover:bg-emerald-600 text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold text-xs p-2 px-3.5 rounded-lg transition active:scale-95 disabled:opacity-50"
                        >
                          <UploadCloud className="h-4 w-4 text-emerald-600" />
                          <span>{uploadingVoice ? "Uploading..." : "Save to server"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleClearVoice}
                          className="p-2 bg-slate-200 text-slate-600 hover:bg-slate-300 rounded-lg text-xs"
                          title="Clear audio"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {voiceSavedNote && (
                    <div className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-3 py-1.5 rounded-lg flex items-center space-x-1 border border-emerald-150 animate-fade-in">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-650" />
                      <span>✓ File successfully finalized & synchronized on the secure storage volume!</span>
                    </div>
                  )}
                </div>

                {/* AUTOMATIC LOCATION RECORDING STATUS */}
                {isCapturingLocation && (
                  <div className="p-3.5 bg-blue-50 border border-blue-105 rounded-xl flex items-center space-x-2 text-xs text-blue-700 animate-pulse">
                    <MapPin className="h-4 w-4 text-blue-500 animate-bounce shrink-0" />
                    <span>Recording automatic check-in location coordinates...</span>
                  </div>
                )}

                {!isCapturingLocation && (latitude !== null && longitude !== null) && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center space-x-2.5 text-xs text-emerald-800">
                    <MapPin className="h-4.5 w-4.5 text-emerald-555 shrink-0 animate-fade-in" />
                    <div>
                      <p className="font-bold">
                        {activeTaskForForm.status === 'completed' ? "Previously Captured Location Retained" : "Check-in Location Recorded Automatically"}
                      </p>
                      <p className="font-mono text-[10px] text-emerald-600 mt-1">
                        Latitude: {latitude.toFixed(6)}, Longitude: {longitude.toFixed(6)}
                      </p>
                    </div>
                  </div>
                )}

                {!isCapturingLocation && locationError && (
                  <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl flex items-center space-x-2 text-xs text-amber-850">
                    <MapPin className="h-4 w-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-800">Automatic location recording offline</p>
                      <p className="text-[10px] text-amber-600 mt-0.5">{locationError}</p>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-indigo-850 flex space-x-2">
                  <AlertCircle className="h-4 w-4 text-indigo-505 shrink-0 mt-0.5" />
                  <span>
                    {activeTaskForForm.status === 'completed' 
                      ? "Updating these questions replaces your previous report answers."
                      : "By filling and submitting this report, the agenda status will permanently change to Completed under manager inspection."}
                  </span>
                </div>

                {/* RENDER DYNAMIC FORM WITH ANSWERS IF EDITING RECALIBRATES PRESETS */}
                {(() => {
                  const activeSessionType = sessionTypes.find(st => st.name === activeTaskForForm.task_type);
                  const filteredQuestions = questions.filter(q => {
                    if (activeSessionType && activeSessionType.template_id) {
                      return q.template_id === activeSessionType.template_id;
                    }
                    if (!q.session_type_id) return true;
                    return q.session_type_id === activeSessionType?.id;
                  });
                  return (
                    <DynamicFormRenderer
                      questions={filteredQuestions}
                      onSubmit={handleCompleteTaskWithAnswers}
                      loading={submitLoading}
                      initialAnswers={editAnswers}
                    />
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
