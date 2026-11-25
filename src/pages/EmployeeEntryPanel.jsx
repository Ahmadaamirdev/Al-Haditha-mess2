import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ArrowLeft,
  IdCard,
  User,
  Utensils,
  Sun,
  Moon,
  Coffee,
  AlertTriangle,
  XCircle,
  RotateCcw,
  QrCode,
  Camera,
  CameraOff,
  Keyboard,
  Wifi,
  WifiOff,
  Shield,
  Clock,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useApp } from '../context/AppContext';
import {
  getEmployeeRealtimeAllocations,
  getCurrentActiveMealWindow,
  getOmanTime,
} from '../utils/allocationEngine';
import { parseAndMatchQrCode } from '../data/employeesData';
import { playSuccessChime, playWarningTone, playErrorTone } from '../utils/audioTones';
import Toast from '../components/common/Toast';
import logoAsset from '../assets/logo.png';

const MEAL_ICONS = { Breakfast: Coffee, Lunch: Sun, Dinner: Moon };
const MEAL_COLORS = {
  Breakfast: 'from-amber-500 to-orange-500',
  Lunch: 'from-emerald-600 to-teal-600',
  Dinner: 'from-indigo-600 to-sky-700',
};
const RESET_DELAY = 4500; // ms before auto-reset

