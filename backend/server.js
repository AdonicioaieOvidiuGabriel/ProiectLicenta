import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, FunctionDeclarationSchemaType } from '@google/generative-ai';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const recommendationSessions = new Map();
const RECOMMENDATION_SESSION_TTL_MS = 30 * 60 * 1000;
const INITIAL_TOPIC_POOL_SIZE = 6;

function cleanupExpiredRecommendationSessions() {
  const now = Date.now();
  for (const [sessionId, session] of recommendationSessions.entries()) {
    if (now - session.createdAt > RECOMMENDATION_SESSION_TTL_MS) {
      recommendationSessions.delete(sessionId);
    }
  }
}

let allTopics = [];

const FACULTY_ALIAS_MAP = {
  fiesc: 'FIESC',
  feaa: 'FEEA',
  feea: 'FEEA',
  fseap: 'FEEA',
  facultateadeeconomieadministratiesiafaceri: 'FEEA',
  facultateadestiinteeconomicesiadministratiepublica: 'FEEA',
  fdsa: 'FDSA',
  facultateadedreptsistiinteadministrative: 'FDSA',
  flsc: 'FLSC'
};

function normalizeFacultyToken(value) {
  return normalizeDiacritics(value).replace(/[^a-z0-9]/g, '');
}

function mapFacultyCode(rawFaculty) {
  const normalizedFaculty = normalizeFacultyToken(rawFaculty);
  return FACULTY_ALIAS_MAP[normalizedFaculty] || String(rawFaculty || '').trim().toUpperCase();
}

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function loadTopics() {
  const fallbackTopics = [
    {
      id: 'FIESC-001',
      facultatea: 'FIESC',
      profesor: 'Prof.univ.dr.ing. Laureniu Dan MILICI',
      nivel_studii: 'Licenta',
      specializari: ['SE'],
      titlu_tema: 'Studiul caracteristicilor panourilor fotovoltaice flexibile'
    },
    {
      id: 'FIESC-002',
      facultatea: 'FIESC',
      profesor: 'Prof.univ.dr.ing. Adrian GRAUR',
      nivel_studii: 'Licenta',
      specializari: ['AIA'],
      titlu_tema: 'Sistem IoT de monitorizare a temperaturii'
    }
  ];

  try {
    const dataDir = join(__dirname, '../src/data');
    if (!fs.existsSync(dataDir)) {
      throw new Error('Data directory not found: src/data');
    }

    const topicFiles = fs
      .readdirSync(dataDir)
      .filter((fileName) => fileName.endsWith('Topics.js'));

    if (topicFiles.length === 0) {
      throw new Error('No *Topics.js files found in src/data');
    }

    console.log(`📂 Loading topic datasets from ${topicFiles.length} files...`);

    const loaded = [];
    for (const fileName of topicFiles) {
      const absoluteFile = join(dataDir, fileName);
      const moduleUrl = pathToFileURL(absoluteFile).href;
      const module = await import(moduleUrl);
      const topicArrays = Object.entries(module)
        .filter(([exportName, value]) => exportName.endsWith('Topics') && Array.isArray(value))
        .flatMap(([, value]) => value);

      if (topicArrays.length > 0) {
        loaded.push(...topicArrays);
        console.log(`   ✅ ${fileName}: ${topicArrays.length} topics`);
      } else {
        console.log(`   ⚠️ ${fileName}: no exported *Topics array found`);
      }
    }

    allTopics = loaded;
    console.log(`✅ Total loaded topics: ${allTopics.length}`);

    if (allTopics.length === 0) {
      throw new Error('Topic files were found but no topics were loaded');
    }
  } catch (error) {
    console.error('⚠️ Error loading topics:', error.message);
    allTopics = fallbackTopics;
    console.log(`⚠️ Using fallback topics: ${allTopics.length}`);
  }
}

