import React, { useState } from 'react';
import { KeyRound, Mail, UserCheck, ShieldAlert } from 'lucide-react';
import appLogo from '../assets/images/field_dynamics_logo_1782209488478.jpg';

interface LoginFormProps {
  onLoginSuccess: (token: string, role: string, name: string, userId: number) => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent, overrideEmail?: string, overridePassword?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const loginEmail = overrideEmail || email;
    const loginPassword = overridePassword || password;

    if (!loginEmail || !loginPassword) {
      setError("Please fill in all email and password fields");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Authentication request failed");
      }

      onLoginSuccess(data.access_token, data.role, data.name, data.userId);
    } catch (err: any) {
      setError(err.message || "Network error. Please make sure the service is online.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100 font-sans">
        <div>
          <div className="mx-auto flex items-center justify-center mb-6">
            <div className="p-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl shadow-inner flex items-center justify-center w-28 h-28 hover:border-emerald-300 transition-all">
              <img 
                src={appLogo} 
                alt="Logo" 
                className="h-full w-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <h2 className="mt-4 text-center text-3xl font-black text-slate-900 tracking-tight">
            Field Dynamics
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Sign in to manage operations & submit field reports
          </p>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-sm rounded-lg flex items-start space-x-2">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={(e) => handleLogin(e)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="email-input">
                Email Address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email-input"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 placeholder-slate-400 text-sm transition-all"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="password-input">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="h-5 w-5" />
                </div>
                <input
                  id="password-input"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 placeholder-slate-400 text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              id="submit-login-button"
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md shadow-emerald-600/15"
            >
              {loading ? "Authenticating..." : "Sign In to Field Dynamics"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
