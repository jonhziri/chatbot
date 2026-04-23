const OpenAI = require("openai");
const { syncKnowledgeSources } = require("./knowledgeSourceService");

function normalize(text) {
  return String(text || "")
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

function isCurrentOfferQuery(message) {
  return /(angebot|angebote|aktion|aktionen|preis|preise|tarif|mitgliedschaft|rabatt|deal|aktuell|derzeit|heute)/.test(
    normalize(message)
  );
}

function isWebsiteKnowledgeQuery(message) {
  return /(website|webseite|homepage|seite|link|kursseite|kursplan|angebot|aktion|preis|preise|oeffnungszeit|offnungszeiten)/.test(
    normalize(message)
  );
}

function scoreKnowledgeChunk(message, source, chunk) {
  const normalizedMessage = normalize(message);
  const baseScore = similarityScore(message, chunk);
  const titleScore = similarityScore(message, source.title || "");
  const urlScore = similarityScore(message, source.url || "");
  let boost = 0;

  if (isCurrentOfferQuery(message) && /(angebot|aktion|preis|mitglied|mitgliedschaft)/.test(normalize(chunk))) {
    boost += 0.24;
  }

  if (isCurrentOfferQuery(message) && /(angebot|aktion|preis)/.test(normalize(source.title || ""))) {
    boost += 0.16;
  }

  if (isWebsiteKnowledgeQuery(message) && /jonfit\.de\/?$/.test(String(source.url || "").replace(/\/+$/, ""))) {
    boost += 0.08;
  }

  if (isWebsiteKnowledgeQuery(message) && /(kurse|kursplan)/.test(normalizedMessage) && /(kurse|kursplan)/.test(normalize(source.url || ""))) {
    boost += 0.18;
  }

  return Math.max(baseScore, titleScore * 0.75, urlScore * 0.6) + boost;
}

async function ensureKnowledgeSourcesReady(message, knowledgeSources) {
  const sources = Array.isArray(knowledgeSources) ? knowledgeSources : [];
  if (!sources.length) {
    return [];
  }

  const hasUnsyncedSources = sources.some((source) =>
    ["not_synced", "pending", "error"].includes(source.status)
  );
  const hasSyncedSources = sources.some((source) => source.status === "synced");
  const needsFreshWebsiteContext = isWebsiteKnowledgeQuery(message) || isCurrentOfferQuery(message);

  if (!needsFreshWebsiteContext) {
    return sources;
  }

  if (!hasUnsyncedSources && hasSyncedSources) {
    return sources;
  }

  try {
    return await syncKnowledgeSources(sources, { force: true });
  } catch (error) {
    return sources;
  }
}

function buildKnowledgeSourceContext(message, knowledgeSources) {
  const syncedSources = (knowledgeSources || []).filter((source) => source.status === "synced");
  const chunks = [];

  syncedSources.forEach((source) => {
    const sourceChunks = Array.isArray(source.contentChunks) && source.contentChunks.length
      ? source.contentChunks
      : (source.content ? [source.content] : []);

    sourceChunks.forEach((chunk, index) => {
      chunks.push({
        sourceTitle: source.title || source.url,
        url: source.url,
        chunkIndex: index,
        text: chunk,
        score: scoreKnowledgeChunk(message, source, chunk)
      });
    });
  });

  const bestChunks = chunks
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return bestChunks.length
    ? bestChunks
        .map((chunk) => {
          return `[Quelle: ${chunk.sourceTitle} | ${chunk.url} | Abschnitt ${chunk.chunkIndex + 1} | Relevanz ${chunk.score.toFixed(2)}]\n${chunk.text}`;
        })
        .join("\n\n")
    : "Keine synchronisierten Webseiteninhalte vorhanden.";
}

function buildRelevantLinks(message, knowledgeSources) {
  const normalizedMessage = normalize(message);
  const canonicalLinks = [];

  if (/probetraining|probetraining.*trainer|trainer.*probetraining/.test(normalizedMessage)) {
    canonicalLinks.push({
      url: "https://www.jonfit.de/pbmittrainer",
      title: "Probetraining mit Trainer buchen",
      score: 1.2
    });
  }

  if (/probetraining.*ohne trainer|ohne trainer.*probetraining/.test(normalizedMessage)) {
    canonicalLinks.unshift({
      url: "https://www.jonfit.de/pbohnetrainer",
      title: "Probetraining ohne Trainer",
      score: 1.3
    });
  }

  const sources = (knowledgeSources || [])
    .filter((source) => source.url)
    .map((source) => ({
      url: source.url,
      title: source.title || source.url,
      score: Math.max(
        similarityScore(message, source.url),
        similarityScore(message, source.title || ""),
        similarityScore(message, source.excerpt || ""),
        ...(Array.isArray(source.contentChunks)
          ? source.contentChunks.slice(0, 3).map((chunk) => similarityScore(message, chunk))
          : [0])
      )
    }));

  const bestLinks = [...canonicalLinks, ...sources]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return bestLinks.length
    ? bestLinks.map((source) => `- ${source.title}: ${source.url}`).join("\n")
    : "Keine passenden Website-Links verfuegbar.";
}

function buildLinkInstructions(message) {
  const normalizedMessage = normalize(message);

  if (/probetraining.*ohne trainer|ohne trainer.*probetraining/.test(normalizedMessage)) {
    return "Bei Probetraining ohne Trainer nutze als direkten Link exakt: https://www.jonfit.de/pbohnetrainer";
  }

  if (/probetraining|probe|testen/.test(normalizedMessage)) {
    return "Bei Probetraining mit Trainer oder allgemeiner Probetraining-Buchung nutze als direkten Link exakt: https://www.jonfit.de/pbmittrainer";
  }

  return "Keine spezielle Link-Regel fuer diese Anfrage.";
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

async function generateGymReply({ message, config, chat, intent = {}, matchedTrainingEntries = [] }) {
  if (config.llmEnabled === false) {
    return {
      answer: null,
      error: "OpenAI ist in der Konfiguration deaktiviert."
    };
  }

  const client = getOpenAIClient();
  if (!client) {
    return {
      answer: null,
      error: "OPENAI_API_KEY ist nicht gesetzt. OpenAI-Antworten koennen nur serverseitig erzeugt werden."
    };
  }

  const prioritizedTrainingEntries = matchedTrainingEntries.length
    ? matchedTrainingEntries
    : (chat?.trainingEntries || []).slice(0, 10);
  const trainingContext = prioritizedTrainingEntries
    .map((entry) => {
      const keywords = (entry.keywords || []).join(", ");
      const similarity = typeof entry.similarity_score === "number"
        ? `\nAehnlichkeit: ${entry.similarity_score.toFixed(2)}`
        : "";
      return `Kategorie: ${entry.category || "Training"}\nFrage: ${entry.question}\nAntwort: ${entry.improved_answer}${keywords ? `\nKeywords: ${keywords}` : ""}${similarity}`;
    })
    .join("\n\n");
  const recentConversation = (chat?.messages || [])
    .slice(-8)
    .map((entry) => `${entry.role === "assistant" ? "Bot" : "Nutzer"}: ${entry.content}`)
    .join("\n");
  const preparedKnowledgeSources = await ensureKnowledgeSourcesReady(message, config.knowledgeSources || []);
  const knowledgePrompt = config.knowledgePrompt || "";
  const knowledgeSources = preparedKnowledgeSources
    .map((source) => `- ${source.url} [Status: ${source.status}${source.syncMessage ? `, Hinweis: ${source.syncMessage}` : ""}]`)
    .join("\n");
  const knowledgeSourceContext = buildKnowledgeSourceContext(message, preparedKnowledgeSources);
  const relevantLinks = buildRelevantLinks(message, preparedKnowledgeSources);
  const linkInstructions = buildLinkInstructions(message);
  const botTone = config.botTone || "freundlich, professionell und klar";
  const botGoal = config.botGoal || "Nutzer hilfreich durch ihre Anfrage fuehren";
  const forbiddenStatements = config.forbiddenStatements || "Keine speziellen Ausschluesse hinterlegt.";
  const leadRule = config.leadRule || "Frage nur dann nach Kontaktdaten, wenn es fuer die Anfrage sinnvoll ist.";
  const intentFlags = Object.entries(intent)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key)
    .join(", ");

  const systemPrompt = [
    "Du bist der deutschsprachige Assistent des Fitnessstudios JonFit.",
    `Bot-Name: ${config.botName || "JonFit Assist"}`,
    `Status: ${config.botStatus || "draft"}`,
    `Tonalitaet: ${botTone}`,
    `Ziel des Bots: ${botGoal}`,
    "Du sollst jede fachliche Antwort auf Basis des folgenden Kontexts mit OpenAI formulieren.",
    "Der Wissensprompt ist die zentrale Leitlinie fuer Verhalten, Ton und stabile Bot-Regeln.",
    "Fuer aktuelle Angebote, Aktionen, Preise, Kursplaene, Oeffnungszeiten und konkrete Website-Inhalte haben synchronisierte Webseiteninhalte Vorrang vor pauschalen Prompt-Notizen.",
    "Wenn sich Wissensprompt und synchronisierte Website-Inhalte widersprechen, folge den synchronisierten Website-Inhalten.",
    "Alte oder beispielhafte Aktionspreise aus dem Wissensprompt duerfen niemals als aktuelles Angebot dargestellt werden.",
    "Wenn fuer eine aktuelle Frage keine belastbare Website-Grundlage vorliegt, sage klar, dass du den aktuellen Stand gerade nicht sicher bestaetigen kannst.",
    "Antworte sehr kurz, hilfreich, serviceorientiert und kontextbezogen.",
    "Halte Antworten im Regelfall bei maximal 1 bis 2 kurzen Saetzen.",
    "Keine langen Listen im Chat. Nenne hoechstens 2 bis 3 Beispiele, ausser der Nutzer fragt ausdruecklich nach einer vollstaendigen Liste.",
    "Bei Kursfragen: kurz bestaetigen, dass es Kurse gibt, 2 bis 3 Beispiele nennen und den direkten Link zur Kursseite anbieten.",
    "Greife Folgefragen aus dem bisherigen Chatverlauf logisch auf und wiederhole nicht stumpf dieselbe Antwort.",
    "Beginne Antworten nicht staendig mit 'Hallo Name' oder aehnlichen Begruessungen.",
    "Nutze den Namen des Nutzers nur sparsam und nur dann, wenn es natuerlich wirkt.",
    "Wenn eine passende Website, Kursseite, Terminseite oder Buchungsseite vorhanden ist, biete aktiv an, den direkten Link zu senden.",
    "Formuliere dieses Angebot natuerlich, zum Beispiel: 'Wenn du magst, schicke ich dir direkt den Link.'",
    "Wenn du einen Link anbietest oder sendest, halte die Nachricht extra kurz.",
    "Gib Links niemals als Markdown-Link aus. Keine Syntax wie [Text](https://...).",
    "Wenn ein Link wirklich gesendet werden soll, schreibe maximal eine normale URL separat, damit das Frontend daraus einen Button erstellen kann.",
    "Schreibe die nackte URL nicht noch einmal in den Fliesstext, wenn der Link als separater Button oder Link dargestellt werden kann.",
    "Nutze nur Informationen, die durch den bereitgestellten Kontext plausibel gedeckt sind.",
    "Wenn der Kontext fuer eine sichere Aussage nicht ausreicht, sage das offen und verweise freundlich an das Team.",
    `Verbotene Aussagen: ${forbiddenStatements}`,
    `Lead-Regel: ${leadRule}`,
    `Kontakt-Hinweis fuer Unsicherheit: ${config.fallbackContact}`,
    "Trainingsdaten duerfen direkt genutzt werden, wenn sie zur Frage passen und nicht im Widerspruch zu aktuelleren Website-Inhalten stehen.",
    "Externe Quellen sind kein Deko-Kontext, sondern sollen bei aktuellen Website-Fragen aktiv ausgewertet werden.",
    "Trainingsdaten sollen bevorzugt beruecksichtigt werden, aber die Antwort soll trotzdem frei und passend formuliert werden.",
    "Erfinde keine Details zu Preisen, Ausstattung, Standort oder Verfuegbarkeit.",
    intentFlags ? `Erkannte Signale zur Anfrage: ${intentFlags}` : "Erkannte Signale zur Anfrage: keine besonderen Flags.",
    "",
    "Zentrale Wissensbasis / Systemanweisung:",
    knowledgePrompt || "Keine zusaetzliche Systemanweisung hinterlegt.",
    "",
    "Trainingsdaten:",
    trainingContext || "Keine Trainingsdaten hinterlegt.",
    "",
    "Externe Wissensquellen:",
    knowledgeSources || "Keine externen Quellen hinterlegt.",
    "",
    "Passende Website-Links:",
    relevantLinks,
    "",
    "Verbindliche Link-Regel:",
    linkInstructions,
    "",
    "Synchronisierte Webseiteninhalte:",
    knowledgeSourceContext,
    "",
    "Bisheriger Chatverlauf:",
    recentConversation || "Noch kein Verlauf vorhanden."
  ].join("\n");

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: `Nutzeranfrage: ${message}` }]
        }
      ]
    });

    return {
      answer: response.output_text ? response.output_text.trim() : null,
      error: null
    };
  } catch (error) {
    return {
      answer: null,
      error: error.message || "OpenAI-Anfrage fehlgeschlagen."
    };
  }
}

module.exports = {
  getOpenAIClient,
  generateGymReply
};