// ─────────────────────────────────────────────────────────
// Live Oman Time Clock (GST, UTC+4)
// ─────────────────────────────────────────────────────────
function LiveClock() {
  const [omanTime, setOmanTime] = useState(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Muscat',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date());
    } catch (_) {
      return new Date().toLocaleTimeString();
    }
  });

  useEffect(() => {
    const id = setInterval(() => {
      try {
        setOmanTime(
          new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Muscat',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }).format(new Date())
        );
      } catch (_) {
        setOmanTime(new Date().toLocaleTimeString());
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-1.5 font-mono tabular-nums font-bold text-slate-600 text-xs sm:text-sm">
      <Clock size={13} className="text-brand-green" />
      <span>{omanTime}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Result Card
// ─────────────────────────────────────────────────────────
function ResultCard({ result, onReset }) {
  if (!result) return null;

  if (result.type === 'success') {
    const { employee, entry, allocations } = result;
    const MealIcon = MEAL_ICONS[entry?.mealType] || Utensils;
    const methodLabel = entry?.entryMethod === 'QR_SCAN' ? '📷 QR Verified' : '⌨ Manual Verified';
    return (
      <div className="animate-fade-in flex flex-col items-center gap-2.5 w-full py-1">
        {/* Approved Green Badge */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-green to-emerald-600 flex items-center justify-center shadow-pill ring-4 ring-emerald-100">
          <Check size={24} className="text-white" strokeWidth={3} />
        </div>

        <div className="text-center">
          <div className="text-lg font-black text-brand-green tracking-tight">APPROVED</div>
          <div className="text-slate-400 text-[10px] font-semibold">{methodLabel}</div>
        </div>

        {/* Employee Info Card */}
        <div className="w-full bg-slate-50/90 rounded-2xl border border-slate-200/80 p-3 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-green-light border border-emerald-200 flex items-center justify-center text-brand-green text-base font-extrabold shadow-2xs">
              {(employee?.name || '?').charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">{employee?.name}</div>
              <div className="text-[11px] font-mono font-medium text-slate-500">
                {employee?.id} · <span className="font-bold text-slate-700">{employee?.category}</span>
              </div>
            </div>
          </div>

          <div className={`w-full flex items-center justify-between bg-gradient-to-r ${MEAL_COLORS[entry?.mealType] || MEAL_COLORS.Lunch} text-white rounded-xl px-3 py-1.5 shadow-2xs`}>
            <span className="font-bold text-xs tracking-wide">{entry?.mealType} Session</span>
            <MealIcon size={14} />
          </div>

          {/* Realtime Quota Badges */}
          {allocations && (
            <div className="grid grid-cols-2 gap-2 pt-0.5 text-center">
              <div className="bg-white rounded-xl p-1.5 border border-slate-200/80 shadow-2xs">
                <div className="text-[9px] font-bold text-slate-400 uppercase">Today Remaining</div>
                <div className="text-sm font-extrabold text-brand-green font-mono">
                  {allocations.todayRemainingCount ?? allocations.todayRemaining ?? 0} <span className="text-[9px] text-slate-400 font-sans">/ 3</span>
                </div>
              </div>
              <div className="bg-white rounded-xl p-1.5 border border-slate-200/80 shadow-2xs">
                <div className="text-[9px] font-bold text-slate-400 uppercase">Month Balance</div>
                <div className="text-sm font-extrabold text-brand-blue font-mono">
                  {allocations.remainingMonthlyAllocations ?? allocations.monthRemaining ?? 0}
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onReset}
          className="text-slate-400 hover:text-slate-600 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer pt-1"
        >
          <RotateCcw size={11} /> Next check-in
        </button>
      </div>
    );
  }

  if (result.type === 'warning') {
    return (
      <div className="animate-fade-in flex flex-col items-center gap-2.5 w-full py-2 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center shadow-2xs">
          <AlertTriangle size={24} className="text-amber-500" />
        </div>
        <div>
          <div className="text-base font-bold text-amber-700">Already Claimed</div>
          <div className="text-slate-500 text-[11px] mt-0.5 max-w-xs">{result.message}</div>
        </div>
        <button
          onClick={onReset}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 mt-1"
        >
          <RotateCcw size={12} /> Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col items-center gap-2.5 w-full py-2 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 border-2 border-red-300 flex items-center justify-center shadow-2xs">
        <XCircle size={24} className="text-red-500" />
      </div>
      <div>
        <div className="text-base font-bold text-red-600">Verification Failed</div>
        <div className="text-slate-500 text-[11px] mt-0.5 max-w-xs">{result.message}</div>
      </div>
      <button
        onClick={onReset}
        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 mt-1"
      >
        <RotateCcw size={12} /> Try Again
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Camera QR Scanner Component (Compact & Premium)
// ─────────────────────────────────────────────────────────
function CameraScanner({ onScan, disabled }) {
  const instanceRef = useRef(null);
  const [cameraState, setCameraState] = useState('idle'); // 'idle' | 'starting' | 'running' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0);

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const stopCamera = useCallback(async () => {
    if (instanceRef.current) {
      try {
        await instanceRef.current.stop();
        instanceRef.current.clear();
      } catch (_) {}
      instanceRef.current = null;
    }
    const el = document.getElementById('qr-reader');
    if (el) el.innerHTML = '';
    setCameraState('idle');
  }, []);

  const startCamera = useCallback(async (targetIdx = 0) => {
    if (instanceRef.current) {
      try {
        await instanceRef.current.stop();
        instanceRef.current.clear();
      } catch (_) {}
      instanceRef.current = null;
    }
    const container = document.getElementById('qr-reader');
    if (container) container.innerHTML = '';

    setCameraState('starting');
    setErrorMsg('');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported in this browser.');
      }

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      } catch (_) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (permErr) {
          throw new Error('Camera permission denied.');
        }
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      let devices = [];
      try {
        devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices);
        }
      } catch (_) {}

      const html5QrCode = new Html5Qrcode('qr-reader');
      instanceRef.current = html5QrCode;

      let cameraConfig = { facingMode: { ideal: 'environment' } };
      if (devices && devices.length > 0) {
        const safeIdx = targetIdx % devices.length;
        cameraConfig = devices[safeIdx].id;
        setCurrentCameraIdx(safeIdx);
      }

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.max(140, Math.floor(minEdge * 0.85));
            return { width: edge, height: edge };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (!disabledRef.current) {
            onScan(decodedText);
          }
        },
        () => {} // frame misses ignored
      );

      setCameraState('running');
    } catch (err) {
      console.error('Camera startup error:', err);
      try {
        const container = document.getElementById('qr-reader');
        if (container) container.innerHTML = '';
        const fallbackQr = new Html5Qrcode('qr-reader');
        instanceRef.current = fallbackQr;
        await fallbackQr.start(
          { facingMode: 'user' },
          { fps: 15 },
          (decodedText) => {
            if (!disabledRef.current) onScan(decodedText);
          },
          () => {}
        );
        setCameraState('running');
      } catch (fallbackErr) {
        setErrorMsg(
          err?.message?.includes('denied') || fallbackErr?.message?.includes('denied')
            ? 'Camera access denied in browser settings.'
            : (err?.message || 'Could not start camera.')
        );
        setCameraState('error');
        instanceRef.current = null;
      }
    }
  }, [onScan]);

  const handleSwitchCamera = useCallback(() => {
    if (availableCameras.length > 1) {
      const nextIdx = (currentCameraIdx + 1) % availableCameras.length;
      startCamera(nextIdx);
    }
  }, [availableCameras, currentCameraIdx, startCamera]);

  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.stop();
          instanceRef.current.clear();
        } catch (_) {}
        instanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!instanceRef.current || cameraState !== 'running') return;
    try {
      if (disabled) {
        instanceRef.current.pause(true);
      } else {
        instanceRef.current.resume();
      }
    } catch (_) {}
  }, [disabled, cameraState]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Viewport Box */}
      <div className="relative w-52 h-52 sm:w-60 sm:h-60 aspect-square rounded-2xl overflow-hidden bg-navy-950 border-2 border-slate-200/90 shadow-inner flex items-center justify-center">
        <div id="qr-reader" className="w-full h-full" />

        {cameraState !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-gradient-to-b from-slate-50 to-slate-100/90 border-2 border-dashed border-slate-200 p-4 text-center">
            {cameraState === 'starting' ? (
              <div className="w-9 h-9 border-3 border-brand-green border-t-transparent rounded-full animate-spin" />
            ) : cameraState === 'error' ? (
              <div className="w-11 h-11 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shadow-2xs">
                <CameraOff size={22} className="text-red-500" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-2xs ring-4 ring-emerald-50/60">
                <Camera size={22} className="text-brand-green" />
              </div>
            )}
            <div className="space-y-0.5">
              <span className="text-slate-800 text-xs font-bold block">
                {cameraState === 'error' ? 'Camera Error' : 'Scanner Ready'}
              </span>
              <span className="text-slate-400 text-[11px] font-medium block max-w-[190px]">
                {cameraState === 'error' ? errorMsg : 'Activate camera to scan employee QR badge'}
              </span>
            </div>
          </div>
        )}

        {/* Scanning reticle overlay */}
        {cameraState === 'running' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-40 h-40 sm:w-48 sm:h-48 border-2 border-white/60 rounded-xl relative shadow-lg">
              <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
              <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
              <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br" />
              <div className="absolute left-1 right-1 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {cameraState !== 'running' ? (
          <button
            onClick={() => startCamera()}
            disabled={cameraState === 'starting'}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-green hover:bg-brand-green-hover disabled:bg-slate-300 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-pill cursor-pointer active:scale-95"
          >
            <Camera size={15} />
            {cameraState === 'starting' ? 'Starting Camera…' : 'Start Camera Scanner'}
          </button>
        ) : (
          <>
            <button
              onClick={stopCamera}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <CameraOff size={13} />
              Stop
            </button>
            {availableCameras.length > 1 && (
              <button
                onClick={handleSwitchCamera}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors border border-slate-300 cursor-pointer"
                title="Switch Camera Lens"
              >
                <RotateCcw size={12} />
                Switch
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-slate-400 text-[10px] text-center max-w-xs">
        Point camera at employee QR badge · Instant deduction
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────
export default function EmployeeEntryPanel() {
  const { data, recordMealEntry, isMongoConnected } = useApp();

  // Mode: 'qr' | 'manual'
  const [mode, setMode] = useState('qr');

  // Auto-identified live meal session based on Oman GST Time (continuous 24/7)
  const [currentSession, setCurrentSession] = useState(() => getCurrentActiveMealWindow(new Date()));

  // Keep session synchronized dynamically
  useEffect(() => {
    const updateSession = () => {
      setCurrentSession(getCurrentActiveMealWindow(new Date()));
    };
    const timer = setInterval(updateSession, 10000);
    return () => clearInterval(timer);
  }, []);

  const selectedMeal = currentSession.name;

  // Form state (manual)
  const [idInput, setIdInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  // Result state
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const autoResetRef = useRef(null);

  const idInputRef = useRef(null);

  const scheduleAutoReset = useCallback(() => {
    if (autoResetRef.current) clearTimeout(autoResetRef.current);
    autoResetRef.current = setTimeout(() => {
      setResult(null);
      setIdInput('');
      setNameInput('');
      setIsProcessing(false);
    }, RESET_DELAY);
  }, []);

  const handleReset = useCallback(() => {
    if (autoResetRef.current) clearTimeout(autoResetRef.current);
    setResult(null);
    setIdInput('');
    setNameInput('');
    setIsProcessing(false);
  }, []);

  const processCheckIn = useCallback(
    ({ qrCodeString, employeeId, employeeName, entryMethod }) => {
      if (isProcessing) return;
      setIsProcessing(true);

      const checkInResult = recordMealEntry({
        qrCodeString,
        employeeId,
        employeeName,
        mealType: selectedMeal,
        facility: 'Main Camp Mess Hall',
        entryMethod: entryMethod || (qrCodeString ? 'QR_SCAN' : 'MANUAL'),
      });

      if (!checkInResult.matched) {
        playErrorTone();
        setResult({
          type: 'error',
          message: checkInResult.message || 'Employee not found in company roster.',
        });
        scheduleAutoReset();
        return;
      }

      if (checkInResult.isDuplicate) {
        playWarningTone();
        setResult({
          type: 'warning',
          employee: checkInResult.employee,
          allocations: checkInResult.allocations,
          message: checkInResult.message,
        });
        scheduleAutoReset();
        return;
      }

      // Success
      playSuccessChime();
      setResult({
        type: 'success',
        employee: checkInResult.employee,
        entry: checkInResult.entry,
        allocations: checkInResult.allocations,
      });
      scheduleAutoReset();
    },
    [isProcessing, recordMealEntry, selectedMeal, scheduleAutoReset]
  );

  const handleQrScan = useCallback(
    (decodedText) => {
      if (result || isProcessing) return;
      processCheckIn({ qrCodeString: decodedText, entryMethod: 'QR_SCAN' });
    },
    [result, isProcessing, processCheckIn]
  );

  const handleManualSubmit = (e) => {
    e?.preventDefault();
    const cleanId = idInput.trim().toUpperCase();
    const cleanName = nameInput.trim();
    if (!cleanId || !cleanName) {
      setResult({ type: 'error', message: 'Please enter both Employee ID and Full Name.' });
      return;
    }
    processCheckIn({ employeeId: cleanId, employeeName: cleanName, entryMethod: 'MANUAL' });
  };

  useEffect(() => {
    if (mode === 'manual' && idInputRef.current) {
      idInputRef.current.focus();
    }
  }, [mode]);

  return (
    <div className="min-h-screen bg-[#F5F8FB] text-slate-primary flex flex-col antialiased relative selection:bg-brand-green/20 selection:text-brand-green overflow-x-hidden font-sans">
      {/* ── Top Header Bar ── */}
      <header className="shrink-0 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-2.5 border-b border-surface-border flex items-center justify-between shadow-xs sticky top-0 z-30">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-slate-secondary hover:text-slate-primary text-xs sm:text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={16} className="text-slate-muted" />
          <span>Dashboard</span>
        </Link>

        {/* Logo */}
        <div className="flex items-center justify-center">
          <div className="bg-white rounded-lg px-2.5 py-1 border border-surface-border shadow-xs flex items-center justify-center">
            <img
              src={logoAsset}
              alt="Logo"
              className="h-6 sm:h-7 w-auto object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* Live Atlas Status */}
        <div className="flex items-center gap-2">
          {isMongoConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-brand-green-light text-brand-green border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
              <Wifi size={12} className="text-brand-green" />
              <span className="hidden xs:inline">Live Atlas</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <WifiOff size={12} className="text-amber-600" />
              <span className="hidden xs:inline">Offline</span>
            </span>
          )}
        </div>
      </header>

      {/* ── Main Kiosk Body ── */}
      <main className="flex-1 px-4 py-6 sm:py-8 flex flex-col items-center justify-center w-full relative z-10">
        <div className="w-full max-w-[380px] sm:max-w-[400px] mx-auto flex flex-col items-center gap-3.5 my-auto">
          {/* Terminal Title & Live Clock */}
          <div className="text-center space-y-1 w-full">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-primary tracking-tight">
              Staff Meal Check-In
            </h1>
            <div className="flex items-center justify-center">
              <LiveClock />
            </div>
          </div>

          {/* ── Single Unified Card (Aligned & Color-Themed) ── */}
          <div className="w-full bg-surface-card rounded-2xl border border-surface-border shadow-card hover:shadow-card-hover transition-shadow p-4 sm:p-5 flex flex-col items-center gap-3.5">
            {/* Unified Card Header: Active Session on Left + Mode Switcher on Right (Aligned Heights) */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-surface-border">
              {/* Session Display (Breakfast / Lunch / Dinner) */}
              <div className="flex items-center gap-1.5 bg-brand-green-light text-brand-green border border-emerald-200/80 px-2.5 py-1 rounded-xl font-bold text-xs tracking-tight shadow-2xs h-8">
                {currentSession.name === 'Breakfast' ? (
                  <Coffee size={14} className="text-brand-green" />
                ) : currentSession.name === 'Lunch' ? (
                  <Sun size={14} className="text-brand-green" />
                ) : (
                  <Moon size={14} className="text-brand-green" />
                )}
                <span>{currentSession.name}</span>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-surface-border text-[11px] font-bold h-8 items-center">
                <button
                  onClick={() => { setMode('qr'); handleReset(); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer h-full ${
                    mode === 'qr' ? 'bg-white text-slate-primary shadow-2xs font-extrabold' : 'text-slate-secondary hover:text-slate-primary'
                  }`}
                >
                  <QrCode size={12} className={mode === 'qr' ? 'text-brand-green' : 'text-slate-muted'} />
                  <span>QR Scan</span>
                </button>
                <button
                  onClick={() => { setMode('manual'); handleReset(); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer h-full ${
                    mode === 'manual' ? 'bg-white text-slate-primary shadow-2xs font-extrabold' : 'text-slate-secondary hover:text-slate-primary'
                  }`}
                >
                  <Keyboard size={12} className={mode === 'manual' ? 'text-brand-green' : 'text-slate-muted'} />
                  <span>Manual</span>
                </button>
              </div>
            </div>

            {/* Content Area (QR Scanner or Result or Manual Form) */}
            <div className="w-full flex flex-col items-center">
              {result ? (
                <ResultCard result={result} onReset={handleReset} />
              ) : mode === 'qr' ? (
                <CameraScanner onScan={handleQrScan} disabled={!!result || isProcessing} />
              ) : (
                /* Manual Entry Form */
                <form onSubmit={handleManualSubmit} className="w-full space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-primary mb-1">
                      Employee ID
                    </label>
                    <div className="relative">
                      <input
                        ref={idInputRef}
                        type="text"
                        value={idInput}
                        onChange={(e) => setIdInput(e.target.value.toUpperCase())}
                        placeholder="e.g. AHP-1001"
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-surface-border rounded-xl text-xs font-mono font-bold text-slate-primary focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-colors"
                      />
                      <IdCard size={14} className="absolute left-2.5 top-2.5 text-slate-muted" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-primary mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="e.g. Tariq Al-Balushi"
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-surface-border rounded-xl text-xs font-semibold text-slate-primary focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-colors"
                      />
                      <User size={14} className="absolute left-2.5 top-2.5 text-slate-muted" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-2.5 bg-brand-green hover:bg-brand-green-hover disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition-all shadow-pill cursor-pointer mt-1"
                  >
                    Verify & Log {currentSession.name}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Subtle organic corporate wave backdrop matching MainLayout */}
      <div className="fixed bottom-0 right-0 w-[500px] h-[250px] pointer-events-none z-0 opacity-40 overflow-hidden">
        <svg viewBox="0 0 600 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path
            d="M0 260 C 150 210, 300 290, 450 230 C 520 200, 560 170, 600 150 L 600 300 L 0 300 Z"
            fill="url(#wave-gradient-1)"
          />
          <path
            d="M50 280 C 200 230, 350 270, 500 210 C 550 190, 580 180, 600 170 L 600 300 L 50 300 Z"
            fill="url(#wave-gradient-2)"
          />
          <defs>
            <linearGradient id="wave-gradient-1" x1="0" y1="150" x2="600" y2="300" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1684AA" stopOpacity="0.25" />
              <stop offset="1" stopColor="#009B4D" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="wave-gradient-2" x1="50" y1="170" x2="600" y2="300" gradientUnits="userSpaceOnUse">
              <stop stopColor="#009B4D" stopOpacity="0.2" />
              <stop offset="1" stopColor="#1684AA" stopOpacity="0.15" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <Toast />
    </div>
  );
}