function safeJsonParse(text) {
  const normalizedText = String(text || '').trim();

  try {
    return JSON.parse(normalizedText);
  } catch {
    const strippedFenceStart = normalizedText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      return JSON.parse(strippedFenceStart);
    } catch {
      // Continue with additional extraction strategies.
    }

    const jsonBlock = normalizedText.match(/```json\s*([\s\S]*?)```/i);
    if (jsonBlock && jsonBlock[1]) {
      try {
        return JSON.parse(jsonBlock[1]);
      } catch {
        return null;
      }
    }

    const arrayStart = normalizedText.indexOf('[');
    const arrayEnd = normalizedText.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(normalizedText.slice(arrayStart, arrayEnd + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}

function formatCandidateTopicsForContext(candidateTopics) {
  return candidateTopics
    .map((topic, index) => {
      return `${index + 1}. ID: ${topic.id} | Titlu: ${topic.titlu_tema}`;
    })
    .join('\n');
}

function trimField(value, maxLen = 260) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Nespecificat';
  }
  return normalized.length <= maxLen ? normalized : `${normalized.slice(0, maxLen)}...`;
}

function normalizeDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isStudentProposedTopic(topic) {
  const normalizedTitle = normalizeDiacritics(topic?.titlu_tema);
  return normalizedTitle.includes('teme propuse de studenti');
}

function topicMatchesSpecialization(topic, targetSpecialization) {
  const normalizedTarget = normalizeDiacritics(targetSpecialization);
  const topicSpecializations = Array.isArray(topic?.specializari) ? topic.specializari : [];

  return topicSpecializations.some((specialization) => {
    const normalizedSpec = normalizeDiacritics(specialization);
    return (
      normalizedSpec === normalizedTarget ||
      normalizedSpec === 'toateprogramele' ||
      normalizedSpec === 'toateprogramelesauprograme'
    );
  });
}

function extractLeanItemsFromText(rawText, allowedIds, requestedCount) {
  const text = String(rawText || '');
  const objectMatches = text.match(/\{[\s\S]*?\}/g) || [];
  const seen = new Set();
  const recovered = [];

  for (const objText of objectMatches) {
    const idMatch = objText.match(/"id"\s*:\s*"([^"]+)"/i);
    const explanationMatch = objText.match(/"matchExplanation"\s*:\s*"([\s\S]*?)(?:"\s*(?:,|\}|\]|$)|$)/i);
    if (!idMatch || !explanationMatch) {
      continue;
    }

    const id = String(idMatch[1] || '').trim();
    if (!id || seen.has(id) || (allowedIds && !allowedIds.has(id))) {
      continue;
    }

    const matchExplanation = String(explanationMatch[1] || '')
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    if (!matchExplanation) {
      continue;
    }

    seen.add(id);
    recovered.push({ id, matchExplanation });
    if (recovered.length >= requestedCount) {
      break;
    }
  }

  return recovered;
}

function parseGeminiError(error) {
  const message = String(error?.message || '');
  const isQuotaExceeded = /\[429 Too Many Requests\]|quota exceeded|rate[- ]?limit/i.test(message);
  const isServiceUnavailable = /\[503 Service Unavailable\]/i.test(message);

  let retryAfterSeconds = null;
  const retryInMatch = message.match(/retry in\s*([0-9]+(?:\.[0-9]+)?)s/i);
  const retryDelayMatch = message.match(/"retryDelay"\s*:\s*"([0-9]+)s"/i);
  const retryValue = retryInMatch?.[1] || retryDelayMatch?.[1];
  if (retryValue && Number.isFinite(Number(retryValue))) {
    retryAfterSeconds = Math.max(1, Math.ceil(Number(retryValue)));
  }

  return {
    isQuotaExceeded,
    isServiceUnavailable,
    retryAfterSeconds,
    message
  };
}

