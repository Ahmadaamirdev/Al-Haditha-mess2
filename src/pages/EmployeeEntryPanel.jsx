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
  ChevronRight,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useApp } from '../context/AppContext';
import {
  getEmployeeRealtimeAllocations,
  getCurrentActiveMealWindow,
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
// Live Clock
// ─────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono tabular-nums font-bold text-slate-700">
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
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
        <div className="w-full bg-slate-50/80 rounded-2xl border border-surface-border p-3 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-brand-green-light border border-emerald-200 flex items-center justify-center text-brand-green text-base font-extrabold">
              {(employee?.name || '?').charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">{employee?.name}</div>
              <div className="text-[11px] font-mono font-medium text-slate-500">
                {employee?.id} · <span className="font-semibold text-slate-700">{employee?.category}</span>
              </div>
            </div>
          </div>

          <div className={`w-full flex items-center justify-between bg-gradient-to-r ${MEAL_COLORS[entry?.mealType] || MEAL_COLORS.Lunch} text-white rounded-xl px-3 py-1.5 shadow-xs`}>
            <span className="font-bold text-xs tracking-wide">{entry?.mealType} Service</span>
            <MealIcon size={15} />
          </div>

          {allocations && (
            <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
              {[
                { label: 'Consumed', value: allocations.consumedCount },
                { label: 'Remaining', value: allocations.remainingMonthlyAllocations },
                { label: 'Quota', value: allocations.totalMonthlyQuota },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-xl p-1.5 border border-slate-200/80 shadow-xs">
                  <div className="font-extrabold text-slate-800 text-xs font-mono">{value ?? '—'}</div>
                  <div className="text-[10px] font-medium text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onReset}
          className="text-slate-500 text-xs font-semibold hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RotateCcw size={12} /> Next Check-In
        </button>
      </div>
    );
  }

  if (result.type === 'warning') {
    const { employee, allocations } = result;
    return (
      <div className="animate-fade-in flex flex-col items-center gap-3 w-full max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-full bg-amber-50 border-4 border-amber-200 flex items-center justify-center shadow-md">
          <AlertTriangle size={28} className="text-amber-500" />
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-amber-600">Already Checked In Today</div>
          <div className="text-slate-500 text-[11px] mt-0.5 max-w-xs">{result.message}</div>
        </div>
        {employee && (
          <div className="w-full bg-slate-50/80 rounded-2xl border border-amber-200/80 p-3">
            <div className="font-bold text-slate-800 text-xs sm:text-sm">{employee.name}</div>
            <div className="text-[11px] font-mono text-slate-500">{employee.id} · {employee.category}</div>
            {allocations && (
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs mt-2">
                {[
                  { label: 'Consumed', value: allocations.consumedCount },
                  { label: 'Remaining', value: allocations.remainingMonthlyAllocations },
                  { label: 'Quota', value: allocations.totalMonthlyQuota },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-xl p-1.5 border border-slate-200">
                    <div className="font-extrabold text-slate-800 text-xs font-mono">{value ?? '—'}</div>
                    <div className="text-[10px] font-medium text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          onClick={onReset}
          className="text-slate-500 text-xs font-semibold hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RotateCcw size={12} /> Try Again
        </button>
      </div>
    );
  }

  // error
  return (
    <div className="animate-fade-in flex flex-col items-center gap-3 w-full max-w-sm mx-auto">
      <div className="w-14 h-14 rounded-full bg-red-50 border-4 border-red-200 flex items-center justify-center shadow-md">
        <XCircle size={28} className="text-red-500" />
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-red-600">Badge Not Recognized</div>
        <div className="text-slate-500 text-[11px] mt-0.5 max-w-xs">{result.message}</div>
      </div>
      <button
        onClick={onReset}
        className="text-slate-500 text-xs font-semibold hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
      >
        <RotateCcw size={12} /> Try Again
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
      } catch {}
      instanceRef.current = null;
    }
    setCameraState('idle');
  }, []);

  const startCamera = useCallback(async (targetIdx = 0) => {
    if (instanceRef.current) {
      try {
        await instanceRef.current.stop();
        instanceRef.current.clear();
      } catch {}
      instanceRef.current = null;
    }

    setCameraState('starting');
    setErrorMsg('');

    try {
      // 1. Enumerate available video inputs on the mobile device
      let devices = [];
      try {
        devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices);
        }
      } catch (_) {}

      const html5QrCode = new Html5Qrcode('qr-reader');
      instanceRef.current = html5QrCode;

      // 2. Select camera: preferred device or ideal back camera
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
      // Fallback try with generic user or any camera if environment camera constraints failed
      try {
        const fallbackQrCode = new Html5Qrcode('qr-reader');
        instanceRef.current = fallbackQrCode;
        await fallbackQrCode.start(
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
          err?.message?.includes('Permission') || fallbackErr?.message?.includes('Permission')
            ? 'Camera access denied. Please allow camera permissions in browser settings.'
            : `Camera error: ${err?.message || 'Could not start camera'}`
        );
        setCameraState('error');
        instanceRef.current = null;
      }
    }
  }, [onScan]);

  // Flip/Switch camera between available lenses (e.g. ultra-wide vs standard back, or front/back)
  const handleSwitchCamera = useCallback(() => {
    if (availableCameras.length > 1) {
      const nextIdx = (currentCameraIdx + 1) % availableCameras.length;
      startCamera(nextIdx);
    }
  }, [availableCameras, currentCameraIdx, startCamera]);

  // Auto-start camera when scanner is mounted
  useEffect(() => {
    startCamera();
    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.stop();
          instanceRef.current.clear();
        } catch {}
        instanceRef.current = null;
      }
    };
  }, []);

  // When disabled (showing result card), pause video scanning cleanly without killing camera stream
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
    <div className="flex flex-col items-center gap-2.5 sm:gap-3 w-full">
      {/* Scanner Viewport Box */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 aspect-square rounded-3xl overflow-hidden bg-slate-900 border-2 border-surface-border shadow-md">
        <div id="qr-reader" className="w-full h-full" />

        {cameraState !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-slate-50 border-2 border-dashed border-slate-200 p-4">
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
            <span className="text-slate-600 text-xs font-semibold text-center px-2">
              {cameraState === 'error' ? errorMsg : 'Camera initializing...'}
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
              {/* Scan line */}
              <div className="absolute left-1 right-1 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {cameraState !== 'running' ? (
          <button
            onClick={() => startCamera()}
            disabled={cameraState === 'starting'}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-green hover:bg-brand-green-hover disabled:bg-slate-300 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-pill cursor-pointer active:scale-95"
          >
            <Camera size={15} />
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
                title="Switch Camera / Lens"
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

  // ── Mode: 'qr' | 'manual'
  const [mode, setMode] = useState('qr');

  // ── Meal window
  const initialMealWindow = useMemo(() => getCurrentActiveMealWindow(new Date()), []);
  const [selectedMeal, setSelectedMeal] = useState(
    initialMealWindow?.name || 'Lunch'
  );

  // ── Form state (manual)
  const [idInput, setIdInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  // ── USB / wedge scanner input buffer
  const usbBufferRef = useRef('');
  const usbTimerRef = useRef(null);

  // ── Result
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const autoResetRef = useRef(null);

  // ── Refs for auto-focus
  const idInputRef = useRef(null);

  // ─── Auto-reset after RESET_DELAY
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

  // ─── Check-in processor shared by QR, USB scanner, and manual
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
          message: checkInResult.message || 'Employee not found in roster.',
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

  // ─── Camera QR Scan Handler
  const handleQrScan = useCallback(
    (decodedText) => {
      if (result || isProcessing) return;
      processCheckIn({ qrCodeString: decodedText, entryMethod: 'QR_SCAN' });
    },
    [result, isProcessing, processCheckIn]
  );

  // ─── USB / Bluetooth Barcode & Wedge Scanner Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (mode !== 'qr' || result || isProcessing) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

      if (e.key === 'Enter') {
        const payload = usbBufferRef.current.trim();
        usbBufferRef.current = '';
        if (usbTimerRef.current) clearTimeout(usbTimerRef.current);
        if (payload.length > 2) {
          processCheckIn({ qrCodeString: payload, entryMethod: 'QR_SCAN' });
        }
        return;
      }

      if (e.key.length === 1) {
        usbBufferRef.current += e.key;
        if (usbTimerRef.current) clearTimeout(usbTimerRef.current);
        usbTimerRef.current = setTimeout(() => {
          const payload = usbBufferRef.current.trim();
          usbBufferRef.current = '';
          if (payload.length > 5) {
            processCheckIn({ qrCodeString: payload, entryMethod: 'QR_SCAN' });
          }
        }, 300);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, result, isProcessing, processCheckIn]);

  // ─── Manual form submit
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

  // Auto-focus ID input when switching to manual
  useEffect(() => {
    if (mode === 'manual' && idInputRef.current) {
      idInputRef.current.focus();
    }
  }, [mode]);

  const meals = ['Breakfast', 'Lunch', 'Dinner'];

  return (
    <div className="h-screen max-h-screen bg-[#F5F8FB] text-slate-primary flex flex-col antialiased relative selection:bg-brand-green/20 selection:text-brand-green overflow-hidden">
      {/* ── Top Header Bar (Compact & responsive, company text removed) ── */}
      <header className="shrink-0 bg-white/95 backdrop-blur-md px-3 sm:px-6 py-2.5 border-b border-surface-border flex items-center justify-between shadow-xs">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={16} className="text-slate-400" />
          <span className="hidden xs:inline sm:inline">Dashboard</span>
        </Link>

        {/* Company Logo without the text as requested */}
        <div className="flex items-center justify-center">
          <div className="bg-white rounded-lg px-2 py-0.5 border border-surface-border shadow-xs flex items-center justify-center">
            <img
              src={logoAsset}
              alt="Logo"
              className="h-6 sm:h-7 w-auto object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* Live Atlas Status */}
        <div className="flex items-center gap-2 text-xs">
          {isMongoConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-50 text-brand-green border border-emerald-200">
              <Wifi size={11} className="text-brand-green" />
              <span>Live Atlas</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <WifiOff size={11} className="text-amber-600" />
              <span>Offline</span>
            </span>
          )}
        </div>
      </header>

      {/* ── Main Kiosk Body (Fits 100% of viewport without overflow) ── */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-2 sm:py-4 flex flex-col items-center justify-center relative z-10 w-full">
        <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center justify-center gap-2.5 sm:gap-3 my-auto">
          {/* Terminal Title & Clock */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-brand-green-light text-brand-green border border-emerald-200 px-3 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider shadow-xs">
              <Shield size={11} className="text-brand-green" />
              <span>Mess Hall Entry Terminal</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Staff Meal Check-In
            </h1>
            <div className="flex items-center justify-center text-[11px] sm:text-xs text-slate-500 font-medium">
              <LiveClock />
            </div>
          </div>

          {/* Meal Service Selector */}
          <div className="grid grid-cols-3 gap-1 w-full max-w-xs bg-white p-1 rounded-xl border border-surface-border shadow-xs">
            {meals.map((m) => {
              const Icon = MEAL_ICONS[m];
              const isActive = selectedMeal === m;
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMeal(m)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand-green text-white shadow-pill'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={13} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span>{m}</span>
                </button>
              );
            })}
          </div>

          {/* Mode Tabs (QR Scan vs Manual) */}
          <div className="grid grid-cols-2 gap-1 w-full max-w-xs bg-slate-200/80 p-1 rounded-xl border border-slate-300/70">
            <button
              onClick={() => { setMode('qr'); handleReset(); }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'qr'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode size={13} className={mode === 'qr' ? 'text-brand-green' : 'text-slate-400'} />
              <span>QR Scan</span>
            </button>
            <button
              onClick={() => { setMode('manual'); handleReset(); }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'manual'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Keyboard size={13} className={mode === 'manual' ? 'text-brand-green' : 'text-slate-400'} />
              <span>Manual Entry</span>
            </button>
          </div>

          {/* Content Card (Sized proportionally to fit within viewport) */}
          <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-surface-border shadow-card p-3.5 sm:p-5 flex items-center justify-center">
            {result ? (
              <ResultCard result={result} onReset={handleReset} />
            ) : mode === 'qr' ? (
              <div className="w-full flex flex-col items-center gap-2">
                <CameraScanner onScan={handleQrScan} disabled={!!result || isProcessing} />
              </div>
            ) : (
              /* ── Manual Form ── */
              <form onSubmit={handleManualSubmit} className="w-full space-y-3">
                <div>
                  <label className="text-slate-700 text-[11px] font-bold uppercase tracking-wider block mb-1">
                    Employee ID
                  </label>
                  <div className="relative">
                    <IdCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={idInputRef}
                      type="text"
                      value={idInput}
                      onChange={(e) => setIdInput(e.target.value.toUpperCase())}
                      placeholder="e.g. AHP-1001"
                      className="w-full bg-slate-50 border border-surface-border rounded-xl pl-9 pr-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green text-xs sm:text-sm font-mono font-semibold transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 text-[11px] font-bold uppercase tracking-wider block mb-1">
                    Staff Full Name
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Tariq Al-Balushi"
                      className="w-full bg-slate-50 border border-surface-border rounded-xl pl-9 pr-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green text-xs sm:text-sm font-medium transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-brand-green hover:bg-brand-green-hover disabled:opacity-60 text-white font-bold py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-pill active:scale-[0.99] cursor-pointer text-xs sm:text-sm"
                >
                  {isProcessing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Check size={15} strokeWidth={2.5} /> Confirm Check-In</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setMode('qr'); handleReset(); }}
                  className="w-full text-brand-blue hover:text-brand-blue-dark text-xs font-semibold flex items-center justify-center gap-1 transition-colors pt-0.5 cursor-pointer"
                >
                  <QrCode size={12} /> Switch back to QR Scan <ChevronRight size={12} />
                </button>
              </form>
            )}
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

      {/* Interactive Toast Notifications */}
      <Toast />
    </div>
  );
}
