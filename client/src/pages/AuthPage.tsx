import axios from 'axios';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ShieldCheck, Database, Layers, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const allowedDomains = ['gmail.com', 'kongu.edu'];

const isEmailValid = (value: string) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1].toLowerCase();
  return allowedDomains.some((d) => domain === d || domain.endsWith('.' + d));
};

const AuthPage = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isEmailValid(email) || password.length < 6) {
      setError('Please enter a valid email and password (minimum 6 characters).');
      return;
    }

    if (mode === 'register' && name.trim().length === 0) {
      setError('Please enter your full name.');
      return;
    }

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(String(err.response.data.message));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed. Please check your credentials.');
      }
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-theme-bg px-4 py-12 text-theme-text-primary">
      <div className="relative z-10 grid w-full max-w-4xl grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 items-stretch">
        {/* Left Side: Brand Overview */}
        <div className="saas-card p-8 sm:p-10 flex flex-col justify-between bg-gradient-to-br from-theme-surface via-theme-surface-soft to-theme-surface-blue">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-theme-text-primary">StreamWeaver</h1>
                <p className="text-[11px] font-semibold text-theme-primary uppercase tracking-wider">Enterprise ETL</p>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-theme-text-primary tracking-tight">
              Access your modern data pipeline workspace
            </h2>
            <p className="mt-3 text-sm text-theme-text-secondary leading-relaxed">
              Stream, profile, map, transform, and validate large CSV & JSON datasets with zero RAM bottleneck.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border flex items-center gap-3">
              <Database size={18} className="text-theme-primary flex-shrink-0" />
              <span className="text-xs font-semibold text-theme-text-secondary">Chunked streaming ingestion up to 5GB</span>
            </div>
            <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border flex items-center gap-3">
              <Layers size={18} className="text-theme-primary flex-shrink-0" />
              <span className="text-xs font-semibold text-theme-text-secondary">Visual mapping studio & V8 sandbox transforms</span>
            </div>
            <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border flex items-center gap-3">
              <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-theme-text-secondary">Automated quality validation & governance</span>
            </div>
          </div>
        </div>

        {/* Right Side: Login / Register Form */}
        <div className="saas-card p-8 sm:p-10 flex flex-col justify-center bg-theme-surface">
          {/* Mode Switcher Pills */}
          <div className="mb-6 flex rounded-xl border border-theme-border bg-theme-surface-soft p-1">
            <button
              type="button"
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                mode === 'login'
                  ? 'bg-theme-surface text-theme-primary shadow-xs'
                  : 'text-theme-text-muted hover:text-theme-text-primary'
              }`}
              onClick={() => setMode('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                mode === 'register'
                  ? 'bg-theme-surface text-theme-primary shadow-xs'
                  : 'text-theme-text-muted hover:text-theme-text-primary'
              }`}
              onClick={() => setMode('register')}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={submit}>
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-theme-text-muted mb-1.5 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  className="saas-input w-full"
                  placeholder="e.g. Naveen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-theme-text-muted mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <input
                className="saas-input w-full"
                placeholder="name@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text-muted mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                className="saas-input w-full"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-2.5 rounded-xl text-xs sm:text-sm mt-2 flex items-center justify-center gap-1.5"
            >
              <span>{mode === 'login' ? 'Sign In to Workspace' : 'Create Account'}</span>
              <ArrowRight size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