async function scoreTopicsWithDirectContext(studentProfile, candidateTopics, retries = 3) {
  if (!Array.isArray(candidateTopics) || candidateTopics.length === 0) {
    return [];
  }

  const topicsContext = formatCandidateTopicsForContext(candidateTopics);
  console.log(`\n🧠 Unified scoring: sending ${candidateTopics.length} candidate topics to Gemini`);
  console.log(`   Context size: ${topicsContext.length} chars`);

  const requestedCount = Math.min(6, candidateTopics.length);
  const allowedIds = new Set(candidateTopics.map((topic) => topic.id));
  const safeRetries = Math.max(3, Number(retries) || 3);

  for (let attempt = 1; attempt <= safeRetries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' });

      const prompt = `Esti un evaluator academic EXTREM DE STRICT.

PROFIL STUDENT:
- Specializare: ${trimField(studentProfile.specialization, 80)}
- Nivel studii: ${trimField(studentProfile.studyLevel, 40)}
- Competente: ${trimField(studentProfile.skills)}
- Domeniu aplicare: ${trimField(studentProfile.applicationDomain)} ⭐⭐⭐ FILTRU PRIMAR - TREBUIE MATCH EXACT
- Tip proiect dorit: ${trimField(studentProfile.projectType)} ⭐⭐⭐ FILTRU PRIMAR - TREBUIE MATCH EXACT
- Interese: ${trimField(studentProfile.interests)}
- Obiective de cariera: ${trimField(studentProfile.careerGoals)}

LISTA COMPLETA DE TEME DISPONIBILE:
${topicsContext}

CLARIFICARI CRITICE - CE INSEAMNA "APLICATIE PRACTICA (SOFTWARE/WEB/MOBILE)":
- ✅ Software applications: app-uri desktop/mobile, website-uri, platforme web, tool-uri software, API-uri, dashboard-uri, sistem de recomandare
- ✅ Web/mobile: aplicații React/Vue/Angular, backend API REST, mobile apps, progressive web apps
- ❌ Embedded systems: microcontrolere, firmware, IoT hardware monitoring, senzori, sisteme embedded (EXCLUZIUNE)
- ❌ Hardware projects: proiecte cu placi electronice, circuite, monitorizare hardware, sisteme electrice (EXCLUZIUNE)
- ❌ Pure monitoring: sisteme de monitorizare senzori, sisteme SCADA cu hardware (EXCLUZIUNE)

CLARIFICARI CRITICE - CE INSEAMNA "AI/DATA SCIENCE":
- ✅ Machine learning, image processing, NLP, predictive models, data analysis, neural networks
- ❌ Simple monitoring IoT with sensors (EXCLUZIUNE - asta e embedded, nu AI)
- ❌ Hardware + data (EXCLUZIUNE - data science trebuie fara hardware)

SARCINA STRICTA:
1. FILTRARE AGRESIVA: Elimina INSTANT orice tema care e hardware/embedded/IoT/monitoring - chiar daca are cuvinte "inteligent"
2. APOI: Din teme-le ramase DOAR software/app/web, alege exact ${requestedCount} cele mai bune
3. Ordoneaza de cea mai relevanta (1) la cea mai putin relevanta (${requestedCount})
4. Returneaza EXCLUSIV JSON array, fara markdown

Fiecare obiect: 2 chei doar
- id: string tema
- matchExplanation: exact 2 propozitii scurte (1=conexiune concreta la domeniu, 2=fit cu profilul student)

REGULI ABSOLUTE:
- Daca tema are hardware/senzori/embedded/IoT in titlu sau descriere → EXCLUDE DIN START
- Daca tema nu match domeniu → NU o incerca sa o retrofitezi
- RETURNEAZA EXACT ${requestedCount} teme
- Daca ai mai putin de ${requestedCount} teme BUNE, returneaza cat ai (nu compensa cu rele)
- Fara markdown, fara comentarii`;

      console.log(`   🔄 LLM attempt ${attempt}/${safeRetries}`);

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
          topP: 0.9,
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingBudget: 0
          },
          responseSchema: {
            type: FunctionDeclarationSchemaType.ARRAY,
            items: {
              type: FunctionDeclarationSchemaType.OBJECT,
              properties: {
                id: { type: FunctionDeclarationSchemaType.STRING },
                matchExplanation: { type: FunctionDeclarationSchemaType.STRING }
              },
              required: ['id', 'matchExplanation']
            }
          }
        }
      });
      const rawText = result.response.text().trim();
      const finishReason = result?.response?.candidates?.[0]?.finishReason || 'unknown';
      console.log(`   🧾 Finish reason: ${finishReason}`);
      console.log(`   🧾 Raw LLM response preview: ${rawText.slice(0, 280)}${rawText.length > 280 ? '...' : ''}`);
      const parsed = safeJsonParse(rawText);

      const parsedItems = Array.isArray(parsed)
        ? parsed
        : extractLeanItemsFromText(rawText, allowedIds, requestedCount);

      if (!Array.isArray(parsedItems)) {
        throw new Error('Unified scoring response is not a valid JSON array');
      }

      if (parsedItems.length === 0) {
        throw new Error('Unified scoring response contained no valid items');
      }

      if (parsedItems.length < requestedCount) {
        console.warn(`   ⚠️ Partial Gemini output detected: got ${parsedItems.length}/${requestedCount} items before deduplication`);
      }

      const invalidShape = parsedItems.find((item) =>
        !item ||
        typeof item.id !== 'string' ||
        !item.id.trim() ||
        !allowedIds.has(item.id.trim()) ||
        typeof item.matchExplanation !== 'string' ||
        !item.matchExplanation.trim()
      );

      if (invalidShape) {
        throw new Error('Unified scoring response contains invalid items (id/matchExplanation missing)');
      }

      const uniqueOrdered = [];
      const seen = new Set();
      for (const item of parsedItems) {
        const id = item.id.trim();
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        uniqueOrdered.push({
          id,
          matchExplanation: String(item.matchExplanation).trim()
        });
        if (uniqueOrdered.length >= requestedCount) {
          break;
        }
      }

      if (uniqueOrdered.length === 0) {
        throw new Error('Unified scoring response has no usable unique valid ids');
      }

      if (uniqueOrdered.length < requestedCount) {
        console.warn(`   ⚠️ Returning partial recommendation batch: ${uniqueOrdered.length}/${requestedCount} valid unique items`);
      }

      if (finishReason === 'MAX_TOKENS' || finishReason === 'SAFETY' || finishReason === 'OTHER') {
        console.warn(`   ⚠️ Gemini finished with ${finishReason}; partial output may be expected`);
      }

      console.log(`   ✅ Parsed ${uniqueOrdered.length} scored topics from LLM`);

      return uniqueOrdered;
    } catch (error) {
      const geminiError = parseGeminiError(error);
      if (geminiError.isQuotaExceeded) {
        const retryInfo = geminiError.retryAfterSeconds
          ? ` Retry after approximately ${geminiError.retryAfterSeconds} seconds.`
          : '';
        const quotaError = new Error(`Gemini quota exceeded.${retryInfo}`);
        quotaError.statusCode = 429;
        quotaError.retryAfterSeconds = geminiError.retryAfterSeconds;
        throw quotaError;
      }

      const delay = 1200 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 400);
      console.warn(`⚠️ Unified scoring attempt ${attempt}/${safeRetries} failed: ${error.message}`);
      if (attempt < safeRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error('Gemini could not generate valid lean recommendations after retries');
}

