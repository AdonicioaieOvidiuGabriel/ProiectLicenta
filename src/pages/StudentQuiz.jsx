import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthModal from '../components/AuthModal';
import AccountBadge from '../components/AccountBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { FACULTY_LABELS, FACULTY_PROFILES } from '../data/facultyProfiles';
import { clearAuthSession, readAuthSession, writeAuthSession } from '../utils/authSession';

const FACULTY_QUIZ_CONFIG = FACULTY_PROFILES;

const STUDY_LEVEL_OPTIONS = [
  {
    value: 'licenta',
    title: 'Licență',
    subtitle: 'Program de licență',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 20.055a12.083 12.083 0 01-6.16-9.477L12 14z" />
      </svg>
    )
  },
  {
    value: 'disertatie',
    title: 'Disertație (Master)',
    subtitle: 'Program de masterat',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    )
  }
];

const SPECIALIZATION_META = {
  calculatoare: { label: 'Calculatoare (C)', value: 'Calculatoare' },
  'automatica si informatica aplicata': { label: 'Automatică și Informatică Aplicată (AIA)', value: 'Automatică și Informatică Aplicată' },
  'retele si software de telecomunicatii': { label: 'Rețele și Software de Telecomunicații (RST)', value: 'Rețele și Software de Telecomunicații' },
  'sisteme electrice': { label: 'Sisteme Electrice (SE)', value: 'Sisteme Electrice' },
  'energetica si tehnologii informatice': { label: 'Energetică și Tehnologii Informatice (ETI)', value: 'Energetică și Tehnologii Informatice' },
  'echipamente si sisteme medicale': { label: 'Echipamente și Sisteme Medicale (ESM)', value: 'Echipamente și Sisteme Medicale' },
  'echipamente si sisteme de comanda si control pentru autovehicule': { label: 'Echipamente și Sisteme de Comandă și Control pentru Autovehicule (ESCCA)', value: 'Echipamente și Sisteme de Comandă și Control pentru Autovehicule' },
  'managementul energiei': { label: 'Managementul Energiei (ME)', value: 'Managementul Energiei' },
  'stiinta si ingineria calculatoarelor': { label: 'Știința și Ingineria Calculatoarelor (SIC)', value: 'Știința și Ingineria Calculatoarelor' },
  'retele de comunicatii si calculatoare': { label: 'Rețele de Comunicații și Calculatoare (RCC)', value: 'Rețele de Comunicații și Calculatoare' },
  'securitate cibernetica': { label: 'Securitate Cibernetică (SC)', value: 'Securitate Cibernetică' },
  'sisteme moderne pentru conducerea proceselor energetice': { label: 'Sisteme Moderne pentru Conducerea Proceselor Energetice (SMCPE)', value: 'Sisteme Moderne pentru Conducerea Proceselor Energetice' },
  'tehnici avansate in masini si actionari electrice': { label: 'Tehnici Avansate în Mașini și Acționări Electrice (TAMAE)', value: 'Tehnici Avansate în Mașini și Acționări Electrice' }
  ,
  'tehnologia constructiilor de masini': { label: 'Tehnologia construcțiilor de maşini (TCM)', value: 'Tehnologia construcțiilor de maşini' },
  'inginerie mecanica': { label: 'Inginerie mecanică (IM)', value: 'Inginerie mecanică' },
  'mecatronica': { label: 'Mecatronică (MCT)', value: 'Mecatronică' },
  'robotica': { label: 'Robotică (RB)', value: 'Robotică' },
  'autovehicule rutiere': { label: 'Autovehicule rutiere (AR)', value: 'Autovehicule rutiere' },
  'ingineria si managementul calitatii, sanatatii si securitatii in munca': { label: 'Ingineria şi managementul calităţii, sănătăţii şi securităţii în muncă (IMCSSM)', value: 'Ingineria şi managementul calităţii, sănătăţii şi securităţii în muncă' },
  'expertiza tehnica, evaluare economica si management': { label: 'Expertiză tehnică, evaluare economică şi management (ETEM)', value: 'Expertiză tehnică, evaluare economică şi management' },
  'mecatronica aplicata': { label: 'Mecatronică aplicată (MCT-A)', value: 'Mecatronică aplicată' },
  'inginerie mecanica asistata de calculator': { label: 'Inginerie mecanică asistată de calculator (MEC-AC)', value: 'Inginerie mecanică asistată de calculator' }
};

