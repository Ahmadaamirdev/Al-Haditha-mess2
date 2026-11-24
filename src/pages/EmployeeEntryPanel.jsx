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
  Sparkles,
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
    <div className="flex items-center gap-1.5 font-mono tabular-nums font-bold text-slate-700 text-xs sm:text-sm">
      <Clock size={14} className="text-brand-green" />
      <span>{omanTime}</span>
      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
        GST · Oman
      </span>
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
    const methodLabel = entry?.entryMethod === 'QR_SCAN' ? '📷 QR Code Scan' : '⌨ Manual Verification';
    return (
      <div className="animate-fade-in flex flex-col items-center gap-3 w-full max-w-sm mx-auto">
        {/* Approved Green Badge */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-green to-emerald-600 flex items-center justify-center shadow-pill ring-4 ring-emerald-100">
          <Check size={28} className="text-white" strokeWidth={3} />
        </div>

        <div className="text-center">
          <div className="text-xl font-extrabold text-brand-green tracking-tight">MEAL APPROVED</div>
          <div className="text-slate-500 text-[11px] font-semibold">{methodLabel}</div>
        </div>

        {/* Employee Info Card */}
        <div className="w-full bg-slate-50/90 rounded-2xl border border-surface-border p-3.5 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-green-light border border-emerald-200 flex items-center justify-center text-brand-green text-lg font-extrabold shadow-xs">
              {(employee?.name || '?').charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-slate-900 text-sm truncate">{employee?.name}</div>
              <div className="text-xs font-mono font-medium text-slate-500">
                {employee?.id} · <span className="font-bold text-slate-700">{employee?.category}</span>
              </div>
            </div>
          </div>

          <div className={`w-full flex items-center justify-between bg-gradient-to-r ${MEAL_COLORS[entry?.mealType] || MEAL_COLORS.Lunch} text-white rounded-xl px-3.5 py-2 shadow-xs`}>
            <span className="font-bold text-xs tracking-wide">{entry?.mealType} Session Verified</span>
            <MealIcon size={16} />
          </div>

          {/* Realtime Quota Badges */}
          {allocations && (
            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className="bg-white rounded-xl p-2 border border-slate-200/80 shadow-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Today's Remaining</div>
                <div className="text-base font-extrabold text-brand-green font-mono">
                  {allocations.todayRemaining} <span className="text-[10px] text-slate-400 font-sans">/ 3</span>
                </div>
              </div>
              <div className="bg-white rounded-xl p-2 border border-slate-200/80 shadow-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Monthly Balance</div>
                <div className="text-base font-extrabold text-brand-blue font-mono">
                  {allocations.monthRemaining}
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onReset}
          className="text-slate-400 hover:text-slate-600 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RotateCcw size={12} /> Ready for next check-in
        </button>
      </div>
    );
  }

  if (result.type === 'warning') {
    return (
      <div className="animate-fade-in flex flex-col items-center gap-3 w-full max-w-sm mx-auto text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center shadow-xs">
          <AlertTriangle size={28} className="text-amber-500" />
        </div>
        <div>
          <div className="text-lg font-bold text-amber-700">Meal Already Claimed</div>
          <div className="text-slate-500 text-xs mt-1 max-w-xs">{result.message}</div>
        </div>
        <button
          onClick={onReset}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <RotateCcw size={13} /> Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col items-center gap-3 w-full max-w-sm mx-auto text-center">
      <div className="w-14 h-14 rounded-full bg-red-50 border-2 border-red-300 flex items-center justify-center shadow-xs">
        <XCircle size={28} className="text-red-500" />
      </div>
      <div>
        <div className="text-lg font-bold text-red-600">Verification Failed</div>
        <div className="text-slate-500 text-xs mt-1 max-w-xs">{result.message}</div>
      </div>
      <button
        onClick={onReset}
        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
      >
        <RotateCcw size={13} /> Try Again
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Camera QR Scanner Component
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
    // 1. Cleanly stop previous instance
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
        throw new Error('Camera access not supported in this browser. Please use a modern HTTPS browser.');
      }

      // Explicit permission check with user gesture
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      } catch (_) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (permErr) {
          throw new Error('Camera permission denied. Please allow camera access in browser address bar.');
        }
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      // Enumerate available cameras
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
            const edge = Math.max(160, Math.floor(minEdge * 0.85));
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
      // Fallback try with generic front camera
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
            ? 'Camera permission denied. Please allow camera access in browser.'
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

  // Clean cleanup on unmount
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

  // When disabled (showing approval card), pause scan without killing hardware camera stream
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
      {/* Scanner Viewport Box */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 aspect-square rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-200 shadow-sm flex items-center justify-center">
        <div id="qr-reader" className="w-full h-full" />

        {cameraState !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 border-2 border-dashed border-slate-200 p-4 text-center">
            {cameraState === 'starting' ? (
              <div className="w-9 h-9 border-3 border-brand-green border-t-transparent rounded-full animate-spin" />
            ) : cameraState === 'error' ? (
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shadow-xs">
                <CameraOff size={24} className="text-red-500" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-brand-green-light border border-emerald-200 flex items-center justify-center shadow-xs">
                <Camera size={24} className="text-brand-green" />
              </div>
            )}
            <span className="text-slate-600 text-xs font-semibold px-2">
              {cameraState === 'error' ? errorMsg : 'Camera ready to activate'}
            </span>
          </div>
        )}

        {/* Scanning reticle overlay */}
        {cameraState === 'running' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-44 h-44 sm:w-52 sm:h-52 border-2 border-white/60 rounded-2xl relative shadow-lg">
              <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              {/* Pulsing scan line */}
              <div className="absolute left-1 right-1 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        {cameraState !== 'running' ? (
          <button
            onClick={() => startCamera()}
            disabled={cameraState === 'starting'}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-green hover:bg-brand-green-hover disabled:bg-slate-300 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-pill cursor-pointer active:scale-95"
          >
            <Camera size={16} />
            {cameraState === 'starting' ? 'Starting Camera…' : 'Start Camera'}
          </button>
        ) : (
          <>
            <button
              onClick={stopCamera}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm cursor-pointer"
            >
              <CameraOff size={14} />
              Stop
            </button>
            {availableCameras.length > 1 && (
              <button
                onClick={handleSwitchCamera}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors border border-slate-300 cursor-pointer"
                title="Switch Camera Lens"
              >
                <RotateCcw size={13} />
                Switch Camera
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-slate-400 text-[11px] text-center max-w-xs">
        Point camera at employee QR badge or live mobile pass · Instant deduction
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

  // Keep session synchronized dynamically with the live Oman clock
  useEffect(() => {
    const updateSession = () => {
      setCurrentSession(getCurrentActiveMealWindow(new Date()));
    };
    const timer = setInterval(updateSession, 10000); // Re-check every 10s
    return () => clearInterval(timer);
  }, []);

  const selectedMeal = currentSession.name; // Always bound to the active session!

  // Form state (manual)
  const [idInput, setIdInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  // Result state
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const autoResetRef = useRef(null);

  const idInputRef = useRef(null);

  // Auto-reset handler
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

  // Shared Check-In Processor
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

  // QR Scan Handler
  const handleQrScan = useCallback(
    (decodedText) => {
      if (result || isProcessing) return;
      processCheckIn({ qrCodeString: decodedText, entryMethod: 'QR_SCAN' });
    },
    [result, isProcessing, processCheckIn]
  );

  // Manual Submission Handler
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
    <div className="min-h-screen bg-[#F5F8FB] text-slate-primary flex flex-col antialiased relative selection:bg-brand-green/20 selection:text-brand-green">
      {/* ── Top Header Bar ── */}
      <header className="shrink-0 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-2.5 border-b border-surface-border flex items-center justify-between shadow-xs sticky top-0 z-30">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={16} className="text-slate-400" />
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-50 text-brand-green border border-emerald-200">
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

      {/* ── Main Kiosk Body (Responsive Container) ── */}
      <main className="flex-1 px-4 py-6 sm:py-8 flex flex-col items-center justify-center w-full">
        <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center gap-3.5 my-auto">
          {/* Terminal Title & Live Oman Clock */}
          <div className="text-center space-y-1 w-full">
            <div className="inline-flex items-center gap-1.5 bg-brand-green-light text-brand-green border border-emerald-200 px-3 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider shadow-xs">
              <Shield size={11} className="text-brand-green" />
              <span>Mess Hall Entry Terminal</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Staff Meal Check-In
            </h1>
            <div className="flex items-center justify-center pt-0.5">
              <LiveClock />
            </div>
          </div>

          {/* Unified Active Meal Session Banner (Auto-Identified by Oman Time) */}
          <div className="w-full bg-white rounded-2xl border-2 border-emerald-500/20 p-3.5 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-green to-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
                {currentSession.name === 'Breakfast' ? (
                  <Coffee size={20} />
                ) : currentSession.name === 'Lunch' ? (
                  <Sun size={20} />
                ) : (
                  <Moon size={20} />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-green">
                    Active Service
                  </span>
                </div>
                <div className="text-base font-extrabold text-slate-900 leading-tight">
                  {currentSession.name}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs font-mono font-bold text-slate-800">
                {currentSession.timeSlot}
              </div>
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Oman GST Time
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs (QR Scan vs Manual Verification) */}
          <div className="grid grid-cols-2 gap-1 w-full bg-slate-200/80 p-1 rounded-xl border border-slate-300/70">
            <button
              onClick={() => { setMode('qr'); handleReset(); }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'qr'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode size={14} className={mode === 'qr' ? 'text-brand-green' : 'text-slate-400'} />
              <span>QR Scan</span>
            </button>
            <button
              onClick={() => { setMode('manual'); handleReset(); }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'manual'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Keyboard size={14} className={mode === 'manual' ? 'text-brand-green' : 'text-slate-400'} />
              <span>Manual Entry</span>
            </button>
          </div>

          {/* Interactive Card Container (QR Scanner or Result or Manual Form) */}
          <div className="w-full bg-white rounded-3xl border border-surface-border shadow-sm p-5 sm:p-6 flex flex-col items-center">
            {result ? (
              <ResultCard result={result} onReset={handleReset} />
            ) : mode === 'qr' ? (
              <CameraScanner onScan={handleQrScan} disabled={!!result || isProcessing} />
            ) : (
              /* Manual Entry Form */
              <form onSubmit={handleManualSubmit} className="w-full space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employee ID
                  </label>
                  <div className="relative">
                    <input
                      ref={idInputRef}
                      type="text"
                      value={idInput}
                      onChange={(e) => setIdInput(e.target.value.toUpperCase())}
                      placeholder="e.g. AHP-1001"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-surface-border rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                    />
                    <IdCard size={15} className="absolute left-3 top-3 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Tariq Al-Balushi"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-surface-border rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                    />
                    <User size={15} className="absolute left-3 top-3 text-slate-400" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-2.5 bg-brand-green hover:bg-brand-green-hover disabled:bg-slate-300 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-pill cursor-pointer"
                >
                  Verify & Log {currentSession.name}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