function scoreTextOverlap(studentProfile, topic) {
  const title = normalizeDiacritics(topic?.titlu_tema);
  if (!title) {
    return 0;
  }

  const profileText = [
    studentProfile?.skills,
    studentProfile?.interests,
    studentProfile?.applicationDomain,
    studentProfile?.projectType,
    studentProfile?.careerGoals,
    studentProfile?.specialization
  ]
    .filter(Boolean)
    .join(' ');

  const tokens = normalizeDiacritics(profileText)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);

  if (tokens.length === 0) {
    return 0;
  }

  const uniqueTokens = [...new Set(tokens)];
  let overlapHits = 0;
  for (const token of uniqueTokens) {
    if (title.includes(token)) {
      overlapHits += 1;
    }
    if (overlapHits >= 2) {
      break;
    }
  }

  if (overlapHits >= 2) {
    return 3;
  }
  if (overlapHits === 1) {
    return 2;
  }
  return 0;
}

function calculateLocalMatchScore(topic, studentProfile, rankIndex) {
  const baseScoresByRank = [95, 90, 86, 83, 80, 77, 74, 71, 68, 65];
  const safeRankIndex = Math.max(0, Number(rankIndex) || 0);
  const baseScore = Number.isFinite(baseScoresByRank[safeRankIndex])
    ? baseScoresByRank[safeRankIndex]
    : Math.max(55, 95 - safeRankIndex * 3);

  const overlapBonus = scoreTextOverlap(studentProfile, topic);
  const rawScore = Math.min(99, Math.max(0, baseScore + overlapBonus));
  return isStudentProposedTopic(topic) ? Math.min(rawScore, 15) : rawScore;
}

function mapLeanRecommendation(topic, llmItem, studentProfile, rankIndex) {
  const explanation = String(llmItem?.matchExplanation || '').trim();

  if (!explanation) {
    throw new Error(`Missing matchExplanation from Gemini for topic ${topic?.id || 'unknown'}`);
  }

  return {
    id: topic.id,
    title: topic.titlu_tema,
    professor: topic.profesor,
    matchExplanation: explanation,
    specialization: topic.specializari,
    level: topic.nivel_studii,
    matchScore: calculateLocalMatchScore(topic, studentProfile, rankIndex)
  };
}

