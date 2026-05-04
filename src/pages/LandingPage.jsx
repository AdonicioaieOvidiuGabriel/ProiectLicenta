import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="w-full bg-neutral-100 flex flex-col">
      {/* Container principal full-width */}
      <div className="w-full bg-neutral-100 flex flex-col relative pt-24">
        
        {/* Navbar */}
        <div className={`fixed top-0 left-0 w-full px-4 md:px-20 z-50 transition-all duration-300 border-b border-blue-300/20 ${
            isScrolled 
            ? 'bg-slate-900/95 shadow-lg backdrop-blur-sm' 
            : 'bg-slate-800 shadow-sm'
        }`}>
          <div className="w-full h-24 flex justify-between items-center relative">
            
            {/* Left Side: Logo & Text */}
            <div className="flex items-center gap-4 z-10">
              <div className="flex flex-col">
                  <span className="text-white text-2xl font-black tracking-tight leading-none">LICENTA<span className="text-blue-300">CONNECT</span></span>
                  <span className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mt-1">Universitatea Ștefan cel Mare</span>
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
            <div className="flex items-center gap-8 z-10">
              <nav className="hidden md:flex gap-8">
                <a href="#" className="text-white text-sm font-medium font-serif hover:text-blue-300 transition-colors">Acasă</a>
                <a href="#" className="text-white text-sm font-medium font-serif hover:text-blue-300 transition-colors">Despre</a>
                <a href="#" className="text-white text-sm font-medium font-serif hover:text-blue-300 transition-colors">Facultăți</a>
                <a href="#" className="text-white text-sm font-medium font-serif hover:text-blue-300 transition-colors">Contact</a>
              </nav>
              
              <Link to="/quiz" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 transition-all rounded-sm shadow-sm flex items-center gap-2 group">
                <div className="w-3.5 h-3.5 bg-white rounded-full opacity-80 group-hover:opacity-100 transition-opacity animate-pulse" />
                <span className="text-white text-sm font-bold font-serif tracking-tight">Alege Tema</span>
              </Link>
            </div>

          </div>
        </div>

        {/* Hero Section */}
        <div className="relative w-full bg-slate-800 border-b border-gray-200 overflow-hidden">
          {/* Background Gradient & Overlay */}
          <div className="absolute inset-0 z-0">
             <img src="/assets/usv_imagine.jpg" className="w-full h-full object-cover opacity-40 mix-blend-overlay" alt="USV Campus" />
             <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-800/80"></div>
          </div>

          <div className="relative z-10 px-4 md:px-20 py-28 max-w-[800px]">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-300/10 rounded-sm border-l-2 border-blue-400 backdrop-blur-sm mb-6">
              <div className="w-2 h-2 bg-blue-300 rounded-full animate-pulse" />
              <span className="text-blue-300 text-xs font-bold font-serif uppercase tracking-wide">Portal Oficial USV</span>
            </div>

            {/* Typography */}
            <div className="flex flex-col mb-8">
              <h1 className="text-white text-4xl md:text-5xl font-bold font-serif leading-tight">
                Platforma Instituțională <br/>pentru
              </h1>
              <div className="pt-2 pb-3 border-b border-blue-500/30 inline-block w-max">
                <h2 className="text-blue-300 text-4xl md:text-5xl font-bold font-serif leading-tight">
                  Gestionarea Lucrărilor de<br/>Licență
                </h2>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-300 text-lg md:text-xl font-light leading-relaxed mb-12 max-w-2xl">
              LicentaConnect oferă studenților și profesorilor Universității "Ștefan cel
              Mare" un mediu centralizat pentru coordonarea, elaborarea și evaluarea
              tezelor academice.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/quiz" className="px-8 py-3.5 bg-blue-600 rounded-sm shadow-lg hover:bg-blue-700 hover:shadow-blue-900/20 transition-all flex items-center justify-center gap-3 group">
                <span className="text-white text-lg font-bold font-serif tracking-wide">Alege Tema</span>
                <span className="material-icons text-white group-hover:rotate-12 transition-transform">school</span>
              </Link>
              <a href="#" className="px-8 py-3.5 rounded-sm border border-gray-500 hover:bg-white/5 transition-colors flex justify-center items-center">
                <span className="text-white text-lg font-bold font-serif tracking-wide">Ghid de Utilizare</span>
              </a>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="px-4 md:px-14 py-20 bg-neutral-100">
          <div className="max-w-[1170px] mx-auto flex flex-col gap-12">
            
            {/* Section Header */}
            <div className="flex flex-col items-center gap-3 text-center">
              <h3 className="text-slate-800 text-3xl font-bold font-serif">Facilități Principale</h3>
              <div className="w-20 h-0.5 bg-blue-300" />
              <p className="text-slate-600 text-base max-w-2xl">
                Instrumente digitale avansate pentru excelență academică și eficiență administrativă.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-white p-8 rounded-sm shadow-sm border border-gray-200 hover:-translate-y-1 transition-transform duration-300 group">
                <div className="w-14 h-14 bg-slate-800/5 rounded-xl flex justify-center items-center mb-6 group-hover:bg-slate-800 transition-colors">
                    <span className="material-icons text-slate-800 group-hover:text-white transition-colors">school</span>
                </div>
                <h4 className="text-slate-800 text-xl font-bold font-serif mb-4">Profil Academic</h4>
                <p className="text-slate-600 text-sm leading-6">
                  Vizualizarea detaliată a situației școlare, a istoricului academic și gestionarea documentelor necesare înscrierii la examenul de licență.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white p-8 rounded-sm shadow-sm border border-gray-200 hover:-translate-y-1 transition-transform duration-300 group">
                <div className="w-14 h-14 bg-slate-800/5 rounded-xl flex justify-center items-center mb-6 group-hover:bg-slate-800 transition-colors">
                    <span className="material-icons text-slate-800 group-hover:text-white transition-colors">psychology</span>
                </div>
                <h4 className="text-slate-800 text-xl font-bold font-serif mb-4">Recomandare IA</h4>
                <p className="text-slate-600 text-sm leading-6">
                  Modul inteligent care analizează interesele de cercetare și performanțele anterioare pentru a sugera teme de licență relevante și inovatoare.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white p-8 rounded-sm shadow-sm border border-gray-200 hover:-translate-y-1 transition-transform duration-300 group">
                <div className="w-14 h-14 bg-slate-800/5 rounded-xl flex justify-center items-center mb-6 group-hover:bg-slate-800 transition-colors">
                    <span className="material-icons text-slate-800 group-hover:text-white transition-colors">assignment_ind</span>
                </div>
                <h4 className="text-slate-800 text-xl font-bold font-serif mb-4">Contact Coordonator</h4>
                <p className="text-slate-600 text-sm leading-6">
                  Platformă integrată pentru programarea întâlnirilor de consultanță și comunicarea directă, securizată cu profesorii coordonatori.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Steps Section */}
        <div className="px-4 md:px-20 py-20 bg-white border-t border-b border-gray-200">
           <div className="flex flex-col lg:flex-row gap-16 items-center">
             
             {/* Left List */}
             <div className="flex-1 flex flex-col gap-8">
                <div className="relative mb-4">
                  <div className="absolute -left-4 -top-4 w-24 h-24 bg-blue-300/10 rounded-xl blur-md" />
                  <h3 className="text-slate-800 text-2xl font-bold font-serif relative z-10">Etapele procesului de licență</h3>
                </div>

                <div className="flex flex-col gap-8">
                  {[
                    {id: 1, title: "Alegerea Temei", desc: "Selectarea unei teme din lista propusă sau propunerea unei teme proprii."},
                    {id: 2, title: "Validarea de către Coordonator", desc: "Obținerea acordului profesorului coordonator prin intermediul platformei."},
                    {id: 3, title: "Elaborarea Lucrării", desc: "Încărcarea etapizată a capitolelor și primirea feedback-ului."},
                    {id: 4, title: "Susținerea Examenului", desc: "Generarea fișei de înscriere și programarea susținerii."}
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
                   "Educația este cea mai puternică armă pe care o poți folosi pentru a schimba lumea."
                 </p>
               </div>
             </div>

           </div>
        </div>

        {/* Footer */}
        <footer className="w-full px-4 md:px-14 pt-16 pb-8 bg-slate-800 border-t border-blue-300 flex flex-col mt-auto">
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
                   Strada Universității 13,<br/>Suceava, 720229, România
                 </div>
                 <div className="flex gap-4">
                    <a href="#" className="w-8 h-8 bg-white/10 rounded-sm flex items-center justify-center hover:bg-blue-500 transition-colors">
                        <img src="/assets/world.svg" alt="Website" className="w-4 h-4 opacity-70 hover:opacity-100" />
                    </a>
                    <a href="#" className="w-8 h-8 bg-white/10 rounded-sm flex items-center justify-center hover:bg-blue-500 transition-colors">
                        <img src="/assets/phone_gray.svg" alt="Phone" className="w-4 h-4 opacity-70 hover:opacity-100" />
                    </a>
                    <a href="#" className="w-8 h-8 bg-white/10 rounded-sm flex items-center justify-center hover:bg-blue-500 transition-colors">
                        <img src="/assets/email_gray.svg" alt="Email" className="w-4 h-4 opacity-70 hover:opacity-100" />
                    </a>
                 </div>
              </div>

              {/* Col 2: Studenți */}
              <div className="flex flex-col gap-6">
                <h4 className="text-blue-300 text-sm font-bold font-serif uppercase tracking-wider">Studenți</h4>
                <div className="flex flex-col gap-3">
                  <a href="#" className="text-gray-300 text-sm hover:text-white transition-colors">Avizier Virtual</a>
                  <a href="#" className="text-gray-300 text-sm hover:text-white transition-colors">Orar Studenți</a>
                  <a href="#" className="text-gray-300 text-sm hover:text-white transition-colors">Taxe și Plăți</a>
                  <a href="#" className="text-gray-300 text-sm hover:text-white transition-colors">Bibliotecă</a>
                  <a href="#" className="text-gray-300 text-sm hover:text-white transition-colors">Cazare Cămin</a>
                </div>
              </div>

              {/* Col 3: Candidați */}
               <div className="flex flex-col gap-6">
                <h4 className="text-blue-300 text-sm font-bold font-serif uppercase tracking-wider">Candidați</h4>
                <div className="flex flex-col gap-3">
                  <a href="#" className="text-gray-300 text-sm hover:text-white transition-colors">Admitere 2026</a>
                  <a href="#" className="text-gray-300 text-sm hover:text-white transition-colors">Oferta Educațională</a>
                  <a href="#" className="text-gray-300 text-sm hover:text-white transition-colors">Ghidul Candidatului</a>
                  <a href="#" className="text-gray-300 text-sm hover:text-white transition-colors">Campus Virtual</a>
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
                       <a href="#" className="underline decoration-blue-300/30 hover:decoration-blue-300">Centrul de Suport IT</a>
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
                <a href="#" className="hover:text-gray-300 transition-colors">Confidențialitate</a>
                <a href="#" className="hover:text-gray-300 transition-colors">Termeni și Condiții</a>
                <a href="#" className="hover:text-gray-300 transition-colors">Politica Cookie</a>
              </div>
            </div>

          </div>
        </footer>

      </div>
    </div>
  );
}