const normalizeText = (value) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeFacultyCode = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'FSEAP' ? 'FEAA' : normalized;
};

const formatSpecializationOption = (rawName) => {
  const normalized = normalizeText(rawName);
  const known = SPECIALIZATION_META[normalized];
  if (known) return known;

  const stripped = rawName.replace(/\([^)]*\)/g, '').trim();
  const inferredAbbr = stripped
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 5);

  return {
    value: stripped,
    label: inferredAbbr ? `${stripped} (${inferredAbbr})` : stripped
  };
};

const getSpecializationsForSelection = (faculty, studyLevel) => {
  if (!faculty) return [];

  const profile = FACULTY_PROFILES[faculty];
  if (!profile) return [];

  const levelSpecific = profile.specializationsByLevel?.[studyLevel];
  if (Array.isArray(levelSpecific) && levelSpecific.length > 0) {
    return levelSpecific;
  }

  return profile.specializations || [];
};

export default function StudentQuiz() {
  const navigate = useNavigate();
  const [authAccount, setAuthAccount] = useState(() => readAuthSession());
  const [authMode, setAuthMode] = useState(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    studyLevel: '',
    faculty: '',
    specialization: '',
        skills: [],
        additionalSkills: '',
        applicationDomain: '',
        projectType: '',
    interests: '',
    careerGoals: ''
  });
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [toast, setToast] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const isInitialMount = React.useRef(true);

  const totalSteps = 4;
  const lockedAcademicProfile = useMemo(() => {
    const faculty = normalizeFacultyCode(authAccount?.faculty);
    const studyLevel = String(authAccount?.studyLevel || '').trim().toLowerCase();
    const specialization = String(authAccount?.specialization || '').trim();

    if (!faculty || !studyLevel || !specialization) {
      return null;
    }

    const availableSpecializations = getSpecializationsForSelection(faculty, studyLevel);
    if (!availableSpecializations.includes(specialization)) {
      return null;
    }

    return { faculty, studyLevel, specialization };
  }, [authAccount]);

  const specializationOptions = useMemo(
    () => getSpecializationsForSelection(formData.faculty, formData.studyLevel).map(formatSpecializationOption),
    [formData.faculty, formData.studyLevel]
  );

  useEffect(() => {
    if (!lockedAcademicProfile) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      faculty: lockedAcademicProfile.faculty,
      studyLevel: lockedAcademicProfile.studyLevel,
      specialization: lockedAcademicProfile.specialization
    }));

    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.faculty;
      delete next.studyLevel;
      delete next.specialization;
      return next;
    });
  }, [lockedAcademicProfile]);

  useEffect(() => {
    if (!formData.specialization) return;
    const availableValues = new Set(specializationOptions.map((option) => option.value));
    if (!availableValues.has(formData.specialization)) {
      setFormData((prev) => ({ ...prev, specialization: '' }));
    }
  }, [formData.specialization, specializationOptions]);

  // Auto-save to localStorage (skip first render)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Only save if there's actual data (at least one field filled)
    const hasData = formData.studyLevel || 
                    formData.faculty || 
                    formData.specialization ||
                    formData.skills.length > 0 ||
                    formData.additionalSkills.trim() ||
                    formData.applicationDomain ||
                    formData.projectType ||
                    formData.interests.trim() ||
                    formData.careerGoals.trim();
    
    if (!hasData) {
      return; // Don't save empty form
    }
    
    const draftData = {
      formData,
      currentStep,
      timestamp: Date.now()
    };
    localStorage.setItem('quizDraft', JSON.stringify(draftData));
    console.log('Draft saved:', draftData);
  }, [formData, currentStep]);

  // Restore draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('quizDraft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        const age = Date.now() - (parsed.timestamp || 0);
        
        // Show banner if draft exists and is less than 24 hours old
        // Only show if there's actual data in the form (any field filled)
        const initialForm = {
          studyLevel: '',
          faculty: '',
          specialization: '',
          skills: [],
          additionalSkills: '',
          applicationDomain: '',
          projectType: '',
          interests: '',
          careerGoals: ''
        };
        
        const migratedFormData = {
          ...parsed.formData,
          faculty: normalizeFacultyCode(parsed.formData?.faculty)
        };

        const hasAnyData = JSON.stringify(migratedFormData) !== JSON.stringify(initialForm);
        
        if (age < 24 * 60 * 60 * 1000 && hasAnyData) {
          setShowDraftBanner(true);
        }
      } catch (e) {
        console.error('Failed to parse draft', e);
      }
    }
  }, []);

  const restoreDraft = () => {
    const draft = localStorage.getItem('quizDraft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        console.log('Restoring draft:', parsed);
        
        // Reset the initial mount flag so next save doesn't skip
        isInitialMount.current = true;
        
        // Restore the data
        setFormData({
          ...parsed.formData,
          faculty: normalizeFacultyCode(parsed.formData?.faculty)
        });
        setCurrentStep(parsed.currentStep);
        setShowDraftBanner(false);
        showToast('Progresul tău a fost restaurat!', 'success');
      } catch (e) {
        console.error('Failed to restore draft:', e);
        showToast('Nu am putut restaura datele.', 'error');
      }
    } else {
      console.log('No draft found in localStorage');
      showToast('Nu am găsit date salvate.', 'warning');
    }
  };

  const dismissDraft = () => {
    localStorage.removeItem('quizDraft');
    setShowDraftBanner(false);
  };

  const handleAuthSuccess = (account) => {
    setAuthAccount(account);
    writeAuthSession(account);
  };

  const handleLogout = () => {
    setAuthAccount(null);
    clearAuthSession();
  };

  const handleRequestLogout = () => setLogoutConfirmOpen(true);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.studyLevel) return 'Te rog selectează nivelul de studii.';
        if (!formData.faculty) return 'Te rog selectează facultatea.';
        if (!formData.specialization) return 'Te rog selectează specializarea.';
        return null;
      case 2:
        if (formData.skills.length === 0 && !formData.additionalSkills.trim()) {
          return 'Te rog selectează cel puțin o competență din listă sau adaugă competențe în câmpul text.';
        }
        return null;
      case 3:
        if (!formData.applicationDomain) return 'Te rog selectează domeniul de aplicare vizat.';
        if (!formData.projectType) return 'Te rog selectează tipul proiectului dorit.';
        return null;
      case 4:
        // Cariera poate fi opțională, dar recomandat
        return null;
      default:
        return null;
    }
  };

  const canAdvanceToNextStep = () => {
    return validateCurrentStep() === null;
  };

  const handleNext = () => {
    const validationError = validateCurrentStep();
    if (validationError) {
      // Set field-level errors
      const errors = {};
      if (currentStep === 1) {
        if (!formData.studyLevel) errors.studyLevel = 'Câmp obligatoriu';
        if (!formData.faculty) errors.faculty = 'Câmp obligatoriu';
        if (!formData.specialization) errors.specialization = 'Câmp obligatoriu';
      } else if (currentStep === 2) {
        if (formData.skills.length === 0 && !formData.additionalSkills.trim()) {
          errors.skills = 'Selectează cel puțin o competență sau adaugă text';
        }
      } else if (currentStep === 3) {
        if (!formData.applicationDomain) errors.applicationDomain = 'Câmp obligatoriu';
        if (!formData.projectType) errors.projectType = 'Selectează o opțiune';
      }
      setFieldErrors(errors);
      showToast(validationError, 'error');
      return;
    }
    setFieldErrors({});
    if (currentStep < totalSteps) setCurrentStep(curr => curr + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(curr => curr - 1);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
        // Clear field error when user starts typing
        if (fieldErrors[name]) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }

        if (name === 'faculty') {
            setFormData(prev => ({
                ...prev,
                faculty: value,
                specialization: '',
                skills: [],
                additionalSkills: '',
                applicationDomain: '',
                projectType: '',
                interests: ''
            }));
            return;
        }

        // Input sanitization & max length limits
        let sanitizedValue = value;
        if (name === 'additionalSkills' && value.length > 1000) {
            sanitizedValue = value.slice(0, 1000);
        } else if (name === 'interests' && value.length > 500) {
            sanitizedValue = value.slice(0, 500);
        } else if (name === 'careerGoals' && value.length > 500) {
            sanitizedValue = value.slice(0, 500);
        }

        setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
    };

    const toggleSkillTag = (skill) => {
      if (!activeFacultyProfile?.skillTags.includes(skill)) return;

        // Clear skills error when user clicks a skill
        if (fieldErrors.skills) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.skills;
                return newErrors;
            });
        }

        setFormData(prev => ({
            ...prev,
            skills: prev.skills.includes(skill)
                ? prev.skills.filter((item) => item !== skill)
                : [...prev.skills, skill]
        }));
  };

  const handleSubmit = async () => {
        if (!formData.faculty || !formData.specialization || !formData.studyLevel || !formData.applicationDomain || !formData.projectType) {
      showToast('Te rog completează toate câmpurile obligatorii!', 'error');
      return;
    }

        const allSkills = [
            ...formData.skills,
            ...formData.additionalSkills
                .split(/[,;]/)
                .map((skill) => skill.trim())
                .filter(Boolean)
        ];

        const payload = {
            ...formData,
          faculty: normalizeFacultyCode(formData.faculty),
            skills: allSkills.join(', '),
            selectedSkillTags: formData.skills,
            additionalSkills: formData.additionalSkills,
            email: authAccount?.email || '',
            studentName: authAccount?.fullName || ''
        };

        console.log("Sending student profile to AI backend...", payload);

    try {
      setIsLoading(true);

      const response = await fetch('http://localhost:3001/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
                body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get recommendations');
      }

      const data = await response.json();
      console.log("AI Recommendations received:", data);

      // Clear draft from localStorage after successful submission
      localStorage.removeItem('quizDraft');

      navigate('/recommendations', { 
        state: { 
                    formData: payload,
          recommendations: data.recommendations,
          aiResponse: data
        } 
      });

    } catch (error) {
      setIsLoading(false);
      console.error("Error getting recommendations:", error);
      showToast(`Eroare AI: ${error.message}. Asigură-te că backend-ul rulează pe localhost:3001.`, 'error');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
        const activeElement = document.activeElement;
        // Don't trigger if user is typing in textarea
        if (activeElement?.tagName !== 'TEXTAREA') {
          if (currentStep < totalSteps && canAdvanceToNextStep()) {
            handleNext();
          } else if (currentStep === totalSteps && canAdvanceToNextStep()) {
            handleSubmit();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, formData, isLoading]);

  const handleStepClick = (step) => {
    // Allow direct navigation only to completed steps or next step
    if (step <= currentStep || (step === currentStep + 1 && canAdvanceToNextStep())) {
      setCurrentStep(step);
    }
  };

  const activeFacultyProfile = FACULTY_PROFILES[formData.faculty];
  const skillSuggestions = activeFacultyProfile?.skillTags || [];
  const applicationDomainSuggestions = activeFacultyProfile?.applicationDomains || [];
  const projectTypeSuggestions = activeFacultyProfile?.projectTypes || [];
  const skillsHint = activeFacultyProfile?.skillsHint || 'Selectează sau descrie competențele relevante pentru profilul tău.';
  const additionalSkillsPlaceholder = activeFacultyProfile?.additionalSkillsPlaceholder || 'Ex: descrie competențele tale relevante: limbaje, tool-uri, framework-uri, tehnologii...';
  const interestsPlaceholder = activeFacultyProfile?.interestsPlaceholder || 'Ex: Descrie subiectele care te interesează...';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 via-blue-50 to-white flex flex-col font-sans text-slate-800 relative overflow-x-hidden">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'error' ? 'bg-red-600' : 
          toast.type === 'success' ? 'bg-green-600' : 
          toast.type === 'warning' ? 'bg-amber-600' : 'bg-blue-600'
        } text-white px-6 py-4 rounded-lg shadow-2xl max-w-md flex items-center gap-3`}>
          <div className="flex-shrink-0">
            {toast.type === 'error' && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.type === 'success' && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'warning' && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <span className="font-medium text-sm">{toast.message}</span>
          <button 
            onClick={() => setToast(null)} 
            className="ml-auto flex-shrink-0 hover:bg-white/20 p-1 rounded transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Draft Restore Banner */}
      {showDraftBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-xl shadow-2xl max-w-lg animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm mb-1">Continuă de unde ai rămas?</p>
              <p className="text-xs text-blue-100">Am găsit un chestionar nefinalizat</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={restoreDraft}
                className="px-4 py-2 bg-white text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors"
              >
                Restaurează
              </button>
              <button 
                onClick={dismissDraft}
                className="px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Începe nou
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay - appears when isLoading is true */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          {/* Modal Box */}
          <div className="bg-white rounded-2xl p-12 shadow-2xl flex flex-col items-center gap-8 w-96 border border-blue-200">
            {/* Spinner with blue gradient */}
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 border-r-blue-500 animate-spin"></div>
              <div className="absolute inset-1 rounded-full border-2 border-transparent border-b-blue-300"></div>
            </div>
            
            {/* Text */}
            <div className="text-center">
              <p className="text-xl text-slate-800 font-bold">Se analizează profilul tău</p>
              <p className="text-sm text-slate-500 mt-3">Sistemul inteligent lucrează...</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-slate-900/95 text-white shadow-lg backdrop-blur-sm border-b border-blue-400/30 px-4 md:px-20">
        <div className="w-full h-24 flex justify-between items-center relative">
          <Link to="/" className="flex items-center gap-4 z-10 hover:opacity-90 transition-opacity">
            <div className="flex flex-col items-start">
              <span className="text-white text-2xl font-black tracking-tight leading-none">LICENTA<span className="text-blue-300">CONNECT</span></span>
              <span className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mt-1 text-left">Universitatea Ștefan cel Mare</span>
            </div>
          </Link>

          {authAccount ? (
            <AccountBadge account={authAccount} onClick={() => navigate('/contul-meu')} onLogout={handleRequestLogout} />
          ) : (
            <div className="flex items-center gap-2 z-10">
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
      </header>

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
        description="Dacă ieși acum, va trebui să te autentifici din nou pentru a continua chestionarul."
        confirmLabel="Da, deconectează-mă"
        cancelLabel="Rămân conectat"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          handleLogout();
        }}
      />

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center p-4 sm:p-6 md:p-12">
        <div className="w-full max-w-5xl px-1 md:px-6 py-4 md:py-6 inline-flex flex-col items-center">
          <div className="w-full flex flex-col items-center gap-3 mb-8 md:mb-10">
            <h1 className="text-center text-slate-800 text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
              Completează profilul pentru recomandări de teme
            </h1>
            <p className="max-w-2xl text-center text-slate-700 text-sm sm:text-base leading-6">
              Răspunsurile tale sunt folosite pentru a genera recomandări de teme potrivite profilului academic și direcțiilor tale de interes.
            </p>
          </div>

          <div className="w-full max-w-4xl px-4 mb-10">
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:flex md:items-start md:justify-between md:gap-3">
              {[1, 2, 3, 4].map((step) => {
                const isClickable = step <= currentStep || (step === currentStep + 1 && canAdvanceToNextStep());
                const isActive = currentStep === step;
                const isDone = currentStep > step;
                const isConnectorActive = currentStep > step;
                const isLast = step === 4;

                return (
                  <div key={step} className={`flex items-start ${isLast ? '' : 'md:flex-1'}`}>
                    <button
                      type="button"
                      onClick={() => isClickable && handleStepClick(step)}
                      className="flex w-full flex-col items-center gap-2 disabled:cursor-not-allowed md:w-auto"
                      disabled={!isClickable}
                    >
                      <span className={`w-11 h-11 rounded-full inline-flex items-center justify-center text-sm font-bold transition-all duration-300 ease-in-out ${
                        isDone
                          ? 'bg-slate-800 text-white'
                          : isActive
                          ? 'bg-slate-800 text-white shadow-[0_0_0_4px_rgba(25,32,65,0.20)]'
                          : 'bg-white text-slate-400 outline outline-2 outline-slate-300'
                      }`}>
                        {isDone ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          step
                        )}
                      </span>
                      <span className={`max-w-[140px] text-[11px] leading-tight uppercase tracking-wide font-semibold text-center ${currentStep >= step ? 'text-slate-800' : 'text-slate-400'}`}>
                        {['Date Academice', 'Competențe', 'Interese', 'Carieră'][step - 1]}
                      </span>
                    </button>

                    {!isLast && (
                      <div className="hidden pt-5 flex-1 px-2 md:block md:px-3">
                        <div className="h-0.5 bg-slate-300 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ease-in-out ${isConnectorActive ? 'w-full bg-slate-800' : 'w-0 bg-slate-800'}`} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-[0px_10px_30px_-5px_rgba(25,32,65,0.15)] outline outline-1 outline-blue-100 overflow-hidden">
            <div className="p-5 sm:p-6 md:p-12 flex flex-col gap-8 md:gap-10">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
                  {currentStep === 1 && 'Date academice'}
                  {currentStep === 2 && 'Competențe relevante'}
                  {currentStep === 3 && 'Domeniu și tip de proiect'}
                  {currentStep === 4 && 'Direcție profesională'}
                </h2>
                <p className="text-slate-600 text-sm leading-6">
                  {currentStep === 1 && 'Datele academice sunt preluate automat din profilul contului tău.'}
                  {currentStep === 2 && 'Alege competențele-cheie și completează cu detalii despre tehnologiile pe care le stăpânești.'}
                  {currentStep === 3 && 'Precizează domeniul în care vrei să aplici tema și tipul de proiect pe care îl preferi.'}
                  {currentStep === 4 && 'Spune-ne în ce direcție profesională vrei să mergi pentru a calibra recomandările.'}
                </p>
              </div>

              <div className="min-h-[260px] md:min-h-[320px]">
                {currentStep === 1 && (
                  <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-in-out">
                    {lockedAcademicProfile && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Datele academice au fost preluate automat din profilul contului. Le poți modifica din pagina contului.
                      </div>
                    )}

                    <div className="flex flex-col gap-4">
                      <label className="font-bold text-slate-700 text-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                        </svg>
                        Nivel de studii și ciclu
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {STUDY_LEVEL_OPTIONS.map((option) => {
                          const selected = formData.studyLevel === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              disabled={Boolean(lockedAcademicProfile)}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, studyLevel: option.value, specialization: '' }));
                                if (fieldErrors.studyLevel) {
                                  setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.studyLevel;
                                    return next;
                                  });
                                }
                              }}
                              className={`text-left p-5 rounded-xl border transition-all duration-300 ease-in-out ${
                                selected
                                  ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-600'
                                  : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-slate-800 font-bold text-base">{option.title}</p>
                                  <p className="text-slate-500 text-sm">{option.subtitle}</p>
                                </div>
                                <span className={`p-2 rounded-lg ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                  {option.icon}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {fieldErrors.studyLevel && (
                        <p className="text-red-600 text-sm font-medium flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {fieldErrors.studyLevel}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-4">
                      <label className="font-bold text-slate-700 text-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Facultatea
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(FACULTY_LABELS).map(([key, label]) => {
                          const selected = formData.faculty === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={Boolean(lockedAcademicProfile)}
                              onClick={() => {
                                handleChange({ target: { name: 'faculty', value: key } });
                                if (fieldErrors.faculty) {
                                  setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.faculty;
                                    return next;
                                  });
                                }
                              }}
                              className={`text-left p-5 rounded-xl border transition-all duration-300 ease-in-out ${
                                selected
                                  ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-600'
                                  : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                              }`}
                            >
                              <p className="text-sm text-slate-800 font-bold">{key}</p>
                              <p className="text-sm text-slate-600 mt-1">{label.replace(`${key} - `, '')}</p>
                            </button>
                          );
                        })}
                      </div>
                      {fieldErrors.faculty && (
                        <p className="text-red-600 text-sm font-medium flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {fieldErrors.faculty}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-4">
                      <label className="font-bold text-slate-700 text-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-4H9m10 8H7m-4 4h18" />
                        </svg>
                        Specializarea
                      </label>
                      {!!formData.faculty && !!formData.studyLevel && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {specializationOptions.map((option) => {
                            const selected = formData.specialization === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                disabled={Boolean(lockedAcademicProfile)}
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, specialization: option.value }));
                                  if (fieldErrors.specialization) {
                                    setFieldErrors((prev) => {
                                      const next = { ...prev };
                                      delete next.specialization;
                                      return next;
                                    });
                                  }
                                }}
                                className={`text-left px-4 py-3 rounded-xl border font-semibold text-sm transition-all duration-300 ease-in-out ${
                                  selected
                                    ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-600 text-blue-800'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {fieldErrors.specialization && (
                        <p className="text-red-600 text-sm font-medium flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {fieldErrors.specialization}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-in-out">
                    <div className="flex flex-col gap-4">
                      <label className="font-bold text-slate-700 text-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4" />
                        </svg>
                        Competențe și tehnologii
                      </label>
                      <p className="text-sm text-slate-600">{skillsHint}</p>
                      {skillSuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {skillSuggestions.map((skill) => {
                            const selected = formData.skills.includes(skill);
                            return (
                              <button
                                key={skill}
                                type="button"
                                onClick={() => toggleSkillTag(skill)}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                                  selected
                                    ? 'border-blue-700 bg-blue-700 text-white'
                                    : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-50'
                                }`}
                              >
                                {skill}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <textarea
                        name="additionalSkills"
                        value={formData.additionalSkills}
                        onChange={handleChange}
                        placeholder={additionalSkillsPlaceholder}
                        className="w-full h-44 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-200 outline-none bg-slate-50 transition-all duration-300 ease-in-out resize-none placeholder-slate-400"
                      />
                      {fieldErrors.skills && (
                        <p className="text-red-600 text-sm font-medium flex items-center gap-2 mt-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {fieldErrors.skills}
                        </p>
                      )}
                      <div className="text-right text-sm text-slate-500">
                        {formData.additionalSkills.length} / 1000 caractere
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-in-out">
                    <div className="flex flex-col gap-4">
                      <label className="font-bold text-slate-700 text-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3h6c0-1.657-1.343-3-3-3zm0 0V5m0 11v3m7-7h-3m-8 0H5" />
                        </svg>
                        Domeniul în care vrei să aplici tema
                      </label>
                      {applicationDomainSuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {applicationDomainSuggestions.map((domain) => {
                            const selected = formData.applicationDomain === domain;
                            return (
                              <button
                                key={domain}
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, applicationDomain: domain }))}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                                  selected
                                    ? 'border-blue-700 bg-blue-700 text-white'
                                    : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-50'
                                }`}
                              >
                                {domain}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <textarea
                        name="applicationDomain"
                        value={formData.applicationDomain}
                        onChange={handleChange}
                        placeholder="Ex: Vreau să aplic tema în zona web, educație digitală, sisteme embedded, business analytics etc."
                        className="w-full h-32 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-200 outline-none bg-slate-50 transition-all duration-300 ease-in-out resize-none placeholder-slate-400"
                      />
                      {fieldErrors.applicationDomain && (
                        <p className="text-red-600 text-sm font-medium flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {fieldErrors.applicationDomain}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-4">
                      <label className="font-bold text-slate-700 text-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3a.75.75 0 01.75.75V5h3V3.75a.75.75 0 011.5 0V5h1.25a2 2 0 012 2v10a2 2 0 01-2 2H7.75a2 2 0 01-2-2V7a2 2 0 012-2H9V3.75A.75.75 0 019.75 3z" />
                        </svg>
                        Tipul proiectului preferat
                      </label>
                      {projectTypeSuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {projectTypeSuggestions.map((projectType) => {
                            const selected = formData.projectType === projectType;
                            return (
                              <button
                                key={projectType}
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, projectType }))}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                                  selected
                                    ? 'border-blue-700 bg-blue-700 text-white'
                                    : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-50'
                                }`}
                              >
                                {projectType}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <textarea
                        name="projectType"
                        value={formData.projectType}
                        onChange={handleChange}
                        placeholder="Ex: Prefer un proiect practic, un prototip, un studiu aplicat sau o cercetare teoretică."
                        className="w-full h-28 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-200 outline-none bg-slate-50 transition-all duration-300 ease-in-out resize-none placeholder-slate-400"
                      />
                      {fieldErrors.projectType && (
                        <p className="text-red-600 text-sm font-medium flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {fieldErrors.projectType}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="font-bold text-slate-700 text-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5M21 6v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                        Detalii suplimentare despre interese
                      </label>
                      <p className="text-sm text-slate-600">Descrie pe scurt ce vrei să înveți, să dezvolți sau să aprofundezi prin tema ta.</p>
                      <textarea
                        name="interests"
                        value={formData.interests}
                        onChange={handleChange}
                        placeholder={interestsPlaceholder}
                        className="w-full h-48 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-200 outline-none bg-slate-50 transition-all duration-300 ease-in-out resize-none placeholder-slate-400"
                      />
                      <div className="text-right text-sm text-slate-500">
                        {formData.interests.length} / 500 caractere
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-in-out">
                    <div className="flex flex-col gap-3">
                      <label className="font-bold text-slate-700 text-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Direcție profesională
                      </label>
                      <p className="text-sm text-slate-600">Spune-ne în ce direcție profesională vrei să mergi ca să putem calibra recomandările.</p>
                      <textarea
                        name="careerGoals"
                        value={formData.careerGoals}
                        onChange={handleChange}
                        placeholder="Ex: Software Architect, cercetare academică, startup-uri..."
                        className="w-full h-52 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-200 outline-none bg-slate-50 transition-all duration-300 ease-in-out resize-none placeholder-slate-400"
                      />
                      <div className="text-right text-sm text-slate-500">
                        {formData.careerGoals.length} / 500 caractere
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="self-stretch px-6 md:px-8 py-6 bg-blue-200/70 border-t border-blue-100">
              <div className="w-full flex flex-col gap-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div className="w-full md:w-auto md:justify-self-start order-2 md:order-1">
                  {currentStep > 1 ? (
                    <button
                      onClick={handleBack}
                      className="w-full md:w-auto px-6 py-3 bg-white/80 hover:bg-white rounded-lg font-bold text-slate-800 transition-all duration-300 ease-in-out active:scale-95"
                    >
                      Înapoi
                    </button>
                  ) : (
                    <div className="hidden md:block h-11" />
                  )}
                </div>

                <div className="order-1 md:order-2 text-center text-xs md:text-sm font-semibold tracking-wide text-slate-700 uppercase">
                  Pasul {currentStep} din {totalSteps}
                </div>

                <div className="w-full md:w-auto md:justify-self-end order-3">
                  {currentStep < totalSteps ? (
                    <button
                      onClick={handleNext}
                      disabled={!canAdvanceToNextStep()}
                      className="w-full md:w-auto px-8 py-3 rounded-lg font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-300 ease-in-out active:scale-95 inline-flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      Pasul următor
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className="w-full md:w-auto px-8 py-3 rounded-lg font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-300 ease-in-out active:scale-95 inline-flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {isLoading ? 'Se procesează...' : 'Afișează recomandările'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-4xl mt-6 p-4 bg-white/80 rounded-xl border border-blue-200 inline-flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-slate-700 leading-5">
              <span className="font-bold">Sugestie:</span> Cu cât oferi mai multe detalii despre competențele tale, interesul tău și direcția profesională, cu atât recomandările vor fi mai precise.
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-slate-800 text-blue-100 px-6 py-6 border-t border-blue-300/20">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
          <p>© 2026 Universitatea "Ștefan cel Mare" Suceava</p>
          <p className="text-blue-200">Chestionar pentru recomandări de teme și contactarea profesorului coordonator</p>
        </div>
      </footer>
    </div>
  );
}
