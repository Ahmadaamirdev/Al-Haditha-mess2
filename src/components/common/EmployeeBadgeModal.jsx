import React, { useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Download, Printer, QrCode, Shield, CheckCircle2 } from 'lucide-react';
import logoAsset from '../../assets/logo.png';

const CATEGORY_COLORS = {
  Junior: { bg: '#009B4D', text: '#fff', badge: '#E5F5EC', badgeText: '#009B4D' },
  Senior: { bg: '#1684AA', text: '#fff', badge: '#E7F2F9', badgeText: '#1684AA' },
  VIP: { bg: '#6B46C1', text: '#fff', badge: '#EDE9FE', badgeText: '#6B46C1' },
};

export default function EmployeeBadgeModal({ employee, onClose }) {
  if (!employee) return null;

  const printRef = useRef(null);
  const catColors = CATEGORY_COLORS[employee.category] || CATEGORY_COLORS.Junior;
  
  // Permanent static QR code assigned to this employee (unique to each employee)
  const qrValue = employee.id;

  const handlePrint = useCallback(() => {
    const printContents = printRef.current?.innerHTML;
    if (!printContents) return;
    const win = window.open('', '_blank', 'width=500,height=600');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Pass - ${employee.name} (${employee.id})</title>
          <style>
            @page { margin: 10mm; size: auto; }
            body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; }
            * { box-sizing: border-box; }
            .print-card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; max-width: 320px; }
          </style>
        </head>
        <body>
          <div class="print-card">
            ${printContents}
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }, [employee]);

  const handleDownloadSvg = useCallback(() => {
    const svgEl = printRef.current?.querySelector('svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgEl);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${employee.id}-static-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [employee]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-brand-green" />
            <span className="font-bold text-slate-800 text-sm sm:text-base">Employee QR Pass</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body - Focused purely on Employee & Static Scannable QR Code */}
        <div className="p-6 flex flex-col items-center gap-5">
          {/* Printable Container */}
          <div ref={printRef} className="flex flex-col items-center w-full">
            {/* Header info */}
            <div className="text-center w-full mb-3">
              <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                {employee.name}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {employee.designation} · {employee.department}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {employee.id}
                </span>
                <span 
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: catColors.badge, color: catColors.badgeText }}
                >
                  {employee.category}
                </span>
              </div>
            </div>

            {/* LARGE STATIC QR CODE (Crisp, High Contrast, Instant Scan) */}
            <div className="p-4 bg-white rounded-2xl border-2 border-slate-200/90 shadow-sm flex items-center justify-center my-1">
              <QRCodeSVG
                value={qrValue}
                size={220}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="L"
                includeMargin={true}
              />
            </div>

            {/* Permanent Pass Subtitle */}
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-2">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Static Mess Hall Pass · Never Expires</span>
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-0.5">
              Scan this QR with another mobile at Entry Panel
            </p>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex gap-2 pt-1 border-t border-slate-100">
            <button
              onClick={handleDownloadSvg}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Download size={14} /> Download SVG
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-brand-green hover:bg-brand-green-hover text-white rounded-xl text-xs font-bold transition-all shadow-pill cursor-pointer"
            >
              <Printer size={14} /> Print Pass
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
