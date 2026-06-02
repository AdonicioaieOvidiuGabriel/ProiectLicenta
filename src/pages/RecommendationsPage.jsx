import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import AuthModal from '../components/AuthModal';
import AccountBadge from '../components/AccountBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { clearAuthSession, readAuthSession, writeAuthSession } from '../utils/authSession';
import { apiUrl } from '../utils/apiUrl';

const sortRecommendationsByScoreDesc = (items) =>
  [...(Array.isArray(items) ? items : [])].sort((left, right) => Number(right?.matchScore || 0) - Number(left?.matchScore || 0));

export default function RecommendationsPage() {
  const LOAD_MORE_BATCH_SIZE = 6;

  const location = useLocation();
  const navigate = useNavigate();
  const [authAccount, setAuthAccount] = useState(() => readAuthSession());
  const [authMode, setAuthMode] = useState(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreRecommendations, setHasMoreRecommendations] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [studentProfile, setStudentProfile] = useState(null);
  const [aiMetadata, setAiMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showAcademicProfile, setShowAcademicProfile] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [profesorEmail, setProfessorEmail] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState(studentProfile?.email || '');
  const [generatedEmailText, setGeneratedEmailText] = useState('');
  const [editedEmailText, setEditedEmailText] = useState('');
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [emailGenerated, setEmailGenerated] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmails, setSentEmails] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingSentEmails, setLoadingSentEmails] = useState(false);

  const resolvedStudentEmail = String(studentProfile?.email || authAccount?.email || '').trim();

  useEffect(() => {
    if (location.state?.formData) {
      const profile = location.state.formData;
      setStudentProfile(profile);
      
      // Use recommendations from API if available (new flow)
      if (location.state?.recommendations) {
        setRecommendations(sortRecommendationsByScoreDesc(location.state.recommendations));
        setAiMetadata(location.state.aiResponse);
        setHasMoreRecommendations(Boolean(location.state.aiResponse?.hasMoreRecommendations));
        setNextOffset(
          typeof location.state.aiResponse?.nextOffset === 'number'
            ? location.state.aiResponse.nextOffset
            : (location.state.recommendations?.length || 0)
        );
        console.log('Using recommendations from AI Backend (Direct Context Matching)');
      } else {
        // Fallback to frontend mock if API not available (backward compatibility)
        console.log('Using fallback (frontend matching) - Backend not responding');
      }
      
      setLoading(false);
    } else {
      // No data in state - redirect
      setLoading(false);
    }
  }, [location.state]);

  useEffect(() => {
    setStudentEmail(resolvedStudentEmail);
  }, [resolvedStudentEmail]);

  useEffect(() => {
    const shouldLockScroll = Boolean(showExitModal || showEmailModal);
    const originalOverflow = document.body.style.overflow;

    if (shouldLockScroll) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showExitModal, showEmailModal]);

  // Fetch sent emails when student email is available
  useEffect(() => {
    if (studentEmail && studentEmail.trim()) {
      const fetchSentEmails = async () => {
        try {
          setLoadingSentEmails(true);
          const response = await fetch(
            apiUrl(`/api/sent-emails?studentEmail=${encodeURIComponent(studentEmail.trim())}`)
          );
          if (response.ok) {
            const data = await response.json();
            setSentEmails(data.emails || []);
          }
        } catch (error) {
          console.error('Error fetching sent emails:', error);
        } finally {
          setLoadingSentEmails(false);
        }
      };
      
      fetchSentEmails();
    }
  }, [studentEmail]);

  const handleAuthSuccess = (account) => {
    setAuthAccount(account);
    writeAuthSession(account);
  };

  const handleLogout = () => {
    setAuthAccount(null);
    clearAuthSession();
  };

  const handleRequestLogout = () => setLogoutConfirmOpen(true);

  const handleExitClick = (e) => {
    e.preventDefault();
    setShowExitModal(true);
  };

  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
    setProfessorEmail('');
    setStudentName('');
    setStudentEmail(resolvedStudentEmail);
    setGeneratedEmailText('');
    setEditedEmailText('');
    setEmailGenerated(false);
    setEmailSent(false);
    setShowEmailModal(true);
  };

  const createEmailRequestBody = (rewriteMode = false) => ({
    studentFaculty: String(studentProfile?.faculty || ''),
    studentSpecialization: String(studentProfile?.specialization || ''),
    studentStudyLevel: String(studentProfile?.studyLevel || ''),
    studentEmail: String(studentEmail.trim() || resolvedStudentEmail),
    studentName: String(studentName.trim() || studentProfile?.studentName || ''),
    studentApplicationDomain: String(studentProfile?.applicationDomain || ''),
    studentProjectType: String(studentProfile?.projectType || ''),
    studentSkills: String(studentProfile?.skills || ''),
    studentAdditionalSkills: String(studentProfile?.additionalSkills || ''),
    studentInterests: String(studentProfile?.interests || ''),
    topicId: String(selectedTopic?.id || ''),
    topicTitle: String(selectedTopic?.title || ''),
    topicProfessor: String(selectedTopic?.professor || ''),
    topicSpecialization: Array.isArray(selectedTopic?.specialization)
      ? selectedTopic.specialization.map((value) => String(value || ''))
      : String(selectedTopic?.specialization || ''),
    profesorEmail: String(profesorEmail.trim()),
    rewriteMode
  });

  const safeStringify = (value) => {
    const seen = new WeakSet();

    return JSON.stringify(value, (key, currentValue) => {
      if (typeof currentValue === 'object' && currentValue !== null) {
        if (seen.has(currentValue)) {
          return undefined;
        }
        seen.add(currentValue);
      }

      if (typeof currentValue === 'function' || typeof currentValue === 'symbol' || typeof currentValue === 'undefined') {
        return undefined;
      }

      return currentValue;
    });
  };

  const handleGenerateEmail = async (rewriteMode = false) => {
    if (!studentProfile) {
      alert('Profilul studentului nu este încă încărcat. Încearcă din nou în câteva secunde.');
      return;
    }

    if (!selectedTopic) {
      alert('Nu este selectată nicio temă.');
      return;
    }

    if (!profesorEmail.trim()) {
      alert('Te rog introdu email-ul profesorului!');
      return;
    }

    setIsGeneratingEmail(true);
    try {
      const response = await fetch(apiUrl('/api/generate-email-text'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: safeStringify(createEmailRequestBody(rewriteMode))
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.details || data?.error || `HTTP ${response.status}`);
      }

      if (!data?.emailText) {
        throw new Error('Backend-ul nu a returnat textul emailului.');
      }

      setGeneratedEmailText(data.emailText);
      setEditedEmailText(data.emailText);
      setEmailGenerated(true);
      setEmailSent(false);
    } catch (error) {
      console.error('Error generating email:', error);
      alert(`Eroare la generarea textului: ${error.message}`);
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(editedEmailText).then(() => {
      alert('Emailul a fost copiat în clipboard!');
    });
  };

  const handleRewriteEmail = async () => {
    if (!selectedTopic) {
      return;
    }

    setIsGeneratingEmail(true);
    try {
      const response = await fetch(apiUrl('/api/generate-email-text'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: safeStringify(createEmailRequestBody(true))
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.details || data?.error || `HTTP ${response.status}`);
      }

      if (!data?.emailText) {
        throw new Error('Backend-ul nu a returnat textul emailului.');
      }

      setGeneratedEmailText(data.emailText);
      setEditedEmailText(data.emailText);
      setEmailGenerated(true);
      setEmailSent(false);
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error regenerating email:', error);
      alert(`Eroare la reformularea textului: ${error.message}`);
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleSendEmail = async () => {
    if (!studentEmail.trim()) {
      alert('Te rog introdu email-ul tău!');
      return;
    }

    if (!editedEmailText.trim()) {
      alert('Textul emailului nu poate fi gol!');
      return;
    }

    setIsSubmittingEmail(true);
    try {
      const response = await fetch(apiUrl('/api/send-email'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentEmail: String(studentEmail.trim()),
          studentName: String(studentName.trim()),
          profesorEmail: String(profesorEmail.trim()),
          recommendationSessionId: aiMetadata?.recommendationSessionId || null,
          topic: {
            id: String(selectedTopic?.id || ''),
            title: String(selectedTopic?.title || ''),
            professor: String(selectedTopic?.professor || ''),
            specialization: Array.isArray(selectedTopic?.specialization)
              ? selectedTopic.specialization.map((value) => String(value || ''))
              : String(selectedTopic?.specialization || '')
          },
          emailText: String(editedEmailText || ''),
          studentProfile: {
            faculty: String(studentProfile?.faculty || ''),
            specialization: String(studentProfile?.specialization || ''),
            studyLevel: String(studentProfile?.studyLevel || '')
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.details || data?.error || `HTTP ${response.status}`);
      }

      setEmailSent(true);
      setPreviewUrl(data.previewUrl);
      
      // Refresh sent emails list
      if (studentEmail.trim()) {
        const fetchResponse = await fetch(
          apiUrl(`/api/sent-emails?studentEmail=${encodeURIComponent(studentEmail.trim())}`)
        );
        if (fetchResponse.ok) {
          const fetchData = await fetchResponse.json();
          setSentEmails(fetchData.emails || []);
        }
      }
      
      alert('Email trimis cu succes! Accesează preview-ul pentru a vedea cum arată.');
    } catch (error) {
      console.error('Error sending email:', error);
      alert(`Eroare la trimiterea emailului: ${error.message}`);
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleConfirmExit = () => {
    // Scroll to top before navigating
    window.scrollTo(0, 0);
    // Navigate with replace: true to prevent going back
    navigate('/', { replace: true });
  };

  const handleLoadMore = async () => {
    if (!hasMoreRecommendations || isLoadingMore) return;

    const recommendationSessionId = aiMetadata?.recommendationSessionId;
    if (!recommendationSessionId) {
      setHasMoreRecommendations(false);
      return;
    }

    try {
      setIsLoadingMore(true);
      const response = await fetch(apiUrl('/api/recommend/more'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recommendationSessionId,
          offset: nextOffset,
          limit: LOAD_MORE_BATCH_SIZE
        })
      });

      if (!response.ok) {
        throw new Error('Failed to load more recommendations');
      }

      const data = await response.json();
      const newRecommendations = Array.isArray(data.recommendations) ? data.recommendations : [];

      setRecommendations((prev) => sortRecommendationsByScoreDesc([...prev, ...newRecommendations]));
      setHasMoreRecommendations(Boolean(data.hasMoreRecommendations));
      setNextOffset(typeof data.nextOffset === 'number' ? data.nextOffset : nextOffset + newRecommendations.length);
      setAiMetadata((prev) => ({
        ...(prev || {}),
        recommendationSessionId: data.recommendationSessionId || recommendationSessionId,
        hasMoreRecommendations: Boolean(data.hasMoreRecommendations),
        nextOffset: typeof data.nextOffset === 'number' ? data.nextOffset : nextOffset + newRecommendations.length,
        totalRankedTopics: data.totalRankedTopics
      }));
    } catch (error) {
      console.error('Error loading more recommendations:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const selectedSkillTags = Array.isArray(studentProfile?.selectedSkillTags)
    ? studentProfile.selectedSkillTags
    : [];

  const additionalSkillList = (studentProfile?.additionalSkills || '')
    .split(/[,;]/)
    .map((skill) => skill.trim())
    .filter(Boolean);

  const fallbackSkillList = (studentProfile?.skills || '')
    .split(/[,;]/)
    .map((skill) => skill.trim())
    .filter(Boolean);

  const interestList = (studentProfile?.interests || '')
    .split(/[,;]/)
    .map((interest) => interest.trim())
    .filter(Boolean);

  const studyLevelLabel = studentProfile?.studyLevel === 'licenta'
    ? 'Licență'
    : studentProfile?.studyLevel === 'disertatie' || studentProfile?.studyLevel === 'masterat'
    ? 'Masterat'
    : 'Conversie profesională';

  const formatSpecialization = (specialization) => {
    if (Array.isArray(specialization)) {
      return specialization.join(', ');
    }
    return specialization || studentProfile?.specialization || 'Nespecificat';
  };

  const buildStudentProfilePayload = () => ({
    faculty: studentProfile?.faculty || '',
    specialization: studentProfile?.specialization || '',
    studyLevel: studentProfile?.studyLevel || '',
    email: studentProfile?.email || '',
    applicationDomain: studentProfile?.applicationDomain || '',
    projectType: studentProfile?.projectType || '',
    skills: studentProfile?.skills || '',
    additionalSkills: studentProfile?.additionalSkills || '',
    selectedSkillTags: Array.isArray(studentProfile?.selectedSkillTags) ? [...studentProfile.selectedSkillTags] : [],
    interests: studentProfile?.interests || ''
  });

  const buildTopicPayload = () => ({
    id: selectedTopic?.id || '',
    title: selectedTopic?.title || '',
    professor: selectedTopic?.professor || '',
    specialization: selectedTopic?.specialization || ''
  });

  if (!studentProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Se încarcă profilul...</h2>
          <p className="text-slate-500">Vă rugăm așteptați.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 via-blue-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-slate-900/95 text-white shadow-lg backdrop-blur-sm border-b border-blue-400/30 px-4 md:px-20">
        <div className="w-full h-24 flex justify-between items-center relative">
          <button
            onClick={() => {
              window.scrollTo(0, 0);
              navigate('/');
            }}
            className="flex items-center gap-4 hover:opacity-90 transition-opacity cursor-pointer bg-transparent border-0 p-0 z-10"
          >
            <div className="flex flex-col items-start">
              <span className="text-white text-2xl font-black tracking-tight leading-none">LICENTA<span className="text-blue-300">CONNECT</span></span>
              <span className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mt-1 text-left">Universitatea Ștefan cel Mare</span>
            </div>
          </button>

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
        description="Dacă ieși acum, va trebui să te autentifici din nou pentru a accesa contul și recomandările tale."
        confirmLabel="Da, deconectează-mă"
        cancelLabel="Rămân conectat"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          handleLogout();
        }}
      />

      <section className="w-full border-b border-slate-200 bg-gradient-to-b from-white to-blue-50/70">
        <div className="w-full px-3 md:px-6 lg:px-10 xl:px-12 py-6">
          <div className="mx-auto w-full max-w-[1440px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-700">Portal Recomandări</p>
            <h1 className="mt-1 text-2xl md:text-4xl font-bold text-slate-900 leading-tight font-['Liberation_Serif']">
              Recomandări generate pentru: {studentProfile.faculty} - {studentProfile.specialization}
            </h1>
            <p className="mt-2 text-sm md:text-lg text-slate-700 leading-relaxed max-w-5xl">
              Sistemul de analiză a identificat temele de licență care se aliniază cu parcursul tău academic, competențele declarate și direcția profesională dorită.
            </p>

            <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setShowAcademicProfile((prev) => !prev)}
              className="w-full flex items-center justify-between gap-4 text-left"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Profil Academic</p>
                <p className="mt-1 text-xs md:text-sm text-slate-700">Facultate: {studentProfile.faculty} • Specializare: {studentProfile.specialization} • Nivel: {studyLevelLabel}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-900 shrink-0">
                {showAcademicProfile ? 'Ascunde' : 'Vezi profilul'}
              </span>
            </button>

            {showAcademicProfile && (
              <div className="mt-3 border-t border-blue-100 pt-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Facultate</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{studentProfile.faculty}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Specializare</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{studentProfile.specialization}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Nivel Studii</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{studyLevelLabel}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Domeniu Aplicare</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{studentProfile.applicationDomain || 'Nespecificat'}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 md:col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Tip Proiect Dorit</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{studentProfile.projectType || 'Nespecificat'}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Competențe Selectate</p>
                    <div className="flex flex-wrap gap-2">
                      {(selectedSkillTags.length > 0 ? selectedSkillTags : fallbackSkillList).length > 0 ? (
                        (selectedSkillTags.length > 0 ? selectedSkillTags : fallbackSkillList).map((skill, idx) => (
                          <span key={idx} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">Nu există competențe selectate.</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Competențe Suplimentare</p>
                    <div className="flex flex-wrap gap-2">
                      {additionalSkillList.length > 0 ? (
                        additionalSkillList.map((skill, idx) => (
                          <span key={idx} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">Nu au fost adăugate competențe suplimentare.</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Domenii de Interes</p>
                    <div className="flex flex-wrap gap-2">
                      {interestList.length > 0 ? (
                        interestList.map((interest, idx) => (
                          <span key={idx} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800">
                            {interest}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">Nu au fost specificate domenii de interes.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </section>

      <div className="w-full px-3 md:px-6 lg:px-10 xl:px-12 pt-8 pb-24">
        <div className="w-full max-w-[1440px] mx-auto flex flex-col gap-8">

        {/* Recomandări */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Teme Recomandate
          </h2>
          <p className="text-slate-500 mb-8 text-base">
            Am identificat <span className="font-semibold text-slate-900">{recommendations.length} teme</span> relevante pentru profilul tău.
          </p>

          {recommendations.length > 0 ? (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                {recommendations.map((topic, index) => (
                <div
                  key={topic.id}
                  className="group self-stretch overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-white via-blue-50/70 to-blue-100/40 shadow-[0_24px_60px_-40px_rgba(37,99,235,0.75)] transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-[0_30px_70px_-36px_rgba(37,99,235,0.9)]"
                >
                  <div className="self-stretch p-6">
                    <div className="inline-flex w-full justify-between items-start gap-4">
                      <div className="text-slate-900 text-xl font-bold font-['Liberation_Serif'] leading-7 group-hover:text-blue-900 transition-colors">
                        {topic.title}
                      </div>
                      <div className="h-8 px-3.5 rounded-full bg-gradient-to-r from-blue-700 to-blue-900 inline-flex items-center gap-2 shrink-0 border border-blue-400/30 shadow-md">
                        <div className="w-2 h-2 bg-blue-100 rounded-full" />
                        <div className="text-blue-50 text-xs font-bold font-['Noto_Sans'] uppercase leading-4 whitespace-nowrap tracking-wide">
                          {Math.round(topic.matchScore)}% Match
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 mb-1 inline-flex flex-wrap justify-start items-center gap-2 text-sm font-['Noto_Sans']">
                      <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-blue-800">
                        <span className="h-2 w-2 rounded-full bg-blue-700" />
                        <span className="font-bold leading-5">{topic.professor}</span>
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800">
                        <span className="h-2 w-2 rounded-full bg-blue-700" />
                        <span className="font-bold leading-5">{formatSpecialization(topic.specialization)}</span>
                      </span>
                    </div>

                    <div className="w-full mt-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white px-4 py-4 shadow-sm">
                      <p className="text-sm font-['Noto_Sans'] leading-6 text-slate-700">
                        <span className="text-blue-900 font-bold">Motivația AI:</span>{' '}
                        {topic.matchExplanation || `${Math.round(topic.matchScore)}% potrivire pe profilul academic declarat.`}
                      </p>
                    </div>

                    <div className="w-full pt-4 mt-5 border-t border-blue-100 inline-flex justify-between items-center gap-4">
                      <div className="text-xs text-blue-700/70 font-bold font-['Noto_Sans'] uppercase leading-4 tracking-[0.12em]">
                        #{index + 1} recomandare
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectTopic(topic)}
                        className="inline-flex items-center gap-2 rounded-full border border-blue-500 bg-blue-700 px-6 py-2 text-white shadow-sm transition-all hover:bg-blue-800 hover:shadow-md"
                      >
                        <div className="text-center text-white text-sm font-bold font-['Noto_Sans'] leading-5">Alege Tema</div>
                        <div className="h-1.5 w-1 rounded-sm bg-white" />
                      </button>
                    </div>
                  </div>
                </div>
                ))}
              </div>

              <div className="mb-16 flex justify-center">
                {isLoadingMore ? (
                  <div className="inline-flex items-center gap-3 px-6 py-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-semibold">
                    <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin"></span>
                    Se încarcă teme suplimentare...
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={!hasMoreRecommendations}
                    className={`px-8 py-3 rounded-lg transition-all font-semibold shadow-sm ${
                      hasMoreRecommendations
                        ? 'bg-slate-900 hover:bg-slate-800 text-white hover:shadow-md'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {hasMoreRecommendations ? 'Afișează mai multe' : 'Nu mai sunt teme de afișat'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
              <p className="text-slate-600 mb-6 text-lg">
                Nu am găsit recomandări exacte pentru combinația ta de profile.
              </p>
              <Link
                to="/quiz"
                className="inline-block px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all font-medium"
              >
                Încearcă din nou
              </Link>
            </div>
          )}
        </div>

        {/* Sent Emails History */}
        {sentEmails && sentEmails.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Emailuri Trimise ({sentEmails.length})
            </h2>
            <p className="text-slate-500 mb-8 text-base">
              Istoricul emailurilor trimise către profesori.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {sentEmails.map((email, idx) => (
                <div
                  key={email.id}
                  className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50/50 to-emerald-50/30 shadow-sm hover:shadow-md transition-all p-6"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-green-700">Email #{idx + 1}</p>
                      <p className="text-sm text-slate-600 mt-1">
                        {new Date(email.timestamp).toLocaleDateString('ro-RO', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-3 py-1 text-[11px] font-bold uppercase text-green-900">
                      <span className="w-2 h-2 rounded-full bg-green-600" />
                      Trimis
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="rounded-lg border border-green-200 bg-white/60 p-3">
                      <p className="text-xs text-slate-500 font-semibold uppercase">Tema</p>
                      <p className="text-sm font-semibold text-slate-900 mt-1">{email.topic.title}</p>
                    </div>

                    <div className="rounded-lg border border-green-200 bg-white/60 p-3">
                      <p className="text-xs text-slate-500 font-semibold uppercase">Profesor</p>
                      <p className="text-sm font-semibold text-slate-900 mt-1">{email.topic.professor}</p>
                    </div>

                    <div className="rounded-lg border border-green-200 bg-white/60 p-3">
                      <p className="text-xs text-slate-500 font-semibold uppercase">Email Profesor</p>
                      <a
                        href={`mailto:${email.profesorEmail}`}
                        className="text-sm font-semibold text-green-700 hover:text-green-800 mt-1 break-all"
                      >
                        {email.profesorEmail}
                      </a>
                    </div>
                  </div>

                  {email.previewUrl && (
                    <a
                      href={email.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full block text-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-all"
                    >
                      Deschide Preview
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        </div>
      </div>

      {/* Email Generation Modal */}
      {showEmailModal && selectedTopic && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-modal-title"
          onClick={() => setShowEmailModal(false)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_24px_100px_rgba(15,23,42,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="bg-slate-900 px-8 py-10 text-white lg:px-10 lg:py-12">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-300">
                  Portal Recomandări
                </div>

                <h3 id="email-modal-title" className="mt-6 text-3xl font-bold font-serif leading-tight">
                  Contactează profesorul coordonator
                </h3>

                <p className="mt-4 max-w-md text-sm leading-6 text-white/70">
                  Tema selectată este pregătită pentru trimitere. Poți genera textul cu AI, îl poți reformula și apoi îl poți trimite direct din această fereastră.
                </p>

                <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-300" />
                    <p><span className="font-semibold text-white">Tema:</span> {selectedTopic.title}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-300" />
                    <p><span className="font-semibold text-white">Profesor:</span> {selectedTopic.professor}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-300" />
                    <p><span className="font-semibold text-white">Email student:</span> răspunsul ajunge la adresa ta.</p>
                  </div>
                </div>
              </div>

              <div className="max-h-[90vh] overflow-y-auto bg-white px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Email modal</p>
                    <h4 className="mt-2 text-2xl font-bold font-serif text-slate-900">Generează și trimite emailul</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Închide
                  </button>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Numele tău
                    </label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Ion Popescu"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Emailul tău
                    </label>
                    <input
                      type="email"
                      value={studentEmail}
                      readOnly
                      placeholder="email preluat din cont"
                      disabled
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                    <p className="mt-2 text-xs text-slate-500">Emailul este preluat automat din contul tău.</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Email profesor coordonator
                    </label>
                    <input
                      type="email"
                      value={profesorEmail}
                      onChange={(e) => setProfessorEmail(e.target.value)}
                      placeholder="exemplu@usv.ro"
                      disabled={emailGenerated || emailSent}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>

                  {!emailGenerated && (
                    <button
                      type="button"
                      onClick={handleGenerateEmail}
                      disabled={isGeneratingEmail || !profesorEmail.trim()}
                      className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isGeneratingEmail ? 'Se generează textul...' : 'Generează text Email cu AI'}
                    </button>
                  )}

                  {emailGenerated && (
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Textul emailului
                      </label>
                      <textarea
                        value={editedEmailText}
                        onChange={(e) => setEditedEmailText(e.target.value)}
                        className="h-64 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Poți edita textul înainte de a-l trimite. Lungime: {editedEmailText.length} caractere
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                    {!emailSent ? (
                      <button
                        type="button"
                        onClick={() => setShowEmailModal(false)}
                        className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Anulează
                      </button>
                    ) : (
                      <div />
                    )}

                    {emailGenerated && !emailSent && (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                        <button
                          type="button"
                          onClick={handleRewriteEmail}
                          disabled={isGeneratingEmail}
                          className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-3 text-sm font-bold text-blue-900 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:bg-blue-50"
                        >
                          {isGeneratingEmail ? 'Se reformulează...' : 'Reformulare text'}
                        </button>
                        <button
                          type="button"
                          onClick={handleSendEmail}
                          disabled={isSubmittingEmail || !studentEmail.trim()}
                          className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
                        >
                          {isSubmittingEmail ? 'Se trimite...' : 'Trimite email direct'}
                        </button>
                      </div>
                    )}

                    {emailGenerated && emailSent && (
                      <button
                        type="button"
                        onClick={() => setShowEmailModal(false)}
                        className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-800"
                      >
                        Închide fereastra
                      </button>
                    )}
                  </div>

                  {emailGenerated && !emailSent && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-slate-700">
                      <span className="font-semibold text-blue-900">Sfat:</span> poți reformula sau edita textul înainte să trimiți emailul profesorului.
                    </div>
                  )}

                  {emailSent && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 space-y-3 text-sm text-slate-800">
                      <p>
                        <span className="font-semibold">Email trimis cu succes!</span> Profesorul a primit emailul tău și va răspunde la adresa: <strong>{studentEmail}</strong>
                      </p>
                      {previewUrl && (
                        <div className="pt-3 border-t border-blue-200">
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-800"
                          >
                            Deschide preview-ul emailului
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Ieșire din pagina de recomandări?</h3>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Dacă ieșiți acum, datele și recomandările acestei sesiuni <span className="font-semibold">nu vor rămâne salvate</span>. Va trebui să reluați quiz-ul pentru a obține noile recomandări.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg transition-all font-semibold"
                >
                  Anulează
                </button>
                <button
                  onClick={handleConfirmExit}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all font-semibold"
                >
                  Confirmă
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-200 bg-gradient-to-b from-white to-slate-100 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-slate-600 text-sm font-medium">
            © 2026 Universitatea "Ștefan cel Mare" Suceava
          </p>
        </div>
      </div>
    </div>
  );
}
