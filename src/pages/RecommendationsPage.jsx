import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';

export default function RecommendationsPage() {
  const LOAD_MORE_BATCH_SIZE = 6;

  const location = useLocation();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreRecommendations, setHasMoreRecommendations] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [studentProfile, setStudentProfile] = useState(null);
  const [aiMetadata, setAiMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showAcademicProfile, setShowAcademicProfile] = useState(false);

  useEffect(() => {
    if (location.state?.formData) {
      const profile = location.state.formData;
      setStudentProfile(profile);
      
      // Use recommendations from API if available (new flow)
      if (location.state?.recommendations) {
        setRecommendations(location.state.recommendations);
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
    const shouldLockScroll = Boolean(showExitModal);
    const originalOverflow = document.body.style.overflow;

    if (shouldLockScroll) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showExitModal]);

  const handleExitClick = (e) => {
    e.preventDefault();
    setShowExitModal(true);
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
      const response = await fetch('http://localhost:3001/api/recommend/more', {
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

      setRecommendations((prev) => [...prev, ...newRecommendations]);
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
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white py-6 px-3 md:px-6 lg:px-10 xl:px-12 shadow-lg border-b border-blue-400/30">
        <div className="max-w-[1440px] mx-auto flex justify-between items-center">
          <button
            onClick={() => window.scrollTo(0, 0)}
            className="flex items-center gap-4 hover:opacity-90 transition-opacity cursor-pointer bg-transparent border-0 p-0"
          >
            <div className="flex flex-col items-start">
              <span className="text-white text-2xl font-black tracking-tight leading-none">LICENTA<span className="text-blue-300">CONNECT</span></span>
              <span className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mt-1 text-left">Universitatea Ștefan cel Mare</span>
            </div>
          </button>
          <button
            onClick={handleExitClick}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm shadow-md cursor-pointer"
          >
            Înapoi la Acasă
          </button>
        </div>
      </header>

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

        </div>
      </div>

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