function sortByMatchScoreDesc(items) {
  return [...items].sort((a, b) => {
    const scoreA = Number.isFinite(Number(a?.matchScore)) ? Number(a.matchScore) : 0;
    const scoreB = Number.isFinite(Number(b?.matchScore)) ? Number(b.matchScore) : 0;
    return scoreB - scoreA;
  });
}



app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'LICENTACONNECT Backend is running',
    engine: 'Google Gemini AI'
  });
});

app.post('/api/recommend', async (req, res) => {
  try {
    cleanupExpiredRecommendationSessions();

    const studentProfile = req.body;
    console.log('\n🎯 /api/recommend called');
    console.log(`   Faculty: ${studentProfile.faculty || '-'}`);
    console.log(`   Specialization: ${studentProfile.specialization}`);
    console.log(`   Study level: ${studentProfile.studyLevel}`);
    console.log(`   Domain: ${studentProfile.applicationDomain || '-'}`);
    console.log(`   Project type: ${studentProfile.projectType || '-'}`);

    if (!studentProfile.faculty || !studentProfile.specialization || !studentProfile.studyLevel) {
      return res.status(400).json({
        error: 'Missing required fields: faculty, specialization and studyLevel'
      });
    }

    const studyLevelMap = {
      licenta: 'Licență',
      disertatie: 'Masterat',
      masterat: 'Masterat',
      conversie: 'Conversie profesională'
    };

    const specializationMap = {
      calculatoare: 'C',
      c: 'C',
      'automatica si informatica aplicata': 'AIA',
      'automatică și informatică aplicată': 'AIA',
      aia: 'AIA',
      'retele si software de telecomunicatii': 'RST',
      'rețele și software de telecomunicații': 'RST',
      rst: 'RST',
      'sisteme electrice': 'SE',
      se: 'SE',
      'energetica si tehnologii informatice': 'ETI',
      'energetică și tehnologii informatice': 'ETI',
      eti: 'ETI',
      'echipamente si sisteme medicale': 'ESM',
      'echipamente și sisteme medicale': 'ESM',
      esm: 'ESM',
      'echipamente si sisteme de comanda si control pentru autovehicule': 'ESCCA',
      'echipamente și sisteme de comandă și control pentru autovehicule': 'ESCCA',
      escca: 'ESCCA',
      'managementul energiei': 'ME',
      me: 'ME',
      'stiinta si ingineria calculatoarelor': 'SIC',
      'știința și ingineria calculatoarelor': 'SIC',
      sic: 'SIC',
      'retele de comunicatii si calculatoare': 'RCC',
      'rețele de comunicații și calculatoare': 'RCC',
      rcc: 'RCC',
      'securitate cibernetica': 'SC',
      'securitate cibernetică': 'SC',
      sc: 'SC',
      'sisteme moderne pentru conducerea proceselor energetice': 'SMCPE',
      smcpe: 'SMCPE',
      'tehnici avansate in masini si actionari electrice': 'TAMAE',
      'tehnici avansate în mașini și acționări electrice': 'TAMAE',
      tamae: 'TAMAE',
      'tehnologia informatiei si a comunicatiilor': 'TIC',
      'tehnologia informației și a comunicațiilor': 'TIC',
      tic: 'TIC'
    };

    const normalizedStudyLevel = String(studentProfile.studyLevel || '').toLowerCase();
    const normalizedSpecialization = String(studentProfile.specialization || '').toLowerCase();

    const targetFaculty = mapFacultyCode(studentProfile.faculty);
    const targetStudyLevel = studyLevelMap[normalizedStudyLevel] || studentProfile.studyLevel;
    const targetSpecialization = specializationMap[normalizedSpecialization] || studentProfile.specialization;

    console.log(`   Mapped faculty: ${targetFaculty}`);
    console.log(`   Mapped specialization: ${targetSpecialization}`);
    console.log(`   Mapped level: ${targetStudyLevel}`);

    const candidateTopics = allTopics.filter((topic) =>
      mapFacultyCode(topic.facultatea) === targetFaculty &&
      normalizeDiacritics(topic.nivel_studii) === normalizeDiacritics(targetStudyLevel) &&
      topicMatchesSpecialization(topic, targetSpecialization)
    );

    console.log(`📚 Candidate topics after filtering: ${candidateTopics.length}`);
    if (candidateTopics.length > 0) {
      candidateTopics.slice(0, 3).forEach((topic, idx) => {
        console.log(`   ${idx + 1}. ${topic.id} | ${topic.titlu_tema}`);
      });
    }

    if (candidateTopics.length === 0) {
      return res.json({
        success: true,
        studentProfile,
        recommendations: [],
        hasMoreRecommendations: false,
        nextOffset: 0,
        totalCandidates: 0,
        totalRankedTopics: 0,
        message: 'No topics found for this specialization and study level'
      });
    }

    const regularTopics = candidateTopics.filter((topic) => !isStudentProposedTopic(topic));
    const studentProposedTopics = candidateTopics.filter((topic) => isStudentProposedTopic(topic));
    const basePoolTopics = regularTopics.length > 0 ? regularTopics : studentProposedTopics;
    const candidatePoolForInitial = basePoolTopics;

    const llmRankedItems = await scoreTopicsWithDirectContext(studentProfile, candidatePoolForInitial, 6);
    console.log(`🧠 LLM returned ${llmRankedItems.length} lean ranked entries for initial pool`);

    const candidateById = new Map(candidatePoolForInitial.map((topic) => [topic.id, topic]));
    const seenIds = new Set();
    const rankedTopicsByAi = llmRankedItems
      .map((item, index) => {
        if (seenIds.has(item.id)) {
          return null;
        }

        const topic = candidateById.get(item.id);
        if (!topic) {
          return null;
        }

        seenIds.add(item.id);
        return mapLeanRecommendation(topic, item, studentProfile, index);
      })
      .filter(Boolean);

    if (rankedTopicsByAi.length === 0) {
      throw new Error('Gemini did not return valid recommendations for the initial pool');
    }

    const sortedInitialPool = sortByMatchScoreDesc(rankedTopicsByAi);
    console.log(`✅ Built initial ranking from pool of ${sortedInitialPool.length} topics`);

    const initialBatchSize = 6;
    const initialBatch = sortedInitialPool.slice(0, initialBatchSize);

    const initialIds = new Set(initialBatch.map((item) => item.id));
    const initialPoolIds = new Set(candidatePoolForInitial.map((topic) => topic.id));

    const scoredInitialRemainder = sortedInitialPool
      .slice(initialBatchSize)
      .map((item) => candidateById.get(item.id))
      .filter(Boolean);

    const unscoredRegularRemainder = regularTopics.filter((topic) => !initialPoolIds.has(topic.id));
    const studentProposedRemainder = studentProposedTopics.filter((topic) => !initialIds.has(topic.id));
    const remainingTopics = [...scoredInitialRemainder, ...unscoredRegularRemainder, ...studentProposedRemainder];

    console.log(`📦 Initial batch: ${initialBatch.length}, remaining for load-more: ${remainingTopics.length}`);

    initialBatch.forEach((topic, idx) => {
      console.log(`   ${idx + 1}. [${topic.matchScore}%] ${topic.id} | ${topic.title}`);
    });

    const recommendationSessionId = randomUUID();
    recommendationSessions.set(recommendationSessionId, {
      createdAt: Date.now(),
      studentProfile,
      initialBatchSize,
      remainingTopics,
      nextRankIndex: initialBatchSize
    });

    return res.json({
      success: true,
      studentProfile,
      recommendations: initialBatch,
      hasMoreRecommendations: remainingTopics.length > 0,
      nextOffset: initialBatch.length,
      recommendationSessionId,
      totalCandidates: candidateTopics.length,
      totalRankedTopics: candidateTopics.length,
      engine: 'Google Gemini (gemini-2.5-flash lean output ranking)',
      message: 'Recommendations generated successfully using Lean Output ranking'
    });
  } catch (error) {
    console.error('❌ Error in /api/recommend:', error.message);
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode === 429 && Number.isFinite(Number(error?.retryAfterSeconds))) {
      res.setHeader('Retry-After', String(Math.max(1, Math.round(Number(error.retryAfterSeconds)))));
    }

    return res.status(statusCode).json({
      error: 'Failed to generate recommendations',
      details: error.message,
      retryAfterSeconds: Number.isFinite(Number(error?.retryAfterSeconds))
        ? Math.max(1, Math.round(Number(error.retryAfterSeconds)))
        : undefined
    });
  }
});

