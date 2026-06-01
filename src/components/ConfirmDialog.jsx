import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmă',
  cancelLabel = 'Renunță',
  onConfirm,
  onCancel
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 px-6 py-5 text-white">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-amber-300 ring-1 ring-white/10">
              <AlertTriangle size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">Confirmare acțiune</p>
              <h3 id="confirm-dialog-title" className="mt-2 text-2xl font-black tracking-tight">
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Închide dialogul"
              title="Închide"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-7">
          <p id="confirm-dialog-description" className="text-sm leading-6 text-slate-600">
            {description}
          </p>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-transform hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-600"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}