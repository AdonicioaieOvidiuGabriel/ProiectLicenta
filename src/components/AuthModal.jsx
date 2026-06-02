import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { apiUrl } from '../utils/apiUrl';

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export default function AuthModal({ isOpen, mode = 'login', onClose, onSwitchMode, onAuthSuccess }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationPin, setVerificationPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState('student');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [completionMessage, setCompletionMessage] = useState('');
  const [signupPhase, setSignupPhase] = useState('form');
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

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

    setErrorMessage('');
    setInfoMessage('');
    setPassword('');
    setConfirmPassword('');
    setVerificationPin('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSignupPhase('form');
    setCompletionMessage('');

    if (mode === 'login') {
      setFullName('');
      setRole('student');
      setResetEmail('');
      setResetMessage('');
      setResetError('');
      setIsResetting(false);
    }
  }, [isOpen, mode]);

  if (!isOpen) {
    return null;
  }

  const isLogin = mode === 'login';
  const isVerificationStep = !isLogin && signupPhase === 'verify';

  const buildApiErrorMessage = (data, response) => {
    const serverMessage = String(data?.message || '').trim();
    const serverError = String(data?.error || '').trim();
    const serverDetails = String(data?.details || '').trim();

    if (response?.status >= 500) {
      return [serverError, serverDetails].filter(Boolean).join(' - ') || 'A apărut o eroare internă a serverului.';
    }

    if (serverMessage) {
      return serverMessage;
    }

    if (serverDetails && serverDetails !== serverError) {
      return `${serverError} (${serverDetails})`;
    }

    return serverError || serverDetails || 'A apărut o eroare necunoscută.';
  };

  const validateSignupDraft = () => {
    if (!fullName.trim()) {
      return 'Numele complet este obligatoriu.';
    }

    if (fullName.trim().length < 3) {
      return 'Numele complet trebuie să aibă cel puțin 3 caractere.';
    }

    if (!email.trim()) {
      return 'Emailul este obligatoriu.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Emailul introdus nu pare valid.';
    }

    if (!password.trim()) {
      return 'Parola este obligatorie.';
    }

    if (password.trim().length < 8) {
      return 'Parola trebuie să aibă cel puțin 8 caractere.';
    }

    if (password !== confirmPassword) {
      return 'Parolele nu coincid.';
    }

    return null;
  };

  const submitSignup = async () => {
    const validationError = validateSignupDraft();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(apiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          role
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildApiErrorMessage(data, response));
      }

      if (!data?.verificationRequired) {
        throw new Error('Nu am primit confirmarea pentru PIN.');
      }

      setSignupPhase('verify');
      setVerificationPin('');
      setInfoMessage(data?.message || 'Ți-am trimis un PIN pe email.');
    } catch (error) {
      setErrorMessage(error.message || 'Crearea contului a eșuat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifySignupPin = async () => {
    if (!verificationPin.trim()) {
      setErrorMessage('Introdu PIN-ul primit pe email.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(apiUrl('/api/auth/signup/verify-pin'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          pin: verificationPin.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildApiErrorMessage(data, response));
      }

      if (data?.pendingApproval) {
        setSignupPhase('pending');
        setCompletionMessage(data?.message || 'Cererea ta este în pending.');
        setErrorMessage('');
        setInfoMessage('');
        return;
      }

      if (!data?.account) {
        throw new Error('Contul nu a putut fi activat.');
      }

      onAuthSuccess?.(data.account);
      onClose?.();
    } catch (error) {
      setErrorMessage(error.message || 'Verificarea PIN-ului a eșuat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isVerificationStep) {
      await verifySignupPin();
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Emailul și parola sunt obligatorii.');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setErrorMessage('Parolele nu coincid.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(apiUrl(`/api/auth/${isLogin ? 'login' : 'signup'}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          role: isLogin ? undefined : role
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildApiErrorMessage(data, response));
      }

      if (!isLogin && data?.verificationRequired) {
        setSignupPhase('verify');
        setVerificationPin('');
        setInfoMessage(data?.message || 'Ți-am trimis un PIN pe email.');
        return;
      }

      if (!data?.account) {
        throw new Error('Răspunsul de autentificare nu conține un cont valid.');
      }

      onAuthSuccess?.(data.account);
      onClose?.();
    } catch (error) {
      setErrorMessage(error.message || 'Autentificarea a eșuat.');
      setInfoMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
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
              <span className="mt-2 text-white/60 text-xs font-bold uppercase tracking-[0.2em]">Universitatea Ștefan cel Mare</span>
            </div>
          </div>

          <form className="bg-white px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">{isLogin ? 'Log in' : 'Sign up'}</p>
                <h3 className="mt-2 text-2xl font-bold font-serif text-slate-900">
                  {isLogin ? 'Bine ai revenit' : 'Hai să îți creăm contul'}
                </h3>
              </div>
              <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-50">
                Închide
              </button>
            </div>

            {errorMessage && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {infoMessage && (
              <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {infoMessage}
              </div>
            )}

            {!isLogin && signupPhase === 'pending' ? (
              <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-emerald-900">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Cerere trimisă</p>
                <h4 className="mt-2 text-2xl font-bold font-serif">Contul tău de profesor este în pending</h4>
                <p className="mt-3 text-sm leading-6 text-emerald-800">
                  {completionMessage || 'Cererea ta a fost înregistrată. Vei primi un email atunci când administratorul aprobă sau respinge contul.'}
                </p>
                <button type="button" onClick={onClose} className="mt-6 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">
                  Închide
                </button>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-4">
              {!isLogin && !isVerificationStep && (
                <Field label="Nume complet">
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} type="text" placeholder="Numele și prenumele" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
                </Field>
              )}

              <Field label="Email">
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="nume@usv.ro" readOnly={isVerificationStep} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 read-only:bg-slate-50" />
              </Field>

              {!isVerificationStep && (
                <Field label="Parolă">
                <div className="relative">
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-slate-500 transition-colors hover:text-slate-700"
                    aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
                    title={showPassword ? 'Ascunde parola' : 'Arată parola'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                </Field>
              )}

              {!isLogin && !isVerificationStep && (
                <>
                  <Field label="Confirmă parola">
                    <div className="relative">
                      <input
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-slate-500 transition-colors hover:text-slate-700"
                        aria-label={showConfirmPassword ? 'Ascunde parola confirmată' : 'Arată parola confirmată'}
                        title={showConfirmPassword ? 'Ascunde parola confirmată' : 'Arată parola confirmată'}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </Field>

                  <Field label="Rol">
                    <select value={role} onChange={(event) => setRole(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                      <option value="student">Student</option>
                      <option value="professor">Profesor</option>
                    </select>
                  </Field>
                </>
              )}

              {isVerificationStep && (
                <Field label="PIN verificare">
                  <input
                    value={verificationPin}
                    onChange={(event) => setVerificationPin(event.target.value)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 tracking-[0.3em]"
                  />
                </Field>
              )}
              </div>
            )}

            {!isLogin && signupPhase !== 'pending' && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="submit" disabled={isSubmitting} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500">
                  {isSubmitting ? 'Se procesează...' : isVerificationStep ? 'Verifică PIN-ul' : 'Creează contul'}
                </button>

                {isVerificationStep ? (
                  <div className="flex items-center gap-3 text-sm font-semibold">
                    <button type="button" onClick={() => { setSignupPhase('form'); setVerificationPin(''); setErrorMessage(''); }} className="text-blue-600 hover:text-blue-700">
                      Înapoi la date
                    </button>
                    <button type="button" onClick={submitSignup} className="text-slate-500 hover:text-slate-700">
                      Retrimite PIN-ul
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => onSwitchMode?.('login')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                    Ai deja cont? Log in
                  </button>
                )}
              </div>
            )}

            {isLogin && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="submit" disabled={isSubmitting} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500">
                  {isSubmitting ? 'Se procesează...' : 'Autentifică-te'}
                </button>

                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => onSwitchMode?.('signup')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                    Nu ai cont? Sign up
                  </button>
                  <button type="button" onClick={() => { setIsResetting(true); setResetEmail(email); setResetMessage(''); setResetError(''); }} className="text-sm font-semibold text-slate-600 hover:text-slate-700">
                    Ai uitat parola?
                  </button>
                </div>
              </div>
            )}

            {isLogin && isResetting && (
              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-900">
                {resetMessage ? (
                  <div>{resetMessage}</div>
                ) : (
                  <>
                    <p className="mb-3">Introdu emailul asociat contului pentru a primi linkul de resetare.</p>
                    <div className="flex gap-2">
                      <input value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} type="email" placeholder="nume@domeniu.com" className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none" />
                      <button onClick={async () => {
                        setResetSubmitting(true); setResetError(''); setResetMessage('');
                        try {
                          const resp = await fetch(apiUrl('/api/auth/password-reset/request'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: resetEmail }) });
                          const data = await resp.json();
                          if (!resp.ok) throw new Error(data?.message || data?.error || 'Eroare la trimitere.');
                          setResetMessage(data?.message || 'Dacă există un cont, vei primi instrucțiuni pe email.');
                        } catch (err) {
                          setResetError(err.message || 'Eroare');
                        } finally { setResetSubmitting(false); }
                      }} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">{resetSubmitting ? 'Se trimite...' : 'Trimite'}</button>
                    </div>
                    {resetError && <div className="mt-2 text-sm text-red-700">{resetError}</div>}
                  </>
                )}
                <div className="mt-3 text-right">
                  <button type="button" onClick={() => setIsResetting(false)} className="text-sm text-blue-600 hover:text-blue-700">Închide</button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}