app.post('/api/recommend/more', async (req, res) => {
  try {
    cleanupExpiredRecommendationSessions();

    const { recommendationSessionId, offset = 0, limit = 6 } = req.body || {};

    if (!recommendationSessionId) {
      return res.status(400).json({ error: 'Missing recommendationSessionId' });
    }

    const session = recommendationSessions.get(recommendationSessionId);
    if (!session) {
      return res.status(404).json({ error: 'Recommendation session expired or not found' });
    }

    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Math.max(1, Math.min(10, Number(limit) || 6));
    const initialBatchSize = Number(session.initialBatchSize) || 6;

    if (!Array.isArray(session.remainingTopics)) {
      return res.status(409).json({ error: 'Recommendation session is missing remaining topics data' });
    }

    const deferredOffset = Math.max(0, safeOffset - initialBatchSize);
    const nextTopics = session.remainingTopics.slice(deferredOffset, deferredOffset + safeLimit);

    const deferredLlmScores = await scoreTopicsWithDirectContext(session.studentProfile, nextTopics, 5);
    const deferredTopicById = new Map(nextTopics.map((topic) => [topic.id, topic]));
    const deferredSeenIds = new Set();
    const batchRecommendations = deferredLlmScores
      .map((item, localIndex) => {
        if (deferredSeenIds.has(item.id)) {
          return null;
        }

        const topic = deferredTopicById.get(item.id);
        if (!topic) {
          return null;
        }

        deferredSeenIds.add(item.id);
        const continuousRankIndex = session.nextRankIndex + localIndex;
        return mapLeanRecommendation(topic, item, session.studentProfile, continuousRankIndex);
      })
      .filter(Boolean);

    if (batchRecommendations.length === 0) {
      throw new Error('Gemini did not return valid recommendations for the load-more batch');
    }

    const regularBatch = batchRecommendations.filter((item) => !isStudentProposedTopic({ titlu_tema: item.title }));
    const studentProposedBatch = batchRecommendations.filter((item) => isStudentProposedTopic({ titlu_tema: item.title }));
    const nextRecommendations = [...sortByMatchScoreDesc(regularBatch), ...sortByMatchScoreDesc(studentProposedBatch)];

    session.nextRankIndex += nextRecommendations.length;
    recommendationSessions.set(recommendationSessionId, session);

    console.log(`📥 /api/recommend/more -> offset=${safeOffset}, deferredOffset=${deferredOffset}, limit=${safeLimit}, returned=${nextRecommendations.length}`);

    const deferredNextOffset = deferredOffset + nextRecommendations.length;
    const nextOffset = initialBatchSize + deferredNextOffset;
    const totalRankedTopics = initialBatchSize + session.remainingTopics.length;

    return res.json({
      success: true,
      recommendations: nextRecommendations,
      hasMoreRecommendations: deferredNextOffset < session.remainingTopics.length,
      nextOffset,
      totalRankedTopics,
      recommendationSessionId
    });
  } catch (error) {
    console.error('❌ Error in /api/recommend/more:', error.message);
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode === 429 && Number.isFinite(Number(error?.retryAfterSeconds))) {
      res.setHeader('Retry-After', String(Math.max(1, Math.round(Number(error.retryAfterSeconds)))));
    }

    return res.status(statusCode).json({
      error: 'Failed to load more recommendations',
      details: error.message,
      retryAfterSeconds: Number.isFinite(Number(error?.retryAfterSeconds))
        ? Math.max(1, Math.round(Number(error.retryAfterSeconds)))
        : undefined
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  await loadTopics();

  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║   LICENTACONNECT Backend Server                        ║
║   Direct Context Matching Engine                       ║
║                                                        ║
║   Server running on: http://localhost:${PORT}          ║
║   Frontend: http://localhost:5173                      ║
║   AI Engine: Google Gemini (gemini-2.5-flash)          ║
║                                                        ║
║   Endpoints:                                           ║
║   • GET  /health                                       ║
║   • POST /api/recommend                                ║
║   • POST /api/recommend/more                           ║
╚════════════════════════════════════════════════════════╝
    `);
  });
}

startServer();
