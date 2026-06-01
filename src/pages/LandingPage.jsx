import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleUserRound } from 'lucide-react';
import AuthModal from '../components/AuthModal';
import QuizAccessModal from '../components/QuizAccessModal';
import AccountBadge from '../components/AccountBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import ResetPasswordModal from '../components/ResetPasswordModal';
import { clearAuthSession, readAuthSession, writeAuthSession } from '../utils/authSession';

export default function LandingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isScrolled, setIsScrolled] = useState(false);
  const [authAccount, setAuthAccount] = useState(() => readAuthSession());
  const [authMode, setAuthMode] = useState(null);
  const [quizAccessOpen, setQuizAccessOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const navigate = useNavigate();

  const resetTokenFromQuery = searchParams.get('token') || '';
  const resetEmailFromQuery = searchParams.get('email') || '';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (resetTokenFromQuery) {
      setResetModalOpen(true);
    }
  }, [resetTokenFromQuery]);

  const handleAuthSuccess = (account) => {
    setAuthAccount(account);
    writeAuthSession(account);
  };

  const handleLogout = () => {
    setAuthAccount(null);
    clearAuthSession();
  };

  const handleRequestLogout = () => setLogoutConfirmOpen(true);

  const handleCloseResetModal = () => {
    setResetModalOpen(false);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('email');
    nextParams.delete('token');
    nextParams.delete('reset');
    setSearchParams(nextParams, { replace: true });
  };

  const handleStartQuiz = () => {
    if (authAccount) {
      navigate('/quiz');
      return;
    }

    setQuizAccessOpen(true);
  };

  return (
    <div className="w-full bg-neutral-100 flex flex-col">
      {/* Container principal full-width */}
      <div className="w-full bg-neutral-100 flex flex-col relative pt-20 md:pt-24">
        
        {/* Navbar */}
        <div className={`fixed top-0 left-0 w-full px-4 md:px-20 z-50 transition-all duration-300 border-b border-blue-300/20 ${
            isScrolled 
          ? 'bg-slate-900/95 shadow-lg backdrop-blur-sm' 
          : 'bg-slate-900/95 shadow-sm'
        }`}>
          <div className="w-full h-20 md:h-24 flex justify-between items-center relative">
            
            {/* Left Side: Logo & Text */}
            <div className="flex items-center gap-4 z-10">
              <div className="flex flex-col">
                  <span className="text-white text-lg sm:text-2xl font-black tracking-tight leading-none">LICENTA<span className="text-blue-300">CONNECT</span></span>
                  <span className="text-white/60 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-1">Universitatea Ștefan cel Mare</span>
              </div>
            </div>

            {/* Center: Icon */}
            <div className="absolute left-1/2 top-0 -translate-x-1/2 z-[100] pointer-events-none">
                {/* icon.svg mare - vizibil doar când NU e scrolled */}
                <img 
                    src="/assets/icon.svg" 
                    alt="USV Emblem" 
                  className={`drop-shadow-2xl transition-opacity duration-300 w-[64px] md:w-[96px] lg:w-[128px] h-auto ${
                        isScrolled ? 'opacity-0' : 'opacity-100'
                    }`}
                    onError={(e) => {
                        e.target.style.display = 'none';
                    }}
                />
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[40%] z-[100] pointer-events-none">
                {/* icon_mini.svg - vizibil doar când e scrolled */}
                <img 
                    src="/assets/icon_mini.svg" 
                    alt="USV Emblem" 
                    className={`drop-shadow-2xl transition-opacity duration-300 w-28 h-auto ${
                        isScrolled ? 'opacity-100' : 'opacity-0'
                    }`}
                    onError={(e) => {
                        e.target.style.display = 'none';
                    }}
                />
            </div>

            {/* Right Side: Navigation */}
            <div className="flex items-center gap-3 xl:gap-5 z-10">
              <nav className="hidden lg:flex gap-6 xl:gap-8">
                <a href="#home" className="text-white text-sm font-medium font-serif hover:text-blue-300 transition-colors">Acasă</a>
                <a href="https://usv.ro/facultati/" target="_blank" rel="noopener noreferrer" className="text-white text-sm font-medium font-serif hover:text-blue-300 transition-colors">Facultăți</a>
                <a href="#contact" className="text-white text-sm font-medium font-serif hover:text-blue-300 transition-colors">Contact</a>
                <Link to="/teme" className="text-white text-sm font-medium font-serif hover:text-blue-300 transition-colors">Vezi temele</Link>
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

        <ResetPasswordModal
          isOpen={resetModalOpen}
          initialEmail={resetEmailFromQuery}
          token={resetTokenFromQuery}
          onClose={handleCloseResetModal}
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

        {/* Hero Section */}
        <div id="home" className="relative w-full bg-slate-800 border-b border-gray-200 overflow-hidden">
          {/* Background Gradient & Overlay */}
          <div className="absolute inset-0 z-0">
             <img src="/assets/usv_imagine.jpg" className="w-full h-full object-cover opacity-40 mix-blend-overlay" alt="USV Campus" />
             <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-800/80"></div>
          </div>

          <div className="relative z-10 px-4 md:px-20 py-16 md:py-24 max-w-[1180px] mx-auto">
            {/* Typography */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-end">
              <div className="flex flex-col items-start max-w-2xl">
                <h1 className="text-white text-3xl sm:text-4xl md:text-5xl font-bold font-serif leading-tight text-left max-w-2xl">
                  Găsești tema potrivită <br/>în câțiva pași
                </h1>
                <div className="pt-2 pb-3 border-b border-blue-500/30 inline-block w-max self-start">
                  <h2 className="text-blue-300 text-3xl sm:text-4xl md:text-5xl font-bold font-serif leading-tight text-left">
                    pentru lucrarea de licență
                  </h2>
                </div>

                {/* Description */}
                <p className="text-gray-300 text-base sm:text-lg md:text-xl font-light leading-relaxed mt-5 md:mt-6 max-w-xl text-left">
                  LicentaConnect te ajută să completezi profilul academic, să primești recomandări AI de teme și să trimiți profesorului un email generat automat, cu datele tale reale.
                </p>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-1 gap-4 lg:max-w-[280px] lg:ml-auto w-full">
                <button type="button" onClick={handleStartQuiz} className="w-full px-7 py-3.5 bg-blue-600 rounded-sm shadow-lg hover:bg-blue-700 hover:shadow-blue-900/20 transition-all flex items-center justify-center gap-3 group whitespace-nowrap">
                  <span className="text-white text-base font-bold font-serif tracking-wide">Începe chestionarul</span>
                </button>
                <a href="#workflow" className="w-full px-7 py-3.5 rounded-sm border border-gray-500 hover:bg-white/5 transition-colors flex justify-center items-center whitespace-nowrap">
                  <span className="text-white text-base font-bold font-serif tracking-wide">Cum funcționează</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="px-4 md:px-14 py-20 bg-neutral-100">
          <div className="max-w-[1170px] mx-auto flex flex-col gap-12">
            
            {/* Section Header */}
            <div className="flex flex-col items-center gap-3 text-center">
              <h3 className="text-slate-800 text-3xl font-bold font-serif">Ce face aplicația</h3>
              <div className="w-20 h-0.5 bg-blue-300" />
              <p className="text-slate-600 text-base max-w-2xl">
                Fluxul este construit în jurul unui chestionar academic, al recomandărilor generate de AI și al emailului trimis către profesorul coordonator.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-white p-8 rounded-sm shadow-sm border border-gray-200 hover:-translate-y-1 transition-transform duration-300 group">
                <div className="w-14 h-14 bg-slate-800/5 rounded-xl flex justify-center items-center mb-6 group-hover:bg-slate-800 transition-colors">
                    <span className="material-icons text-slate-800 group-hover:text-white transition-colors">school</span>
                </div>
                <h4 className="text-slate-800 text-xl font-bold font-serif mb-4">Chestionar academic</h4>
                <p className="text-slate-600 text-sm leading-6">
                  Completezi nivelul de studii, facultatea, specializarea, competențele, domeniul de interes și tipul de proiect dorit.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white p-8 rounded-sm shadow-sm border border-gray-200 hover:-translate-y-1 transition-transform duration-300 group">
                <div className="w-14 h-14 bg-slate-800/5 rounded-xl flex justify-center items-center mb-6 group-hover:bg-slate-800 transition-colors">
                    <span className="material-icons text-slate-800 group-hover:text-white transition-colors">psychology</span>
                </div>
                <h4 className="text-slate-800 text-xl font-bold font-serif mb-4">Recomandări AI</h4>
                <p className="text-slate-600 text-sm leading-6">
                  Primești teme ordonate după potrivire, cu explicații generate de AI și paginare doar atunci când există recomandări noi.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white p-8 rounded-sm shadow-sm border border-gray-200 hover:-translate-y-1 transition-transform duration-300 group">
                <div className="w-14 h-14 bg-slate-800/5 rounded-xl flex justify-center items-center mb-6 group-hover:bg-slate-800 transition-colors">
                    <span className="material-icons text-slate-800 group-hover:text-white transition-colors">assignment_ind</span>
                </div>
                <h4 className="text-slate-800 text-xl font-bold font-serif mb-4">Contact Coordonator</h4>
                <p className="text-slate-600 text-sm leading-6">
                  Generezi emailul, îl editezi dacă vrei, apoi îl trimiți profesorului cu subiectul și Reply-To corecte.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Steps Section */}
        <div id="workflow" className="px-4 md:px-20 py-20 bg-white border-t border-b border-gray-200">
           <div className="flex flex-col lg:flex-row gap-16 items-center">
             
             {/* Left List */}
             <div className="flex-1 flex flex-col gap-8">
                <div className="relative mb-4">
                  <div className="absolute -left-4 -top-4 w-24 h-24 bg-blue-300/10 rounded-xl blur-md" />
                  <h3 className="text-slate-800 text-2xl font-bold font-serif relative z-10">Cum funcționează aplicația</h3>
                </div>

                <div className="flex flex-col gap-8">
                  {[
                    {id: 1, title: "Completezi profilul", desc: "Selectezi facultatea, specializarea, competențele și preferințele academice."},
                    {id: 2, title: "Primești teme recomandate", desc: "Algoritmul AI evaluează profilul și returnează teme potrivite pentru tine."},
                    {id: 3, title: "Deschizi emailul către profesor", desc: "Alegi o temă, introduci emailul profesorului și generezi textul mesajului."},
                    {id: 4, title: "Trimiți mesajul", desc: "Emailul pornește cu subject-ul corect și Reply-To setat pe adresa ta."}
                  ].map((step) => (
                    <div key={step.id} className="flex gap-6">
                      <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl font-serif font-bold ${step.id === 4 ? 'bg-white border border-slate-800 text-slate-800 shadow-sm' : 'bg-slate-800 text-white'}`}>
                        {step.id}
                      </div>
                      <div className="flex flex-col gap-1">
                        <h5 className="text-slate-900 text-lg font-bold font-serif">{step.title}</h5>
                        <p className="text-slate-600 text-sm">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
             </div>

             {/* Right Image/Quote */}
             <div className="flex-1 w-full max-w-[600px] h-[400px] relative rounded shadow-2xl overflow-hidden group">
               <img src="/assets/sv.jpg" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Process" />
               <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent">
                 <p className="text-white text-lg font-medium font-serif italic">
                   "Fluxul este simplu: completezi profilul, primești recomandări și scrii profesorului fără pași inutili."
                 </p>
               </div>
             </div>

           </div>
        </div>

        {/* Footer */}
        <footer id="contact" className="w-full px-4 md:px-14 pt-16 pb-8 bg-slate-800 border-t border-blue-300 flex flex-col mt-auto">
          <div className="max-w-[1170px] mx-auto w-full flex flex-col gap-12">
            
            {/* Columns */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
              
              {/* Col 1: Address */}
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

              {/* Col 2: Studenți */}
              <div className="flex flex-col gap-6">
                <h4 className="text-blue-300 text-sm font-bold font-serif uppercase tracking-wider">Studenți</h4>
                <div className="flex flex-col gap-3">
                  <Link to="/quiz" className="text-gray-300 text-sm hover:text-white transition-colors">Chestionar academic</Link>
                  <a href="#features" className="text-gray-300 text-sm hover:text-white transition-colors">Funcționalități</a>
                  <a href="#workflow" className="text-gray-300 text-sm hover:text-white transition-colors">Cum funcționează</a>
                  <a href="#contact" className="text-gray-300 text-sm hover:text-white transition-colors">Contact</a>
                </div>
              </div>

              {/* Col 3: Candidați */}
               <div className="flex flex-col gap-6">
                <h4 className="text-blue-300 text-sm font-bold font-serif uppercase tracking-wider">Candidați</h4>
                <div className="flex flex-col gap-3">
                    <a href="https://fiesc.usv.ro/" target="_blank" rel="noopener noreferrer" className="text-gray-300 text-sm hover:text-white transition-colors">FIESC USV</a>
                    <a href="https://usv.ro/" target="_blank" rel="noopener noreferrer" className="text-gray-300 text-sm hover:text-white transition-colors">USV</a>
                    <a href="#features" className="text-gray-300 text-sm hover:text-white transition-colors">Ce face aplicația</a>
                </div>
              </div>

              {/* Col 4: Contact */}
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
                        <a href="mailto:ovidiu.adonicioaie@student.usv.ro" className="break-all underline decoration-blue-300/30 hover:decoration-blue-300">ovidiu.adonicioaie@student.usv.ro</a>
                    </div>
                 </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="pt-8 border-t border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
              <p className="text-center md:text-left">
                © 2026 Universitatea "Ștefan cel Mare" din Suceava. Toate drepturile rezervate.<br/>
                Dezvoltat de Serviciul Comunicații și Tehnologia Informației.
              </p>
              <div className="flex gap-6">
                <a href="#features" className="hover:text-gray-300 transition-colors">Funcționalități</a>
                <a href="#workflow" className="hover:text-gray-300 transition-colors">Flux</a>
                <a href="#contact" className="hover:text-gray-300 transition-colors">Contact</a>
              </div>
            </div>

          </div>
        </footer>

      </div>
    </div>
  );
}
