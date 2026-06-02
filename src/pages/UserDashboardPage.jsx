import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeInfo, CircleUserRound, LockKeyhole, Mail, Plus, RefreshCw, Search, Send, Trash2, UserCog, Users, BookOpenText } from 'lucide-react';
import { clearAuthSession, readAuthSession, writeAuthSession } from '../utils/authSession';
import { FACULTY_LABELS, FACULTY_PROFILES } from '../data/facultyProfiles';
import { apiUrl } from '../utils/apiUrl';

const ADMIN_API_ROOT = apiUrl('/api/admin');

const emptyTopicForm = {
  id: '',
  facultatea: '',
  profesor: '',
  nivel_studii: '',
  specializari: '',
  titlu_tema: '',
  descriere: '',
  source_file: ''
};

const emptyAccountForm = {
  role: 'student',
  fullName: '',
  email: '',
  password: '',
  faculty: '',
  specialization: '',
  studyLevel: '',
  employeeTitle: '',
  isActive: true,
  mustChangePassword: false
};

const parseSpecializations = (value) =>
  String(value || '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const STUDY_LEVEL_OPTIONS = [
  ['licenta', 'Licență'],
  ['disertatie', 'Masterat']
];

const STUDY_LEVEL_LABELS = Object.fromEntries(STUDY_LEVEL_OPTIONS);

const getSpecializationsForSelection = (faculty, studyLevel) => {
  if (!faculty) return [];

  const profile = FACULTY_PROFILES[faculty];
  if (!profile) return [];

  const byLevel = profile.specializationsByLevel?.[studyLevel];
  if (Array.isArray(byLevel) && byLevel.length > 0) {
    return byLevel;
  }

  return Array.isArray(profile.specializations) ? profile.specializations : [];
};

