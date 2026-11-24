import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Shield,
  Clock,
  User,
  Phone,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  LogOut,
  Copy,
  ExternalLink,
  Sparkles,
  ArrowLeft,
  KeyRound,
  Utensils,
  Smartphone,
  Download
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  generateDynamicQrPassPayload,
  DYNAMIC_QR_WINDOW_SEC
} from '../data/employeesData';
import { getEmployeeRealtimeAllocations } from '../utils/allocationEngine';
import Toast from '../components/common/Toast';
import logoAsset from '../assets/logo.png';

const STORAGE_KEY = 'ahp_mobile_pass_emp_id';

const CATEGORY_THEMES = {
  Junior: {
    bg: 'bg-emerald-600',
    lightBg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    hex: '#009B4D',
  },
  Senior: {
    bg: 'bg-sky-600',
    lightBg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    hex: '#1684AA',
  },
  VIP: {
    bg: 'bg-purple-600',
    lightBg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800 border-purple-300',
    hex: '#6B46C1',
  },
};

export default function EmployeeMobilePass() {
  const { id: routeEmpId } = useParams();
  const navigate = useNavigate();
  const { data, addToast } = useApp();
  const employees = data.employees || [];
  const mealEntries = data.mealEntries || [];

  // Active employee state
  const [activeEmployee, setActiveEmployee] = useState(null);

  // Login form state
  const [idInput, setIdInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Rolling QR code state
  const [qrPayload, setQrPayload] = useState('');
  const [countdown, setCountdown] = useState(DYNAMIC_QR_WINDOW_SEC);
  const [liveClock, setLiveClock] = useState(() => new Date());

  // PWA 1-Tap Home Screen Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Detect if already installed & running standalone
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos && !isStandaloneMode) {
      setShowIosGuide(true);
    }

    // Capture native PWA install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        addToast('Mess Pass added to your Home Screen!', 'success');
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
    } else {
      addToast('To install: tap your browser menu (⋮) and tap "Add to Home screen".', 'info');
    }
  };

  // ── 1. Resolve employee from URL param, localStorage, or form
  useEffect(() => {
    if (employees.length === 0) return;

    if (routeEmpId) {
      const found = employees.find((e) => e.id.toUpperCase() === routeEmpId.toUpperCase());
      if (found) {
        setActiveEmployee(found);
        localStorage.setItem(STORAGE_KEY, found.id);
        return;
      }
    }

    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      const found = employees.find((e) => e.id.toUpperCase() === savedId.toUpperCase());
      if (found) {
        setActiveEmployee(found);
      }
    }
  }, [routeEmpId, employees]);

  // ── 2. Live clock and 30-second rolling dynamic QR generator
  useEffect(() => {
    if (!activeEmployee) return;

    // Immediately generate first payload
    setQrPayload(generateDynamicQrPassPayload(activeEmployee));
    setCountdown(DYNAMIC_QR_WINDOW_SEC);

    const clockTimer = setInterval(() => {
      setLiveClock(new Date());
    }, 1000);

    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Re-generate fresh rolling dynamic token
          setQrPayload(generateDynamicQrPassPayload(activeEmployee));
          return DYNAMIC_QR_WINDOW_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(clockTimer);
      clearInterval(countdownTimer);
    };
  }, [activeEmployee]);

  // ── 3. Realtime allocations for this employee
  const allocations = useMemo(() => {
    if (!activeEmployee) return null;
    return getEmployeeRealtimeAllocations({
      employeeId: activeEmployee.id,
      mealEntries,
      currentDate: liveClock
    });
  }, [activeEmployee, mealEntries, liveClock]);

  // ── 4. Login submission
  const handleLogin = (e) => {
    e?.preventDefault();
    setLoginError('');

    const cleanId = idInput.trim().toUpperCase();
    const cleanPhone = phoneInput.trim().replace(/\s+/g, '');

    if (!cleanId) {
      setLoginError('Please enter your Employee ID (e.g. AHP-1001)');
      return;
    }

    const found = employees.find((emp) => emp.id.toUpperCase() === cleanId);
    if (!found) {
      setLoginError(`Employee ID "${cleanId}" was not found in company records.`);
      return;
    }

    // Optional phone verification if provided
    if (cleanPhone) {
      const empPhone = (found.phone || '').replace(/\s+/g, '');
      if (!empPhone.endsWith(cleanPhone) && !cleanPhone.endsWith(empPhone)) {
        setLoginError('Phone number does not match registered employee records.');
        return;
      }
    }

    setActiveEmployee(found);
    localStorage.setItem(STORAGE_KEY, found.id);
    addToast(`Welcome, ${found.name}! Your dynamic pass is active.`, 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setActiveEmployee(null);
    setIdInput('');
    setPhoneInput('');
    addToast('Logged out of Mobile Pass.', 'info');
  };

  const handleCopyLink = () => {
    if (!activeEmployee) return;
    const url = `${window.location.origin}/pass/${activeEmployee.id}`;
    navigator.clipboard.writeText(url).then(() => {
      addToast('Direct Mobile Pass link copied to clipboard!', 'success');
    }).catch(() => {
      addToast(`Link: ${url}`, 'info');
    });
  };

  const theme = CATEGORY_THEMES[activeEmployee?.category] || CATEGORY_THEMES.Junior;

  // ─────────────────────────────────────────────────────────
  // A. AUTHENTICATION VIEW (If not logged in)
  // ─────────────────────────────────────────────────────────
  if (!activeEmployee) {
    return (
      <div className="min-h-screen bg-[#F5F8FB] text-slate-primary flex flex-col justify-between p-4 sm:p-6 antialiased selection:bg-brand-green/20 selection:text-brand-green">
        {/* Top Header */}
        <header className="flex items-center justify-between max-w-sm mx-auto w-full pt-2">
          <Link to="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
            <ArrowLeft size={14} /> Back
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-brand-green font-bold">
            <Shield size={14} /> Official Portal
          </div>
        </header>

        {/* Center Card */}
        <main className="max-w-sm mx-auto w-full my-auto py-6">
          <div className="bg-white rounded-3xl border border-surface-border shadow-card p-6 sm:p-7 space-y-5">
            {/* Logo & Title */}
            <div className="text-center space-y-2">
              <div className="inline-flex bg-white p-2 rounded-xl border border-surface-border shadow-xs">
                <img src={logoAsset} alt="Logo" className="h-9 w-auto object-contain" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Employee Mess Pass
              </h1>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Sign in with your company credentials to access your secure, dynamic meal pass.
              </p>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="text-slate-700 text-[11px] font-bold uppercase tracking-wider block mb-1">
                  Employee ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={idInput}
                    onChange={(e) => setIdInput(e.target.value.toUpperCase())}
                    placeholder="e.g. AHP-1001"
                    required
                    className="w-full bg-slate-50 border border-surface-border rounded-xl pl-9 pr-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green text-sm font-mono font-semibold transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 text-[11px] font-bold uppercase tracking-wider block mb-1">
                  Registered Mobile Number (Optional)
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="e.g. 9123 4001"
                    className="w-full bg-slate-50 border border-surface-border rounded-xl pl-9 pr-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green text-sm transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-brand-green hover:bg-brand-green-hover text-white text-sm font-bold rounded-xl transition-all shadow-pill active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
              >
                <KeyRound size={16} /> Unlock My Pass
              </button>
            </form>

            {/* Quick Demo Selector for fast testing */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mb-2">
                Quick Test Employees
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => { setIdInput('AHP-1001'); setPhoneInput('91234001'); }}
                  className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-left transition-colors"
                >
                  <div className="font-bold text-[11px]">Tariq Al-Balushi</div>
                  <div className="text-[10px] text-emerald-700 font-mono">AHP-1001 · Junior</div>
                </button>
                <button
                  type="button"
                  onClick={() => { setIdInput('AHP-1041'); setPhoneInput('91234041'); }}
                  className="p-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-left transition-colors"
                >
                  <div className="font-bold text-[11px]">Eng. Tariq Al-Hashmi</div>
                  <div className="text-[10px] text-sky-700 font-mono">AHP-1041 · Senior</div>
                </button>
              </div>
            </div>
          </div>
        </main>

        <footer className="text-center text-[11px] text-slate-400 py-2">
          Al-Haditha Petroleum Services S.A.O.C • Mess Management
        </footer>
        <Toast />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // B. ACTIVE SECURE MOBILE PASS VIEW (With Dynamic Anti-Screenshot QR)
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F8FB] text-slate-primary flex flex-col justify-between p-3 sm:p-5 select-none antialiased selection:bg-brand-green/20 selection:text-brand-green">
      {/* Top Bar */}
      <header className="flex items-center justify-between max-w-sm mx-auto w-full pt-1 pb-2">
        <button
          onClick={handleLogout}
          className="text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer"
          title="Sign out from this device"
        >
          <LogOut size={13} /> Sign Out
        </button>

        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>Live Digital Pass</span>
        </div>

        <button
          onClick={handleCopyLink}
          className="text-xs font-semibold text-brand-blue hover:text-brand-blue-dark flex items-center gap-1 transition-colors cursor-pointer"
          title="Copy private pass link"
        >
          <Copy size={13} /> Share Link
        </button>
      </header>

      {/* Main Digital Pass Card (Mobile Wallet Aesthetic) */}
      <main className="max-w-sm mx-auto w-full my-auto space-y-3">
        {/* 1-Tap Home Screen Install Banner */}
        {!isStandalone && (
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-2xl p-3 shadow-xs flex items-center justify-between gap-2.5 animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-brand-green text-white flex items-center justify-center shrink-0 shadow-xs">
                <Smartphone size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1">
                  <span>Add to Home Screen</span>
                  <span className="text-[10px] bg-brand-green text-white px-1.5 py-0.2 rounded-full font-extrabold">1-Tap</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">Instant access on phone without link</div>
              </div>
            </div>

            {deferredPrompt ? (
              <button
                onClick={handleInstallClick}
                className="shrink-0 px-3.5 py-1.5 bg-brand-green hover:bg-brand-green-hover text-white text-xs font-bold rounded-xl shadow-pill transition-all cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <Download size={12} /> Install
              </button>
            ) : showIosGuide ? (
              <div className="shrink-0 text-[10px] font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                Tap ⎋ → Add to Home
              </div>
            ) : (
              <button
                onClick={handleInstallClick}
                className="shrink-0 px-3 py-1.5 bg-brand-green hover:bg-brand-green-hover text-white text-xs font-bold rounded-xl shadow-pill transition-all cursor-pointer"
              >
                Add App
              </button>
            )}
          </div>
        )}

        <div className="bg-white rounded-3xl border border-surface-border shadow-card overflow-hidden transition-all relative">
          
          {/* Decorative Card Top Strip */}
          <div
            className="px-4 py-3 text-white flex items-center justify-between shadow-xs"
            style={{ backgroundColor: theme.hex }}
          >
            <div className="flex items-center gap-2">
              <div className="bg-white rounded-md p-0.5">
                <img src={logoAsset} alt="Logo" className="h-5 w-auto object-contain" />
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-extrabold tracking-wider uppercase opacity-90">
                  Al-Haditha Petroleum
                </div>
                <div className="text-[8px] opacity-75">Camp Mess Hall Pass</div>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-white/20 border border-white/30 backdrop-blur-xs">
              {activeEmployee.category}
            </span>
          </div>

          <div className="p-4 sm:p-5 flex flex-col items-center gap-3.5">
            {/* Employee Profile Header */}
            <div className="flex items-center gap-3 w-full border-b border-slate-100 pb-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-extrabold shadow-sm"
                style={{ backgroundColor: theme.hex }}
              >
                {(activeEmployee.name || '?').charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                  {activeEmployee.name}
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                  <span className="font-bold text-slate-700">{activeEmployee.id}</span>
                  <span>·</span>
                  <span className="truncate">{activeEmployee.department}</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {activeEmployee.designation}
                </div>
              </div>
            </div>

            {/* ── Anti-Screenshot Dynamic Rolling QR Code Frame ── */}
            <div className="relative flex flex-col items-center p-3 bg-slate-50 rounded-2xl border border-surface-border shadow-xs w-full max-w-[240px]">
              {/* Running Millisecond Security Watermark */}
              <div className="text-[9px] font-mono text-slate-400 font-semibold mb-1 tabular-nums">
                SEC-ID: {activeEmployee.id} · {liveClock.toLocaleTimeString()}
              </div>

              {/* QR Code Container */}
              <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100 relative">
                <QRCodeSVG
                  value={qrPayload}
                  size={190}
                  level="L"
                  includeMargin={true}
                />
              </div>

              {/* Countdown Progress Bar (Refreshes every 30 seconds) */}
              <div className="w-full mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Rolling QR
                  </span>
                  <span className="font-mono text-slate-600">
                    Refreshes in {countdown}s
                  </span>
                </div>

                {/* Animated countdown bar */}
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-green transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(countdown / DYNAMIC_QR_WINDOW_SEC) * 100}%` }}
                  />
                </div>
              </div>

              {/* Anti-Screenshot Label */}
              <div className="mt-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">
                🛡️ Dynamic Token · Screenshots Prohibited
              </div>
            </div>

            {/* Realtime Quota Status Card */}
            {allocations && (
              <div className="w-full bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mb-1.5">
                  Monthly Meal Allocations
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div className="bg-white rounded-lg p-1.5 border border-slate-200 shadow-xs">
                    <div className="font-extrabold text-slate-800 text-xs font-mono">
                      {allocations.consumedCount}
                    </div>
                    <div className="text-[9px] text-slate-400">Consumed</div>
                  </div>
                  <div className="bg-white rounded-lg p-1.5 border border-emerald-200 shadow-xs">
                    <div className="font-extrabold text-brand-green text-xs font-mono">
                      {allocations.remainingMonthlyAllocations}
                    </div>
                    <div className="text-[9px] text-slate-400">Remaining</div>
                  </div>
                  <div className="bg-white rounded-lg p-1.5 border border-slate-200 shadow-xs">
                    <div className="font-extrabold text-slate-800 text-xs font-mono">
                      {allocations.totalMonthlyQuota}
                    </div>
                    <div className="text-[9px] text-slate-400">Quota</div>
                  </div>
                </div>
              </div>
            )}

            {/* Kiosk Scan Instructions */}
            <div className="text-center text-[10px] text-slate-400 leading-tight">
              Present this screen to the scanner at the Mess Hall entrance.
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-slate-400 py-1">
        Al-Haditha Petroleum Services S.A.O.C • Authorized Mess Access
      </footer>

      <Toast />
    </div>
  );
}
