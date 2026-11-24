import React, { useRef, useCallback, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Download, Printer, QrCode, Shield, ExternalLink, Copy, Check } from 'lucide-react';
import { generateEmployeeQrPayload } from '../../data/employeesData';
import logoAsset from '../../assets/logo.png';

const CATEGORY_COLORS = {
  Junior: { bg: '#009B4D', text: '#fff', badge: '#E5F5EC', badgeText: '#009B4D' },
  Senior: { bg: '#1684AA', text: '#fff', badge: '#E7F2F9', badgeText: '#1684AA' },
  VIP: { bg: '#6B46C1', text: '#fff', badge: '#EDE9FE', badgeText: '#6B46C1' },
};

export default function EmployeeBadgeModal({ employee, onClose }) {
  if (!employee) return null;

  const badgeRef = useRef(null);
  const catColors = CATEGORY_COLORS[employee.category] || CATEGORY_COLORS.Junior;
  const qrPayload = generateEmployeeQrPayload(employee);

  const handlePrint = useCallback(() => {
    const printContents = badgeRef.current?.innerHTML;
    if (!printContents) return;
    const win = window.open('', '_blank', 'width=600,height=700');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Employee Badge - ${employee.name}</title>
          <style>
            @page { margin: 0; size: 90mm 55mm; }
            body { margin: 0; padding: 10px; font-family: system-ui, -apple-system, sans-serif; }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>
          ${printContents}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }, [employee]);

  const handleDownloadSvg = useCallback(() => {
    const svgEl = badgeRef.current?.querySelector('svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgEl);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${employee.id}-qr-badge.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [employee]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-slate-500" />
            <span className="font-semibold text-slate-700">ID Badge & QR Code</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Badge Preview */}
        <div className="p-5 flex flex-col items-center gap-4">
          <div ref={badgeRef} className="w-full">
            {/* Physical badge card design */}
            <div
              className="w-full rounded-2xl overflow-hidden shadow-lg"
              style={{ background: '#fff', border: '1.5px solid #e2e8f0' }}
            >
              {/* Badge header strip */}
              <div
                style={{ background: catColors.bg, padding: '10px 14px' }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <img src={logoAsset} alt="AHP" style={{ height: 28, width: 28, objectFit: 'contain', borderRadius: 4, background: '#fff' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  <div>
                    <div style={{ color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.85 }}>AL-HADITHA PETROLEUM SERVICES</div>
                    <div style={{ color: '#fff', fontSize: 8, opacity: 0.65 }}>S.A.O.C · Oman</div>
                  </div>
                </div>
                <div style={{ background: catColors.badgeText === catColors.bg ? 'rgba(255,255,255,0.2)' : catColors.badge, borderRadius: 100, padding: '2px 8px' }}>
                  <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }}>{employee.category?.toUpperCase()}</span>
                </div>
              </div>

              {/* Badge body */}
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Avatar */}
                <div style={{
                  width: 52, height: 52, borderRadius: 10, background: `${catColors.bg}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, border: `1.5px solid ${catColors.bg}44`,
                  color: catColors.bg, fontSize: 22, fontWeight: 800,
                }}>
                  {employee.name?.charAt(0) || '?'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#1e293b', lineHeight: 1.2 }}>{employee.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{employee.designation}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{employee.department}</div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ background: catColors.badge, color: catColors.badgeText, borderRadius: 100, padding: '2px 8px', fontSize: 9, fontWeight: 700 }}>
                      {employee.id}
                    </span>
                    {employee.shift && (
                      <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 100, padding: '2px 7px', fontSize: 9 }}>
                        {employee.shift}
                      </span>
                    )}
                  </div>
                </div>

                {/* QR Code */}
                <div style={{
                  flexShrink: 0,
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}>
                  <QRCodeSVG
                    value={qrPayload}
                    size={80}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                    level="L"
                    includeMargin={true}
                  />
                  <span style={{ fontSize: 7, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>MESS PASS</span>
                </div>
              </div>

              {/* Badge footer */}
              <div style={{
                background: '#f8fafc', borderTop: '1px solid #e2e8f0',
                padding: '5px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Shield size={9} color="#94a3b8" />
                  <span style={{ fontSize: 8, color: '#94a3b8' }}>Authorized Mess Hall Access</span>
                </div>
                <span style={{ fontSize: 8, color: '#cbd5e1', fontFamily: 'monospace' }}>{employee.qrToken || `AHP-QR-${employee.id.replace('AHP-', '')}`}</span>
              </div>
            </div>
          </div>

          {/* QR payload detail */}
          <div className="w-full bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500 font-mono break-all">
            <div className="text-slate-400 text-[10px] font-sans font-semibold uppercase tracking-wider mb-1">QR Payload</div>
            {qrPayload}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 px-5 pb-5">
          <div className="flex gap-2">
            <button
              onClick={() => window.open(`/pass/${employee.id}`, '_blank')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-brand-green hover:bg-brand-green-hover text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-pill cursor-pointer"
            >
              <ExternalLink size={14} /> Open Live Mobile Pass
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/pass/${employee.id}`;
                navigator.clipboard.writeText(url);
              }}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
              title="Copy link to send via WhatsApp/SMS"
            >
              <Copy size={14} /> Copy Link
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDownloadSvg}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition-colors border border-slate-200"
            >
              <Download size={13} /> SVG File
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
              style={{ background: catColors.bg }}
            >
              <Printer size={13} /> Print Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