export default function UserDashboardPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(() => readAuthSession());
  const [activeTab, setActiveTab] = useState('topics');
  const [topics, setTopics] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingTopic, setSavingTopic] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [topicQuery, setTopicQuery] = useState('');
  const [accountQuery, setAccountQuery] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [topicForm, setTopicForm] = useState(emptyTopicForm);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [studentQuizSessions, setStudentQuizSessions] = useState([]);
  const [studentSentEmails, setStudentSentEmails] = useState([]);
  const [studentActivityLoading, setStudentActivityLoading] = useState(false);
  const [studentActivityError, setStudentActivityError] = useState('');
  const [profileForm, setProfileForm] = useState({ faculty: '', specialization: '', studyLevel: '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('info');

  const isAdmin = account?.role === 'admin';
  const isProfessor = account?.role === 'professor';
  const canManageTopics = isAdmin || (isProfessor && account?.approvalStatus === 'approved');
  const topicManagerQuery = account
    ? `accountId=${encodeURIComponent(String(account.id || ''))}&email=${encodeURIComponent(String(account.email || ''))}`
    : '';
  const defaultProfessorName = isProfessor ? String(account?.fullName || '').trim() : '';

  useEffect(() => {
    let timeoutId = null;
    if (statusMessage) {
      timeoutId = window.setTimeout(() => setStatusMessage(''), 4000);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [statusMessage]);

  const showStatus = (message, type = 'info') => {
    setStatusMessage(message);
    setStatusType(type);
  };

  const loadDashboardData = async () => {
    if (!canManageTopics) {
      setTopics([]);
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const topicsResponse = await fetch(`${ADMIN_API_ROOT}/topics?${topicManagerQuery}`);
      const accountsResponse = isAdmin ? await fetch(`${ADMIN_API_ROOT}/accounts`) : null;

      const topicsData = await topicsResponse.json();
      const accountsData = accountsResponse ? await accountsResponse.json() : { accounts: [] };

      if (!topicsResponse.ok) {
        throw new Error(topicsData?.details || topicsData?.error || 'Nu am putut încărca temele.');
      }

      if (accountsResponse && !accountsResponse.ok) {
        throw new Error(accountsData?.details || accountsData?.error || 'Nu am putut încărca conturile.');
      }

      setTopics(Array.isArray(topicsData.topics) ? topicsData.topics : []);
      setAccounts(isAdmin && Array.isArray(accountsData.accounts) ? accountsData.accounts : []);
    } catch (error) {
      showStatus(error.message || 'Eroare la încărcarea datelor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }

    loadDashboardData();
  }, [account]);

  useEffect(() => {
    if (!canManageTopics || selectedTopicId || !defaultProfessorName) {
      return;
    }

    setTopicForm((prev) => ({
      ...prev,
      profesor: prev.profesor || defaultProfessorName
    }));
  }, [canManageTopics, defaultProfessorName, selectedTopicId]);

  useEffect(() => {
    if (!account) {
      return;
    }

    setProfileForm({
      faculty: account.faculty || '',
      specialization: account.specialization || '',
      studyLevel: account.studyLevel || ''
    });

    if (!isAdmin) {
      setActiveTab('topics');
      const hasAcademicData = Boolean(account.faculty && account.specialization && account.studyLevel);
      setIsEditingProfile(!hasAcademicData);
    }
  }, [account]);

  useEffect(() => {
    if (!account || isAdmin) {
      return;
    }

    let cancelled = false;

    const loadStudentActivity = async () => {
      setStudentActivityLoading(true);
      setStudentActivityError('');

      try {
        const studentEmail = String(account.email || '').trim();
        if (!studentEmail) {
          throw new Error('Contul nu are un email valid pentru a încărca istoricul.');
        }

        const response = await fetch(apiUrl(`/api/student/activity?email=${encodeURIComponent(studentEmail)}`));
        let filteredSessions = [];
        let emailHistory = [];

        if (response.ok) {
          const data = await response.json();
          filteredSessions = Array.isArray(data.quizSessions) ? data.quizSessions : [];
          emailHistory = Array.isArray(data.sentEmails) ? data.sentEmails : [];
        }

        if (!cancelled) {
          setStudentQuizSessions(filteredSessions);
          setStudentSentEmails(emailHistory);
        }
      } catch (error) {
        if (!cancelled) {
          setStudentActivityError(error.message || 'Nu am putut încărca activitatea contului.');
        }
      } finally {
        if (!cancelled) {
          setStudentActivityLoading(false);
        }
      }
    };

    loadStudentActivity();

    return () => {
      cancelled = true;
    };
  }, [account, isAdmin]);

  const visibleTopics = useMemo(() => {
    if (!isProfessor) {
      return topics;
    }

    const accountId = Number(account?.id || 0);
    const accountEmail = String(account?.email || '').trim().toLowerCase();
    const professorName = String(account?.fullName || '').trim().toLowerCase();

    return topics.filter((topic) => {
      const creatorAccountId = Number(topic?.creatorAccountId || 0);
      const creatorEmail = String(topic?.creatorEmail || '').trim().toLowerCase();
      const topicProfessor = String(topic?.profesor || '').trim().toLowerCase();

      if (accountId > 0 && creatorAccountId === accountId) {
        return true;
      }

      if (accountEmail && creatorEmail && creatorEmail === accountEmail) {
        return true;
      }

      return professorName && topicProfessor === professorName;
    });
  }, [account, isProfessor, topics]);

  const filteredTopics = useMemo(() => {
    const query = topicQuery.trim().toLowerCase();
    if (!query) {
      return visibleTopics;
    }

    return visibleTopics.filter((topic) => {
      const haystack = [topic.id, topic.facultatea, topic.profesor, topic.nivel_studii, topic.titlu_tema, topic.descriere, Array.isArray(topic.specializari) ? topic.specializari.join(' ') : '']
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [topicQuery, visibleTopics]);

  const filteredAccounts = useMemo(() => {
    const query = accountQuery.trim().toLowerCase();
    if (!query) {
      return accounts;
    }

    return accounts.filter((item) => {
      const haystack = [item.accountCode, item.fullName, item.email, item.role, item.faculty, item.specialization, item.studyLevel, item.employeeTitle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [accounts, accountQuery]);

  const specializationOptionsForProfile = useMemo(
    () => getSpecializationsForSelection(profileForm.faculty, profileForm.studyLevel),
    [profileForm.faculty, profileForm.studyLevel]
  );

  const specializationOptionsForTopic = useMemo(
    () => getSpecializationsForSelection(topicForm.facultatea, topicForm.nivel_studii),
    [topicForm.facultatea, topicForm.nivel_studii]
  );

  const profileFacultyLabel = FACULTY_LABELS[account?.faculty] || account?.faculty || 'Nespecificat';
  const profileStudyLevelLabel = STUDY_LEVEL_LABELS[account?.studyLevel] || account?.studyLevel || 'Nespecificat';
  const profileSpecializationLabel = account?.specialization || 'Nespecificat';

  useEffect(() => {
    if (!profileForm.specialization) return;
    if (!specializationOptionsForProfile.includes(profileForm.specialization)) {
      setProfileForm((prev) => ({ ...prev, specialization: '' }));
    }
  }, [profileForm.specialization, specializationOptionsForProfile]);

  useEffect(() => {
    if (!topicForm.specializari) return;
    if (!specializationOptionsForTopic.includes(topicForm.specializari)) {
      setTopicForm((prev) => ({ ...prev, specializari: '' }));
    }
  }, [specializationOptionsForTopic, topicForm.specializari]);

  const resetTopicForm = () => {
    setSelectedTopicId('');
    setTopicForm({
      ...emptyTopicForm,
      profesor: defaultProfessorName
    });
  };

  const resetAccountForm = () => {
    setSelectedAccountId('');
    setAccountForm(emptyAccountForm);
  };

  const editTopic = (topic) => {
    setSelectedTopicId(topic.id);
    setTopicForm({
      id: topic.id || '',
      facultatea: topic.facultatea || '',
      profesor: topic.profesor || '',
      nivel_studii: topic.nivel_studii || '',
      specializari: Array.isArray(topic.specializari) ? (topic.specializari[0] || '') : '',
      titlu_tema: topic.titlu_tema || '',
      descriere: topic.descriere || '',
      source_file: topic.sursa || topic.source_file || ''
    });
    setActiveTab('topics');
  };

  const editAccount = (item) => {
    setSelectedAccountId(String(item.id));
    setAccountForm({
      role: item.role || 'student',
      fullName: item.fullName || '',
      email: item.email || '',
      password: '',
      faculty: item.faculty || '',
      specialization: item.specialization || '',
      studyLevel: item.studyLevel || '',
      employeeTitle: item.employeeTitle || '',
      isActive: Boolean(item.isActive),
      mustChangePassword: Boolean(item.mustChangePassword)
    });
    setActiveTab('accounts');
  };

  const saveTopic = async (event) => {
    event.preventDefault();
    if (!canManageTopics) return;

    if (!topicForm.facultatea.trim() || !topicForm.profesor.trim() || !topicForm.nivel_studii.trim() || !topicForm.titlu_tema.trim()) {
      showStatus('Completează câmpurile obligatorii pentru temă.', 'error');
      return;
    }

    setSavingTopic(true);
    try {
      const payload = {
        ...topicForm,
        profesor: isProfessor ? defaultProfessorName : topicForm.profesor,
        specializari: parseSpecializations(topicForm.specializari),
        accountId: account?.id,
        email: account?.email
      };

      const response = await fetch(`${ADMIN_API_ROOT}/topics${selectedTopicId ? `/${encodeURIComponent(selectedTopicId)}` : ''}`, {
        method: selectedTopicId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.details || data?.error || 'Nu am putut salva tema.');
      }

      showStatus(selectedTopicId ? 'Tema a fost actualizată.' : 'Tema a fost adăugată.', 'success');
      resetTopicForm();
      await loadDashboardData();
    } catch (error) {
      showStatus(error.message || 'Nu am putut salva tema.', 'error');
    } finally {
      setSavingTopic(false);
    }
  };

  const deleteTopic = async (topicId) => {
    if (!canManageTopics || !window.confirm('Sigur vrei să ștergi această temă?')) return;

    try {
      const response = await fetch(`${ADMIN_API_ROOT}/topics/${encodeURIComponent(topicId)}?${topicManagerQuery}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.details || data?.error || 'Nu am putut șterge tema.');
      }

      showStatus('Tema a fost ștearsă.', 'success');
      if (selectedTopicId === topicId) {
        resetTopicForm();
      }
      await loadDashboardData();
    } catch (error) {
      showStatus(error.message || 'Nu am putut șterge tema.', 'error');
    }
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    if (!accountForm.fullName.trim() || !accountForm.email.trim() || (!selectedAccountId && !accountForm.password.trim())) {
      showStatus('Completează numele, emailul și parola pentru contul nou.', 'error');
      return;
    }

    setSavingAccount(true);
    try {
      const payload = {
        ...accountForm,
        password: accountForm.password.trim() || undefined
      };

      const response = await fetch(`${ADMIN_API_ROOT}/accounts${selectedAccountId ? `/${selectedAccountId}` : ''}`, {
        method: selectedAccountId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.details || data?.error || 'Nu am putut salva contul.');
      }

      showStatus(selectedAccountId ? 'Contul a fost actualizat.' : 'Contul a fost creat.', 'success');
      resetAccountForm();
      await loadDashboardData();
    } catch (error) {
      showStatus(error.message || 'Nu am putut salva contul.', 'error');
    } finally {
      setSavingAccount(false);
    }
  };

  const deleteAccount = async (accountId) => {
    if (!isAdmin || !window.confirm('Sigur vrei să ștergi acest cont?')) return;

    try {
      const response = await fetch(`${ADMIN_API_ROOT}/accounts/${accountId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.details || data?.error || 'Nu am putut șterge contul.');
      }

      showStatus('Contul a fost șters.', 'success');
      if (selectedAccountId === String(accountId)) {
        resetAccountForm();
      }
      await loadDashboardData();
    } catch (error) {
      showStatus(error.message || 'Nu am putut șterge contul.', 'error');
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setAccount(null);
    navigate('/');
  };

  const saveMyProfile = async (event) => {
    event.preventDefault();
    if (!account || isAdmin) {
      return;
    }

    if (!profileForm.faculty || !profileForm.studyLevel || !profileForm.specialization) {
      showStatus('Selectează facultatea, nivelul de studii și specializarea.', 'error');
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch(apiUrl('/api/account/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          email: account.email,
          faculty: profileForm.faculty,
          specialization: profileForm.specialization,
          studyLevel: profileForm.studyLevel
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.details || data?.error || 'Nu am putut salva profilul.');
      }

      if (data?.account) {
        setAccount(data.account);
        writeAuthSession(data.account);
      }

      setIsEditingProfile(false);
      showStatus('Profilul tău a fost actualizat.', 'success');
    } catch (error) {
      showStatus(error.message || 'Nu am putut salva profilul.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-200 via-blue-100 to-blue-50 flex items-center justify-center px-4 text-slate-900">
        <div className="w-full max-w-xl rounded-[2rem] border border-blue-200 bg-white p-8 shadow-[0_24px_60px_-36px_rgba(37,99,235,0.45)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-700">Cont utilizator</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold font-['Liberation_Serif'] leading-tight text-slate-900">Trebuie să fii autentificat pentru a deschide pagina contului.</h1>
          <p className="mt-4 text-sm md:text-base leading-6 text-slate-600">Autentifică-te din header, apoi revino aici apăsând pe iconița contului.</p>
          <div className="mt-8 flex gap-3">
            <Link to="/" className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800">Înapoi la start</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#d5e2f1] text-slate-900">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,_rgba(30,64,175,0.30),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.24),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(96,165,250,0.20),_transparent_30%),linear-gradient(180deg,_#bfd2ea_0%,_#d9e6f5_32%,_#eff5fb_68%,_#dce8f5_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px)] bg-[size:84px_84px] opacity-50" />
      <div className="pointer-events-none absolute -left-24 top-24 -z-10 h-72 w-72 rounded-full bg-sky-400/18 blur-3xl" />
      <div className="pointer-events-none absolute right-[-5rem] top-[22rem] -z-10 h-80 w-80 rounded-full bg-blue-700/14 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-1/3 -z-10 h-96 w-96 rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-slate-900/12 to-transparent" />

      <div className="relative">
      <header className="sticky top-0 z-40 w-full bg-slate-900/95 text-white shadow-lg backdrop-blur-sm border-b border-blue-400/30 px-4 md:px-20">
        <div className="w-full h-24 flex justify-between items-center relative">
          <Link to="/" className="flex items-center gap-4 z-10 hover:opacity-90 transition-opacity">
            <div className="flex flex-col items-start">
              <span className="text-white text-2xl font-black tracking-tight leading-none">LICENTA<span className="text-blue-300">CONNECT</span></span>
              <span className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mt-1 text-left">Universitatea Ștefan cel Mare</span>
            </div>
          </Link>

          <div className="flex items-center gap-3 shrink-0 z-10">
            <button type="button" onClick={loadDashboardData} className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/5 hover:border-blue-300/60">
              <RefreshCw size={16} /> Reîmprospătează
            </button>
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 rounded-sm bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700">
              Deconectare
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-6 lg:px-10">
        {statusMessage && (
          <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${statusType === 'error' ? 'border-red-200 bg-red-50 text-red-700' : statusType === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
            {statusMessage}
          </div>
        )}

        {!canManageTopics ? (
          <div className="mt-8 grid gap-8">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="text-2xl font-bold text-slate-900">Profilul tău</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoCard label="Nume complet" value={account.fullName || 'Nespecificat'} />
                <InfoCard label="Email" value={account.email || 'Nespecificat'} />
                <InfoCard label="Rol" value={account.role || 'Nespecificat'} />
              </div>

              <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/30 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Date academice</p>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
                  >
                    {isEditingProfile ? 'Renunță' : 'Editează'}
                  </button>
                </div>

                {!isEditingProfile ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <InfoCard label="Facultate" value={profileFacultyLabel} />
                    <InfoCard label="Nivel studii" value={profileStudyLevelLabel} />
                    <InfoCard label="Specializare" value={profileSpecializationLabel} />
                  </div>
                ) : (
                  <form onSubmit={saveMyProfile} className="mt-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <SelectField
                        label="Facultate"
                        value={profileForm.faculty}
                        onChange={(value) => setProfileForm((prev) => ({ ...prev, faculty: value }))}
                        options={[
                          ['', 'Selectează facultatea'],
                          ...Object.keys(FACULTY_LABELS).map((code) => [code, FACULTY_LABELS[code]])
                        ]}
                      />
                      <SelectField
                        label="Nivel studii"
                        value={profileForm.studyLevel}
                        onChange={(value) => setProfileForm((prev) => ({ ...prev, studyLevel: value }))}
                        options={[['', 'Selectează nivelul'], ...STUDY_LEVEL_OPTIONS]}
                      />
                      <SelectField
                        label="Specializare"
                        value={profileForm.specialization}
                        onChange={(value) => setProfileForm((prev) => ({ ...prev, specialization: value }))}
                        options={[
                          ['', specializationOptionsForProfile.length > 0 ? 'Selectează specializarea' : 'Selectează mai întâi facultatea și nivelul'],
                          ...specializationOptionsForProfile.map((value) => [value, value])
                        ]}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {savingProfile ? 'Se salvează...' : 'Salvează profilul'}
                    </button>
                  </form>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-700">Istoric quiz</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">Sesiuni și recomandări</h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/quiz')}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <BookOpenText size={16} /> Pornește un quiz nou
                </button>
              </div>

              {studentActivityLoading ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-500">Se încarcă istoricul quiz-urilor...</div>
              ) : studentQuizSessions.length > 0 ? (
                <div className="mt-6 grid gap-5">
                  {studentQuizSessions.map((session) => (
                    <div key={session.sessionId} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">{new Date(session.createdAt).toLocaleString('ro-RO')}</p>
                          <h3 className="mt-1 text-lg font-bold text-slate-900">{session.formData.faculty || 'Facultate nespecificată'} • {session.formData.specialization || 'Specializare nespecificată'}</h3>
                          <p className="mt-1 text-sm text-slate-600">{session.formData.studyLevel || 'Nivel de studii nespecificat'} • {session.formData.applicationDomain || 'Fără domeniu declarat'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/recommendations', {
                            state: {
                              formData: session.formData,
                              recommendations: session.recommendations,
                              aiResponse: session.aiResponse
                            }
                          })}
                          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
                        >
                          <Send size={16} /> Trimite email
                        </button>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <InfoCard label="Competențe" value={formatArrayValue(session.formData.selectedSkillTags?.length ? session.formData.selectedSkillTags : session.formData.skills)} />
                        <InfoCard label="Competențe suplimentare" value={session.formData.additionalSkills || 'Nespecificate'} />
                        <InfoCard label="Tip proiect" value={session.formData.projectType || 'Nespecificat'} />
                      </div>

                      {session.formData.interests || session.formData.careerGoals ? (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <InfoCard label="Interese" value={session.formData.interests || 'Nespecificate'} />
                          <InfoCard label="Obiective de carieră" value={session.formData.careerGoals || 'Nespecificate'} />
                        </div>
                      ) : null}

                      <div className="mt-5">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Teme recomandate</p>
                        {Array.isArray(session.recommendations) && session.recommendations.length > 0 ? (
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {session.recommendations.slice(0, 4).map((recommendation) => (
                              <div key={recommendation.id} className="rounded-2xl border border-blue-100 bg-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-slate-900">{recommendation.title}</p>
                                    <p className="mt-1 text-sm text-slate-600">{recommendation.professor || 'Profesor nespecificat'}</p>
                                  </div>
                                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">
                                    {Math.round(recommendation.matchScore || 0)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Această sesiune nu are recomandări salvate.</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
                  Nu există încă nicio sesiune de quiz salvată pentru contul tău.
                </div>
              )}

              {studentActivityError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {studentActivityError}
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-700">Emailuri trimise</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">Mesaje către profesori</h2>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
                  {studentSentEmails.length} înregistrări
                </span>
              </div>

              {studentSentEmails.length > 0 ? (
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {studentSentEmails.map((emailItem) => (
                    <div key={emailItem.id} className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">{new Date(emailItem.timestamp).toLocaleString('ro-RO')}</p>
                          <p className="mt-1 text-base font-bold text-slate-900">{emailItem.topic?.title || 'Temă nespecificată'}</p>
                          <p className="mt-1 text-sm text-slate-600">{emailItem.topic?.professor || 'Profesor nespecificat'}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                          Trimis
                        </span>
                      </div>

                      <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Către</p>
                        <a href={`mailto:${emailItem.profesorEmail}`} className="mt-1 block break-all text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                          {emailItem.profesorEmail}
                        </a>
                      </div>

                      {emailItem.previewUrl && (
                        <a href={emailItem.previewUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800">
                          <Mail size={16} /> Vezi preview
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
                  Nu există emailuri trimise încă pentru acest cont.
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex flex-wrap gap-2">
                <TabButton active={activeTab === 'topics'} onClick={() => setActiveTab('topics')} icon={BookOpenText} label="Teme" />
                {isAdmin && <TabButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={Users} label="Conturi" />}
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{isAdmin ? 'Acces administrativ complet' : 'Gestionarea temelor tale'}</div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-slate-500">Se încarcă datele de administrare...</div>
            ) : (
              <div className="pt-6">
                {activeTab === 'topics' && (
                  <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
                      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h2 className="text-2xl font-bold text-slate-900">Teme</h2>
                            <p className="text-sm text-slate-500">{isAdmin ? 'Adaugă, editează sau șterge înregistrări din tabela topics.' : 'Adaugă, editează sau șterge doar temele create de tine.'}</p>
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
                            <Search size={16} className="text-slate-400" />
                            <input value={topicQuery} onChange={(event) => setTopicQuery(event.target.value)} placeholder="Caută teme..." className="w-56 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                          </div>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                            <thead>
                              <tr className="text-xs uppercase tracking-[0.14em] text-slate-400">
                                <Th>Facultate</Th>
                                <Th>Profesor</Th>
                                <Th>Studii</Th>
                                <Th>Titlu</Th>
                                <Th>Acțiuni</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredTopics.map((topic) => (
                                <tr key={topic.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                                  <Td>{topic.facultatea}</Td>
                                  <Td className="min-w-[180px]">{topic.profesor}</Td>
                                  <Td>{topic.nivel_studii}</Td>
                                  <Td className="min-w-[280px] max-w-[420px]">{topic.titlu_tema}</Td>
                                  <Td>
                                    <div className="flex flex-wrap gap-2">
                                      <ActionButton onClick={() => editTopic(topic)} label="Editează" />
                                      <ActionButton danger onClick={() => deleteTopic(topic.id)} label="Șterge" icon={Trash2} />
                                    </div>
                                  </Td>
                                </tr>
                              ))}
                              {filteredTopics.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-8 text-center text-slate-500">Nu există teme care să corespundă filtrului.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <form onSubmit={saveTopic} className="rounded-3xl border border-slate-200 bg-blue-50/40 p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-bold text-slate-900">{selectedTopicId ? 'Editează tema' : 'Adaugă temă'}</h3>
                            <p className="text-sm text-slate-500">{isAdmin ? 'Ține forma simplă, așa cum e și restul platformei.' : 'Tema nouă va fi salvată pe contul tău de profesor.'}</p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4">
                          <SelectField
                            label="Facultate"
                            value={topicForm.facultatea}
                            onChange={(value) => setTopicForm((prev) => ({ ...prev, facultatea: value }))}
                            options={[
                              ['', 'Selectează facultatea'],
                              ...Object.keys(FACULTY_LABELS).map((code) => [code, FACULTY_LABELS[code]])
                            ]}
                          />
                          <TextField label="Profesor" value={topicForm.profesor} onChange={(value) => setTopicForm((prev) => ({ ...prev, profesor: value }))} disabled={isProfessor} placeholder="Prof. ..." />
                          <SelectField
                            label="Nivel studii"
                            value={topicForm.nivel_studii}
                            onChange={(value) => setTopicForm((prev) => ({ ...prev, nivel_studii: value }))}
                            options={[['', 'Selectează nivelul'], ...STUDY_LEVEL_OPTIONS]}
                          />
                          <SelectField
                            label="Specializare"
                            value={topicForm.specializari}
                            onChange={(value) => setTopicForm((prev) => ({ ...prev, specializari: value }))}
                            options={[
                              ['', specializationOptionsForTopic.length > 0 ? 'Selectează specializarea' : 'Selectează mai întâi facultatea și nivelul'],
                              ...specializationOptionsForTopic.map((value) => [value, value])
                            ]}
                          />
                          <TextAreaField label="Titlu temă" value={topicForm.titlu_tema} onChange={(value) => setTopicForm((prev) => ({ ...prev, titlu_tema: value }))} placeholder="Titlul temei" />
                          <TextAreaField label="Descriere" value={topicForm.descriere} onChange={(value) => setTopicForm((prev) => ({ ...prev, descriere: value }))} placeholder="Descriere opțională" />
                        </div>

                        <button type="submit" disabled={savingTopic} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                          <Plus size={16} /> {savingTopic ? 'Se salvează...' : selectedTopicId ? 'Actualizează tema' : 'Adaugă tema'}
                        </button>
                      </form>
                    </div>
                  )}

                {isAdmin && activeTab === 'accounts' && (
                    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
                      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h2 className="text-2xl font-bold text-slate-900">Conturi</h2>
                            <p className="text-sm text-slate-500">Administrezi tabela accounts din același spațiu de lucru.</p>
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
                            <Search size={16} className="text-slate-400" />
                            <input value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} placeholder="Caută conturi..." className="w-56 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                          </div>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                            <thead>
                              <tr className="text-xs uppercase tracking-[0.14em] text-slate-400">
                                <Th>Cod</Th>
                                <Th>Nume</Th>
                                <Th>Email</Th>
                                <Th>Rol</Th>
                                <Th>Stare</Th>
                                <Th>Acțiuni</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredAccounts.map((item) => (
                                <tr key={item.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                                  <Td>{item.accountCode}</Td>
                                  <Td className="min-w-[180px]">
                                    <div className="font-semibold text-slate-900">{item.fullName}</div>
                                    <div className="text-xs text-slate-500">{item.employeeTitle || 'Fără funcție'}</div>
                                  </Td>
                                  <Td className="min-w-[220px]">{item.email}</Td>
                                  <Td>{item.role}</Td>
                                  <Td>
                                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                      {item.isActive ? 'activ' : 'inactiv'}
                                    </span>
                                  </Td>
                                  <Td>
                                    <div className="flex flex-wrap gap-2">
                                      <ActionButton onClick={() => editAccount(item)} label="Editează" icon={UserCog} />
                                      <ActionButton danger onClick={() => deleteAccount(item.id)} label="Șterge" icon={Trash2} />
                                    </div>
                                  </Td>
                                </tr>
                              ))}
                              {filteredAccounts.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="py-8 text-center text-slate-500">Nu există conturi care să corespundă filtrului.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <form onSubmit={saveAccount} className="rounded-3xl border border-slate-200 bg-blue-50/40 p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-bold text-slate-900">{selectedAccountId ? 'Editează contul' : 'Adaugă cont'}</h3>
                            <p className="text-sm text-slate-500">Formular simplu, fără elemente care ies din stilul aplicației.</p>
                          </div>
                          <button type="button" onClick={resetAccountForm} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50">Nou</button>
                        </div>

                        <div className="mt-5 grid gap-4">
                          <TextField label="Nume complet" value={accountForm.fullName} onChange={(value) => setAccountForm((prev) => ({ ...prev, fullName: value }))} placeholder="Nume Prenume" />
                          <TextField label="Email" value={accountForm.email} onChange={(value) => setAccountForm((prev) => ({ ...prev, email: value }))} placeholder="email@usv.ro" />
                          <TextField label="Parolă" value={accountForm.password} onChange={(value) => setAccountForm((prev) => ({ ...prev, password: value }))} placeholder={selectedAccountId ? 'Lasă gol pentru a păstra parola' : 'Parolă inițială'} type="password" icon={LockKeyhole} />
                          <SelectField label="Rol" value={accountForm.role} onChange={(value) => setAccountForm((prev) => ({ ...prev, role: value }))} options={[['student', 'Student'], ['professor', 'Profesor'], ['admin', 'Admin']]} />
                          <TextField label="Facultate" value={accountForm.faculty} onChange={(value) => setAccountForm((prev) => ({ ...prev, faculty: value }))} placeholder="FIESC" />
                          <TextField label="Specializare" value={accountForm.specialization} onChange={(value) => setAccountForm((prev) => ({ ...prev, specialization: value }))} placeholder="C / AIA / ..." />
                          <TextField label="Nivel studii" value={accountForm.studyLevel} onChange={(value) => setAccountForm((prev) => ({ ...prev, studyLevel: value }))} placeholder="Licență / Masterat" />
                          <TextField label="Titlu funcție" value={accountForm.employeeTitle} onChange={(value) => setAccountForm((prev) => ({ ...prev, employeeTitle: value }))} placeholder="Administrator / Profesor" />

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <ToggleField label="Cont activ" checked={accountForm.isActive} onChange={(checked) => setAccountForm((prev) => ({ ...prev, isActive: checked }))} />
                            <ToggleField label="Schimbă parola la login" checked={accountForm.mustChangePassword} onChange={(checked) => setAccountForm((prev) => ({ ...prev, mustChangePassword: checked }))} />
                          </div>
                        </div>

                        <button type="submit" disabled={savingAccount} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                          <Plus size={16} /> {savingAccount ? 'Se salvează...' : selectedAccountId ? 'Actualizează contul' : 'Adaugă contul'}
                        </button>
                      </form>
                    </div>
                  )}
              </div>
            )}
          </section>
        )}
      </main>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function formatArrayValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : 'Nespecificate';
  }

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return 'Nespecificate';
}

function InfoLine({ label, value }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
      <Icon size={16} /> {label}
    </button>
  );
}

function MiniActionCard({ title, text, icon: Icon, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left text-white transition-transform hover:-translate-y-0.5 hover:bg-white/10">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-blue-300"><Icon size={18} /></div>
      <div className="mt-4 text-lg font-bold">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/65">{text}</div>
    </button>
  );
}

function TextField({ label, value, onChange, placeholder, type = 'text', disabled = false, icon: Icon }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <div className="relative">
        {Icon && <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100 ${Icon ? 'pl-10' : ''}`}
        />
      </div>
    </label>
  );
}

function TextAreaField({ label, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-[110px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-300 bg-white px-4 py-3">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
    </label>
  );
}

function Th({ children }) {
  return <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-500">{children}</th>;
}

function Td({ children, className = '' }) {
  return <td className={`border-b border-slate-100 px-4 py-4 align-top text-slate-700 ${className}`}>{children}</td>;
}

function ActionButton({ label, onClick, danger = false, icon: Icon }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] ${danger ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
}