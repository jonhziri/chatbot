const { generateGymReply } = require("./services/openaiService");

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u")
    .replace(/ß/g, "ss");
}

function tokenize(text) {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function similarityScore(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let matches = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  });

  return matches / Math.max(leftTokens.size, rightTokens.size);
}

function detectIntent(message) {
  const text = normalize(message);
  return {
    wantsHuman: /(mitarbeiter|berater|team|anrufen|rueckruf|zuruckgerufen|kontakt)/.test(text),
    isOpeningHours: /(offnungszeit|uhrzeit|wann offen|geoffnet|wochenende)/.test(text),
    isTrial: /(probetraining|probe|testen|testen kommen)/.test(text),
    isMembership: /(mitglied|mitgliedschaft|vertrag|laufzeit|kuendigung|preis|tarif)/.test(text),
    isCourses: /(kurs|kursplan|yoga|cycling|zumba|pilates)/.test(text),
    isLocation: /(adresse|standort|anfahrt|parkplatz)/.test(text),
    mentionsLeadData: /@|\d{3,}/.test(text)
  };
}

function detectTopic(intent) {
  if (intent.wantsHuman) return "Kontakt";
  if (intent.isTrial) return "Probetraining";
  if (intent.isMembership) return "Mitgliedschaften";
  if (intent.isCourses) return "Kurse";
  if (intent.isOpeningHours) return "Oeffnungszeiten";
  if (intent.isLocation) return "Standort";
  if (intent.mentionsLeadData) return "Lead";
  return "Generisch";
}

function stripGreetingPrefix(answer, profileName = "") {
  const text = String(answer || "").trim();
  if (!text) return text;

  const patterns = [];
  if (profileName) {
    const escapedName = String(profileName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    patterns.push(new RegExp(`^(hallo|hi|hey)\\s+${escapedName}\\s*,\\s*`, "i"));
  }
  patterns.push(/^(hallo|hi|hey)\s+[A-Za-zÀ-ÖØ-öø-ÿÄÖÜäöüß'-]{2,30}\s*,\s*/i);
  patterns.push(/^(hallo|hi|hey)\s*,\s*/i);

  let cleaned = text;
  patterns.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, "");
  });

  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : text;
}

async function resolveReply({ message, config, chat }) {
  const intent = detectIntent(message);
  const trainedAnswers = (chat.trainingEntries || [])
    .map((entry) => {
      const questionScore = similarityScore(message, entry.question);
      const keywordScore = (entry.keywords || []).length
        ? Math.max(...entry.keywords.map((keyword) => similarityScore(message, keyword)))
        : 0;
      return { entry, score: Math.max(questionScore, keywordScore) };
    })
    .sort((a, b) => b.score - a.score);

  const topTrainingMatches = trainedAnswers
    .filter((entry) => entry.score >= 0.2)
    .slice(0, 5)
    .map(({ entry, score }) => ({
      ...entry,
      similarity_score: score
    }));

  const topic = detectTopic(intent);
  const aiResult = await generateGymReply({
    message,
    config,
    chat,
    intent,
    matchedTrainingEntries: topTrainingMatches
  });

  if (aiResult.answer) {
    const bestTrainingMatch = trainedAnswers[0] && trainedAnswers[0].score >= 0.45 ? trainedAnswers[0] : null;
    return {
      answer: stripGreetingPrefix(aiResult.answer, chat.profile?.name || ""),
      meta: {
        source: "openai",
        topic: bestTrainingMatch?.entry.category || topic,
        trainingId: bestTrainingMatch?.entry.id,
        contactRequested: intent.wantsHuman,
        captureLead: intent.wantsHuman || (intent.mentionsLeadData && Boolean(chat.lead)),
        requiresLeadDetails: intent.wantsHuman
      }
    };
  }

  return {
    answer: `Ich bin mir gerade unsicher. ${config.humanEscalationText} ${config.fallbackContact}`,
    meta: {
      source: "fallback",
      topic: "Unklar",
      contactRequested: true,
      captureLead: true,
      error: aiResult.error || "Keine passende trainierte Antwort, Regel oder OpenAI-Antwort verfuegbar."
    }
  };
}

function createSessionId() {
  return `chat_${Date.now()}`;
}

function createMessage(role, content, meta = {}) {
  return {
    id: `msg_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    role,
    content,
    meta,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  resolveReply,
  createSessionId,
  createMessage,
  similarityScore
};
