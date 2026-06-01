import React, { useEffect } from 'react';

export default function QuizAccessModal({ isOpen, onClose, onContinue, onLogin, onSignup }) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-access-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_24px_100px_rgba(15,23,42,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-slate-900 px-8 py-10 text-white sm:px-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-300">
            LicentaConnect
          </div>

          <h2 id="quiz-access-title" className="mt-6 text-3xl font-bold font-serif leading-tight">
            Vrei să te loghezi pentru beneficii suplimentare?
          </h2>

          <p className="mt-4 max-w-xl text-sm leading-6 text-white/75">
            Cu un cont poți salva teme, păstra preferințele și accesa funcțiile viitoare. Dacă vrei doar să începi, poți continua fără cont.
          </p>
        </div>

        <div className="grid gap-3 px-6 py-8 sm:px-8 sm:py-10">
          <button
            type="button"
            onClick={onLogin}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition-colors hover:bg-slate-100"
          >
            <span className="block text-base font-bold text-slate-900">Log in</span>
            <span className="block text-sm text-slate-600">Intră în cont și salvează teme sau preferințe.</span>
          </button>

          <button
            type="button"
            onClick={onSignup}
            className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-left transition-colors hover:bg-blue-100"
          >
            <span className="block text-base font-bold text-slate-900">Sign up</span>
            <span className="block text-sm text-slate-600">Creează un cont pentru salvare și beneficii viitoare.</span>
          </button>

          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-2xl bg-slate-900 px-5 py-4 text-left transition-colors hover:bg-slate-800"
          >
            <span className="block text-base font-bold text-white">Continuă fără cont</span>
            <span className="block text-sm text-white/70">Mergi direct la chestionar, fără autentificare.</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mx-auto mt-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Închide
          </button>
        </div>
      </div>
    </div>
  );
}