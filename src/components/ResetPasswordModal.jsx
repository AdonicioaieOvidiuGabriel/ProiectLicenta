import React, { useEffect, useState } from 'react';

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export default function ResetPasswordModal({ isOpen, onClose, initialEmail = '', token = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setEmail(initialEmail || '');
    setPassword('');
    setConfirm('');
    setMessage('');
    setError('');
    setIsSubmitting(false);
  }, [isOpen, initialEmail]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Emailul si parola sunt necesare.');
      return;
    }

    if (!token) {
      setError('Link-ul de resetare este invalid sau expirat.');
      return;
    }

    if (password.length < 8) {
      setError('Parola trebuie sa aiba cel putin 8 caractere.');
      return;
    }

    if (password !== confirm) {
      setError('Parolele nu coincid.');
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await fetch('http://localhost:3001/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword: password })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.message || data?.error || 'Eroare la resetare');
      }

      setMessage(data?.message || 'Parola a fost resetata cu succes.');
    } catch (err) {
      setError(err.message || 'Eroare');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_24px_100px_rgba(15,23,42,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-slate-900 px-8 py-10 text-white lg:px-10 lg:py-12 flex items-center justify-center min-h-[320px]">
            <div className="flex flex-col items-start leading-none text-left select-none">
              <span className="text-white text-4xl font-black tracking-tight">LICENTA</span>
              <span className="text-blue-300 text-4xl font-black tracking-tight">CONNECT</span>
              <span className="mt-2 text-white/60 text-xs font-bold uppercase tracking-[0.2em]">Universitatea Stefan cel Mare</span>
            </div>
          </div>

          <div className="bg-white px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Resetare parola</p>
                <h3 id="reset-modal-title" className="mt-2 text-2xl font-bold font-serif text-slate-900">
                  Seteaza parola noua
                </h3>
              </div>
            </div>

            {message ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div>{message}</div>
                <div className="mt-3 text-right">
                  <button type="button" onClick={onClose} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                    Continua
                  </button>
                </div>
              </div>
            ) : (
              <form className="mt-8 grid grid-cols-1 gap-4" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Field label="Email">
                  <input
                    value={email}
                    type="email"
                    placeholder="nume@usv.ro"
                    readOnly
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                </Field>

                <Field label="Parola noua">
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </Field>

                <Field label="Confirma parola">
                  <input
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </Field>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                  >
                    {isSubmitting ? 'Se proceseaza...' : 'Reseteaza parola'}
                  </button>

                  <button type="button" onClick={onClose} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                    Anuleaza
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}