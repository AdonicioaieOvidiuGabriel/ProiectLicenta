import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthModal from '../components/AuthModal';
import QuizAccessModal from '../components/QuizAccessModal';
import AccountBadge from '../components/AccountBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { clearAuthSession, readAuthSession, writeAuthSession } from '../utils/authSession';

const API_URL = 'http://localhost:3001/api/topics';

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const LEVEL_LABELS = {
  licenta: 'Licență',
  masterat: 'Masterat',
  disertatie: 'Masterat',
  conversie: 'Conversie profesională'
};

export default function TopicsBrowserPage() {
  const [topics, setTopics] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedSpecialization, setSelectedSpecialization] = useState('all');
  const [authAccount, setAuthAccount] = useState(() => readAuthSession());
  const [authMode, setAuthMode] = useState(null);
  const [quizAccessOpen, setQuizAccessOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAuthSuccess = (account) => {
    setAuthAccount(account);
    writeAuthSession(account);
  };

  const handleLogout = () => {
    setAuthAccount(null);
    clearAuthSession();
  };

  const handleRequestLogout = () => setLogoutConfirmOpen(true);

  const handleStartQuiz = () => {
    if (authAccount) {
      navigate('/quiz');
      return;
    }

    setQuizAccessOpen(true);
  };

  useEffect(() => {
    const loadTopics = async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await fetch(API_URL);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.details || data?.error || `HTTP ${response.status}`);
        }

        setTopics(Array.isArray(data.topics) ? data.topics : []);
      } catch (err) {
        setError(err.message || 'Nu am putut încărca temele.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTopics();
  }, []);

  const facultyOptions = useMemo(() => {
    const values = Array.from(new Set(topics.map((topic) => topic.facultatea).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [topics]);

  const levelOptions = useMemo(() => {
    const values = Array.from(new Set(topics.map((topic) => topic.nivel_studii).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [topics]);

  const specializationOptions = useMemo(() => {
    const values = new Set();
    topics.forEach((topic) => {
      const specializations = Array.isArray(topic.specializari) ? topic.specializari : [];
      specializations.forEach((specialization) => values.add(specialization));
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [topics]);

  const filteredTopics = useMemo(() => {
    const query = normalizeText(search);

    return topics.filter((topic) => {
      const facultyMatch = selectedFaculty === 'all' || topic.facultatea === selectedFaculty;
      const levelMatch = selectedLevel === 'all' || topic.nivel_studii === selectedLevel;
      const specializationMatch =
        selectedSpecialization === 'all' ||
        (Array.isArray(topic.specializari) && topic.specializari.includes(selectedSpecialization));

      const haystack = normalizeText([
        topic.id,
        topic.facultatea,
        topic.profesor,
        topic.nivel_studii,
        topic.titlu_tema,
        ...(Array.isArray(topic.specializari) ? topic.specializari : [])
      ].join(' '));

      const searchMatch = !query || haystack.includes(query);

      return facultyMatch && levelMatch && specializationMatch && searchMatch;
    });
  }, [topics, search, selectedFaculty, selectedLevel, selectedSpecialization]);

  const activeFiltersCount = [selectedFaculty, selectedLevel, selectedSpecialization].filter((value) => value !== 'all').length + (search.trim() ? 1 : 0);

  const clearFilters = () => {
    setSearch('');
    setSelectedFaculty('all');
    setSelectedLevel('all');
    setSelectedSpecialization('all');
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-slate-900">
      <div className="fixed top-0 left-0 w-full px-4 md:px-20 z-50 bg-slate-900/95 shadow-lg backdrop-blur-sm border-b border-blue-300/20">
        <div className="w-full h-24 flex justify-between items-center relative">
          <div className="flex items-center gap-4 z-10">
            <Link to="/" className="flex flex-col group">
              <span className="text-white text-2xl font-black tracking-tight leading-none">LICENTA<span className="text-blue-300">CONNECT</span></span>
              <span className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mt-1">Universitatea Ștefan cel Mare</span>
            </Link>
          </div>

          <div className="absolute left-1/2 top-0 -translate-x-1/2 z-[100] pointer-events-none">
            <img
              src="/assets/icon.svg"
              alt="USV Emblem"
              className={`drop-shadow-2xl transition-opacity duration-300 w-[64px] md:w-[96px] lg:w-[128px] h-auto ${
                isScrolled ? 'opacity-0' : 'opacity-100'
              }`}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[40%] z-[100] pointer-events-none">
            <img
              src="/assets/icon_mini.svg"
              alt="USV Emblem"
              className={`drop-shadow-2xl transition-opacity duration-300 w-28 h-auto ${
                isScrolled ? 'opacity-100' : 'opacity-0'
              }`}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>

          <div className="flex items-center gap-4 z-10">
            <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
              <Link to="/" className="text-white text-sm font-medium font-serif hover:text-blue-300 transition-colors">
                Acasă
              </Link>
              <a
                href="https://usv.ro/facultati/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white text-sm font-medium font-serif hover:text-blue-300 transition-colors"
              >
                Facultăți
              </a>
              <a href="#contact" className="text-white text-sm font-medium font-serif hover:text-blue-300 transition-colors">
                Contact
              </a>
            </nav>
            {authAccount ? (
                <AccountBadge account={authAccount} onClick={() => navigate('/contul-meu')} onLogout={handleRequestLogout} />
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="px-4 py-2 rounded-sm border border-white/20 text-white text-sm font-bold font-serif tracking-tight hover:bg-white/5 hover:border-blue-300/60 transition-colors"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className="px-4 py-2 rounded-sm bg-blue-600 text-white text-sm font-bold font-serif tracking-tight hover:bg-blue-700 transition-colors"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={Boolean(authMode)}
        mode={authMode || 'login'}
        onClose={() => setAuthMode(null)}
        onSwitchMode={(nextMode) => setAuthMode(nextMode)}
        onAuthSuccess={handleAuthSuccess}
      />

      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        title="Vrei să te deconectezi?"
        description="Dacă ieși acum, va trebui să te autentifici din nou pentru a accesa contul și datele tale."
        confirmLabel="Da, deconectează-mă"
        cancelLabel="Rămân conectat"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          handleLogout();
        }}
      />

      <QuizAccessModal
        isOpen={quizAccessOpen}
        onClose={() => setQuizAccessOpen(false)}
        onLogin={() => {
          setQuizAccessOpen(false);
          setAuthMode('login');
        }}
        onSignup={() => {
          setQuizAccessOpen(false);
          setAuthMode('signup');
        }}
        onContinue={() => {
          setQuizAccessOpen(false);
          navigate('/quiz');
        }}
      />

      <main className="pt-24">
        <section className="relative overflow-hidden bg-slate-800 border-b border-gray-200">
          <div className="absolute inset-0 z-0">
            <img src="/assets/usv-front_0.jpg" className="w-full h-full object-cover opacity-40 mix-blend-overlay" alt="USV Campus" />
            <div className="absolute inset-0 bg-blue-950/25 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/92 to-slate-800/85" />
          </div>

          <div className="relative z-10 px-4 md:px-20 py-16 md:py-24 max-w-[1180px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
              <div className="flex flex-col items-start max-w-2xl">
                <h1 className="text-white text-3xl sm:text-4xl md:text-5xl font-bold font-serif leading-tight max-w-2xl">
                  Toate temele din baza de date, într-o singură pagină
                </h1>
                <p className="text-gray-300 text-sm sm:text-base md:text-lg font-light leading-relaxed mt-4 max-w-xl">
                  Caută rapid după titlu, profesor, facultate, nivel de studii sau specializare și vezi exact ce este disponibil în sistem.
                </p>
              </div>

              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-[320px] rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md shadow-[0_24px_80px_rgba(15,23,42,0.28)] p-6 md:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-blue-300 text-xs font-bold uppercase tracking-[0.18em]">Total teme</div>
                      <div className="text-white text-4xl md:text-5xl font-black mt-2 leading-none">{topics.length}</div>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-blue-300/10 border border-blue-300/20 flex items-center justify-center">
                      <span className="material-icons text-blue-300 text-2xl">menu_book</span>
                    </div>
                  </div>

                  <div className="mt-6 h-px w-full bg-white/10" />

                  <p className="mt-4 text-sm text-gray-300 leading-6">
                    Temele sunt afișate curat, cu filtre rapide și căutare directă.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 md:px-20 py-10 md:py-14">
          <div className="max-w-[1280px] mx-auto">
            <div className="bg-white border border-gray-200 shadow-[0_20px_60px_rgba(15,23,42,0.08)] rounded-sm overflow-hidden">
              <div className="p-5 md:p-6 border-b border-gray-200 bg-slate-50/90">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-slate-900 text-2xl font-bold font-serif">Filtrează temele</h2>
                    <p className="text-slate-600 text-sm mt-1">Folosește căutarea și filtrele pentru a restrânge rezultatele în timp real.</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button onClick={clearFilters} className="px-4 py-2 rounded-sm border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors text-sm font-semibold">
                      Resetează filtrele
                    </button>
                    <button type="button" onClick={handleStartQuiz} className="px-4 py-2 rounded-sm bg-slate-900 text-white hover:bg-slate-800 transition-colors text-sm font-semibold">
                      Mergi la chestionar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-5">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Căutare</span>
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Caută după profesor, titlu sau specializare"
                      className="w-full rounded-sm border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Facultate</span>
                    <select
                      value={selectedFaculty}
                      onChange={(event) => setSelectedFaculty(event.target.value)}
                      className="w-full rounded-sm border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="all">Toate facultățile</option>
                      {facultyOptions.map((faculty) => (
                        <option key={faculty} value={faculty}>{faculty}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Nivel de studii</span>
                    <select
                      value={selectedLevel}
                      onChange={(event) => setSelectedLevel(event.target.value)}
                      className="w-full rounded-sm border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="all">Toate nivelurile</option>
                      {levelOptions.map((level) => (
                        <option key={level} value={level}>{LEVEL_LABELS[level.toLowerCase()] || level}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Specializare</span>
                    <select
                      value={selectedSpecialization}
                      onChange={(event) => setSelectedSpecialization(event.target.value)}
                      className="w-full rounded-sm border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="all">Toate specializările</option>
                      {specializationOptions.map((specialization) => (
                        <option key={specialization} value={specialization}>{specialization}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="p-5 md:p-6">
                {isLoading ? (
                  <div className="py-16 text-center text-slate-600">
                    Se încarcă temele din baza de date...
                  </div>
                ) : error ? (
                  <div className="rounded-sm border border-red-200 bg-red-50 p-5 text-red-700">
                    {error}
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span>
                        Rezultate afișate: <span className="font-bold text-slate-900">{filteredTopics.length}</span>
                      </span>
                      <span>
                        Baza de date: <span className="font-bold text-slate-900">{topics.length}</span> teme
                      </span>
                    </div>

                    <div className="overflow-auto rounded-sm border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-left">
                        <thead className="sticky top-0 bg-slate-900 text-white">
                          <tr>
                            <th className="px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold uppercase tracking-[0.14em]">Profesor</th>
                            <th className="px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold uppercase tracking-[0.14em]">Facultate</th>
                            <th className="px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold uppercase tracking-[0.14em]">Nivel</th>
                            <th className="px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold uppercase tracking-[0.14em]">Specializări</th>
                            <th className="px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold uppercase tracking-[0.14em]">Tema</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredTopics.map((topic) => {
                            const specializari = Array.isArray(topic.specializari) ? topic.specializari : [];
                            return (
                              <tr key={topic.id} className="hover:bg-slate-50/70 align-top">
                                <td className="px-3 md:px-4 py-4 text-sm text-slate-700 min-w-[180px] md:min-w-[220px]">{topic.profesor}</td>
                                <td className="px-3 md:px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{topic.facultatea}</td>
                                <td className="px-3 md:px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{topic.nivel_studii}</td>
                                <td className="px-3 md:px-4 py-4 min-w-[180px] md:min-w-[240px]">
                                  {specializari.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {specializari.map((specialization) => (
                                        <span key={specialization} className="inline-flex max-w-full items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-center text-[11px] md:text-xs font-semibold text-blue-800 break-words whitespace-normal">
                                          {specialization}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] md:text-xs font-semibold text-slate-600 border border-slate-200">
                                      Toate specializările
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 md:px-4 py-4 text-sm text-slate-700 min-w-[220px] md:min-w-[300px] leading-6">
                                  {topic.titlu_tema}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredTopics.length === 0 && (
                            <tr>
                              <td colSpan="5" className="px-4 py-12 text-center text-slate-500">
                                Nu am găsit teme care să corespundă filtrelor curente.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="w-full px-4 md:px-14 pt-16 pb-8 bg-slate-800 border-t border-blue-300 flex flex-col mt-auto">
        <div className="max-w-[1170px] mx-auto w-full flex flex-col gap-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="flex flex-col gap-6 relative">
              <div className="flex items-center gap-3">
                <img src="/assets/logo.svg" className="w-8 h-8 object-contain" alt="Logo Footer" />
                <span className="text-white text-lg font-bold font-serif uppercase tracking-wide">USV Suceava</span>
              </div>
              <div className="text-gray-400 text-sm leading-6">
                LicentaConnect este o platformă pentru recomandarea temelor de licență și contactarea profesorilor coordonatori.
              </div>
              <div className="flex gap-4">
                <a href="https://usv.ro/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-white/10 rounded-sm flex items-center justify-center hover:bg-blue-500 transition-colors">
                  <img src="/assets/world.svg" alt="Website" className="w-4 h-4 opacity-70 hover:opacity-100" />
                </a>
                <a href="tel:+40230522978" className="w-8 h-8 bg-white/10 rounded-sm flex items-center justify-center hover:bg-blue-500 transition-colors">
                  <img src="/assets/phone_gray.svg" alt="Phone" className="w-4 h-4 opacity-70 hover:opacity-100" />
                </a>
                <a href="mailto:ovidiu.adonicioaie@student.usv.ro" className="w-8 h-8 bg-white/10 rounded-sm flex items-center justify-center hover:bg-blue-500 transition-colors">
                  <img src="/assets/email_gray.svg" alt="Email" className="w-4 h-4 opacity-70 hover:opacity-100" />
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <h4 className="text-blue-300 text-sm font-bold font-serif uppercase tracking-wider">Studenți</h4>
              <div className="flex flex-col gap-3">
                <Link to="/quiz" className="text-gray-300 text-sm hover:text-white transition-colors">Chestionar academic</Link>
                <a href="#features" className="text-gray-300 text-sm hover:text-white transition-colors">Funcționalități</a>
                <a href="#contact" className="text-gray-300 text-sm hover:text-white transition-colors">Contact</a>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <h4 className="text-blue-300 text-sm font-bold font-serif uppercase tracking-wider">Candidați</h4>
              <div className="flex flex-col gap-3">
                <a href="https://fiesc.usv.ro/" target="_blank" rel="noopener noreferrer" className="text-gray-300 text-sm hover:text-white transition-colors">FIESC USV</a>
                <a href="https://usv.ro/" target="_blank" rel="noopener noreferrer" className="text-gray-300 text-sm hover:text-white transition-colors">USV</a>
                <a href="#features" className="text-gray-300 text-sm hover:text-white transition-colors">Ce face aplicația</a>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <h4 className="text-blue-300 text-sm font-bold font-serif uppercase tracking-wider">Contact & Suport</h4>
              <div className="flex flex-col gap-3 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <img src="/assets/phone_blue.svg" alt="Phone" className="w-4 h-4" />
                  <span>+40 230 522 978</span>
                </div>
                <div className="flex items-center gap-2">
                  <img src="/assets/email_blue.svg" alt="Email" className="w-4 h-4" />
                  <span>rectorat@usv.ro</span>
                </div>
                <div className="flex items-center gap-2">
                  <img src="/assets/questionmark.svg" alt="Support" className="w-4 h-4" />
                  <a href="mailto:ovidiu.adonicioaie@student.usv.ro" className="underline decoration-blue-300/30 hover:decoration-blue-300">ovidiu.adonicioaie@student.usv.ro</a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
            <p className="text-center md:text-left">
              © 2026 Universitatea "Ștefan cel Mare" din Suceava. Toate drepturile rezervate.<br />
              Dezvoltat de Serviciul Comunicații și Tehnologia Informației.
            </p>
            <div className="flex gap-6">
              <a href="#features" className="hover:text-gray-300 transition-colors">Funcționalități</a>
              <a href="#top" className="hover:text-gray-300 transition-colors">Sus</a>
              <a href="#contact" className="hover:text-gray-300 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
