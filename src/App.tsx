import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import AdminDashboard from './components/AdminDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import { LogOut, ClipboardList, Shield, User, Landmark } from 'lucide-react';
import appLogo from './assets/images/field_dynamics_logo_1782209488478.jpg';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('crm_token'));
  const [role, setRole] = useState<string | null>(localStorage.getItem('crm_role'));
  const [name, setName] = useState<string | null>(localStorage.getItem('crm_name'));
  const [userId, setUserId] = useState<number | null>(() => {
    const cached = localStorage.getItem('crm_userId');
    return cached ? Number(cached) : null;
  });

  const handleLoginSuccess = (newToken: string, newRole: string, newName: string, newUserId: number) => {
    localStorage.setItem('crm_token', newToken);
    localStorage.setItem('crm_role', newRole);
    localStorage.setItem('crm_name', newName);
    localStorage.setItem('crm_userId', String(newUserId));

    setToken(newToken);
    setRole(newRole);
    setName(newName);
    setUserId(newUserId);
  };

  const handleLogOut = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_role');
    localStorage.removeItem('crm_name');
    localStorage.removeItem('crm_userId');

    setToken(null);
    setRole(null);
    setName(null);
    setUserId(null);
  };

  // If not logged in, render the login form
  if (!token || !role || !name || userId === null) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* CORPORATE APP BAR HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 shrink-0 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo/Brand */}
            <div className="flex items-center space-x-3">
              <div className="h-11 w-11 bg-slate-800/80 border border-dashed border-slate-700/80 rounded-xl flex items-center justify-center p-1.5 shadow-inner hover:border-emerald-500/50 transition-all shrink-0">
                <img 
                  src={appLogo} 
                  alt="Logo" 
                  className="h-full w-full object-contain rounded-lg bg-white p-0.5" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <span className="font-display font-black text-white text-base tracking-tight block">Field Dynamics</span>
                <span className="hidden sm:inline-block text-[9px] uppercase font-bold tracking-widest text-emerald-400">
                  Field Operations
                </span>
              </div>
            </div>

            {/* Profile and Logout controls */}
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-100">{name}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center justify-end space-x-1">
                  {role === 'admin' ? (
                    <span className="text-violet-405 font-bold">Admin Controller</span>
                  ) : role === 'management' ? (
                    <span className="text-blue-505 font-bold">Management Officer</span>
                  ) : role === 'manager' ? (
                    <span className="text-amber-405 font-bold">Sales Manager</span>
                  ) : (
                    <span className="text-emerald-405 font-bold">Sales Executive</span>
                  )}
                </span>
              </div>

              {/* Mobile Profile pill */}
              <div className="flex md:hidden items-center p-1 px-2.5 bg-slate-800 rounded-lg">
                <User className="h-4 w-4 text-slate-300 mr-1" />
                <span className="text-xs text-slate-100 font-bold max-w-[80px] truncate">{name}</span>
              </div>

              <div className="h-6 w-px bg-slate-800"></div>

              {/* Sign Out Button */}
              <button
                id="header-signout-btn"
                onClick={handleLogOut}
                className="flex items-center space-x-1 p-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-all border border-slate-200 active:scale-95 shadow-sm"
              >
                <LogOut className="h-4 w-4 text-emerald-600" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* PRIMARY CONTENT COMPARTMENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Banner with Profile/Status for welcome context */}
        <div className="mb-6 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold font-display text-slate-905 tracking-tight">
              Welcome back, {name}!
            </h1>
            <p className="text-sm text-slate-500">
              {role === 'admin' ? (
                <span>System configuration panel. Add client registries, orchestrate reporting personnel, and forge dynamic form questionnaires.</span>
              ) : role === 'management' ? (
                <span>Management panel. Review client registries, orchestrate reporting personnel, and manage dynamic form questionnaires.</span>
              ) : role === 'manager' ? (
                <span>Line dashboard. Dispatch client appointments to subordinates, manage task queues, and analyze field report answers.</span>
              ) : (
                <span>Representative dashboard. View assigned schedules, self-schedule field visits, and complete interactive activity forms.</span>
              )}
            </p>
          </div>

          <div className="shrink-0 flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-semibold uppercase">Operational Role:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              role === 'admin' 
                ? 'bg-violet-100 text-violet-700 border border-violet-150' 
                : role === 'management'
                ? 'bg-blue-100 text-blue-700 border border-blue-150'
                : role === 'manager'
                ? 'bg-amber-100 text-amber-700 border border-amber-150'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-150'
            }`}>
              {role === 'management' ? 'Management' : role}
            </span>
          </div>
        </div>

        {/* COMPONENT DESK GRID */}
        <div className="animate-fade-in">
          {(role === 'admin' || role === 'management') && <AdminDashboard token={token} />}
          {role === 'manager' && <ManagerDashboard token={token} />}
          {role === 'executive' && <ExecutiveDashboard token={token} userId={userId} />}
        </div>

      </main>

      {/* BASEBOARD FOOTER */}
      <footer className="py-6 border-t border-slate-201 text-center text-xs text-slate-450 shrink-0 bg-white">
        <p className="font-medium text-slate-500">
          Field Dynamics Portal &copy; {new Date().getFullYear()} — Secure REST Interface
        </p>
      </footer>
    </div>
  );
}
