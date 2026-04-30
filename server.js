require("dotenv").config();

const express = require("express");
const path = require("path");
const {
  ensureDataFiles,
  getConfig,
  saveConfig,
  getChats,
  saveChats,
  getLeads,
  saveLeads,
  getTrainingEntries,
  saveTrainingEntries,
  normalizeTrainingEntry
} = require("./src/storage");
const { resolveReply, createSessionId, createMessage } = require("./src/knowledge");
const { parseKnowledgeSources, syncKnowledgeSources } = require("./src/services/knowledgeSourceService");

const app = express();
const PORT = process.env.PORT || 3000;

ensureDataFiles();

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/widget", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "widget.html"));
});

app.get("/widget-simple", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "widget-simple.html"));
});

app.get("/widget-sample", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "widget-simple.html"));
});

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createChatSession(sessionId, config) {
  return {
    id: sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "neu",
    contactRequested: false,
    trained: false,
    correctionCount: 0,
    adminNote: "",
    awaitingName: true,
    pendingNameIntent: "",
    awaitingLeadDetails: false,
    activeTopic: "",
    lastCompletedTopic: "",
    profile: {
      name: ""
    },
    lead: null,
    messages: [createMessage("assistant", config.welcomeMessage)]
  };
}

function hydrateChatSession(chat, config) {
  if (!chat) {
    return createChatSession(createSessionId(), config);
  }

  return {
    ...createChatSession(chat.id || createSessionId(), config),
    ...chat,
    profile: {
      name: "",
      ...(chat.profile || {})
    },
    lead: chat.lead || null,
    messages: Array.isArray(chat.messages) ? chat.messages : [createMessage("assistant", config.welcomeMessage)],
    awaitingName: Boolean(chat.awaitingName),
    pendingNameIntent: String(chat.pendingNameIntent || ""),
    awaitingLeadDetails: Boolean(chat.awaitingLeadDetails),
    activeTopic: String(chat.activeTopic || ""),
    lastCompletedTopic: String(chat.lastCompletedTopic || "")
  };
}

function hasUserInteraction(chat) {
  return Boolean(chat?.messages?.some((message) => message.role === "user" && String(message.content || "").trim()));
}

async function getInteractiveChats() {
  return (await getChats()).filter(hasUserInteraction);
}

function looksLikeName(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (text.length < 2 || text.length > 40) return false;
  if (/\d|@|https?:|www\./i.test(text)) return false;

  const lowered = text.toLowerCase();
  const exactBlockedPhrases = new Set([
    "hallo",
    "hi",
    "hey",
    "moin",
    "servus",
    "gruezi",
    "gruess gott",
    "guten morgen",
    "guten tag",
    "guten abend",
    "na",
    "yo"
  ]);
  if (exactBlockedPhrases.has(lowered)) return false;

  const blockedPatterns = [
    /\b(hallo|hi|hey|moin|servus|gruess gott|gruezi|guten morgen|guten tag|guten abend|ich|brauche|moechte|möchte|habe|will|suche|frage|problem|hilfe|rueckruf|rückruf|probetraining|mitgliedschaft|vertrag|preis|preise|oeffnungszeiten|öffnungszeiten|kurs|kontakt)\b/,
    /\?/,
    /[.!,:;]/
  ];
  if (blockedPatterns.some((pattern) => pattern.test(lowered))) return false;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 3) return false;

  return words.every((word) => /^[A-Za-zÀ-ÖØ-öø-ÿÄÖÜäöüß'-]{2,}$/.test(word));
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

function normalizeTopicKey(topic) {
  return String(topic || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .trim();
}

function extractLeadDetails(message, existingName = "") {
  const text = String(message || "").trim();
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(?:\+?\d[\d\s/()-]{6,}\d)/);
  const nameMatch = text
    .split(/[,;|]/)[0]
    .trim()
    .match(/^[A-Za-zÀ-ÖØ-öø-ÿÄÖÜäöüß' -]{2,}$/);

  return {
    name: (nameMatch ? nameMatch[0].trim() : "") || existingName,
    email: emailMatch ? emailMatch[0].trim() : "",
    phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, " ").trim() : "",
    notes: text
  };
}

function hasUsableLeadContact(lead) {
  return Boolean(lead?.phone || lead?.email);
}

function buildLeadCompletionReply(chat) {
  const name = chat.profile?.name ? `, ${chat.profile.name}` : "";
  const topic = normalizeTopicKey(chat.activeTopic);

  if (topic === "kontakt") {
    return `Danke${name}. Ich habe deine Rueckruf-Anfrage aufgenommen und an unser Team weitergegeben. Wir melden uns so schnell wie moeglich bei dir. Gibt es sonst noch etwas, wobei ich dir helfen kann?`;
  }

  if (topic === "probetraining") {
    return `Danke${name}. Ich habe deine Anfrage zum Probetraining aufgenommen. Unser Team meldet sich bei dir, um den Termin mit dir abzustimmen. Gibt es sonst noch etwas, wobei ich dir helfen kann?`;
  }

  if (topic === "mitgliedschaften") {
    return `Danke${name}. Ich habe deine Anfrage notiert und an unser Team weitergegeben. Wir melden uns bei dir, damit ihr die Mitgliedschaft gemeinsam abstimmen koennt. Gibt es sonst noch etwas, wobei ich dir helfen kann?`;
  }

  return `Danke${name}. Ich habe deine Anfrage aufgenommen und an unser Team weitergegeben. Gibt es sonst noch etwas, wobei ich dir helfen kann?`;
}

function buildLeadReminderReply(chat) {
  const topic = normalizeTopicKey(chat.activeTopic);

  if (topic === "kontakt") {
    return "Ich schliesse zuerst gern deine Rueckruf-Anfrage ab. Bitte sende mir dazu noch deine Telefonnummer oder E-Mail-Adresse, damit unser Team dich erreichen kann.";
  }

  if (topic === "probetraining") {
    return "Ich schliesse zuerst gern deine Probetraining-Anfrage ab. Bitte sende mir dazu noch deine Telefonnummer oder E-Mail-Adresse, damit das Team den Termin mit dir abstimmen kann.";
  }

  if (topic === "mitgliedschaften") {
    return "Ich schliesse zuerst gern deine Anfrage ab. Bitte sende mir dazu noch deine Telefonnummer oder E-Mail-Adresse, damit unser Team dich erreichen kann.";
  }

  return "Bevor wir ein neues Thema starten, schliessen wir kurz deine offene Anfrage ab. Bitte sende mir dazu noch deine Telefonnummer oder E-Mail-Adresse.";
}

function ensureUserMessageRecorded(chat, message) {
  const lastMessage = chat.messages[chat.messages.length - 1];
  if (lastMessage?.role === "user" && String(lastMessage.content || "").trim() === String(message || "").trim()) {
    return;
  }
  chat.messages.push(createMessage("user", message));
}

async function processChatMessage({ chat, message, config, trainingEntries }) {
  if (chat.awaitingName) {
    if (!looksLikeName(message)) {
      chat.pendingNameIntent = message.trim();
      const reply = "Bevor ich dir weiterhelfe: Wie ist dein Vorname?";
      chat.messages.push(createMessage("assistant", reply, { source: "system", topic: "Namensabfrage" }));

      return {
        reply,
        meta: { source: "system", topic: "Namensabfrage" }
      };
    }

    chat.profile = {
      ...(chat.profile || {}),
      name: message.trim()
    };
    chat.awaitingName = false;
    const pendingIntent = String(chat.pendingNameIntent || "").trim();
    chat.pendingNameIntent = "";

    if (pendingIntent) {
      const resumedResult = await resolveReply({
        message: pendingIntent,
        config,
        chat: {
          ...chat,
          trainingEntries
        }
      });

      if (resumedResult.meta.requiresLeadDetails) {
        chat.awaitingLeadDetails = true;
        chat.activeTopic = resumedResult.meta.topic || chat.activeTopic || "";
      } else {
        chat.awaitingLeadDetails = false;
        chat.activeTopic = resumedResult.meta.topic || "";
      }

      const reply = `Danke dir, ${chat.profile.name}. ${stripGreetingPrefix(resumedResult.answer, chat.profile.name)}`;
      chat.messages.push(createMessage("assistant", reply, {
        ...resumedResult.meta,
        resumedFromNamePrompt: true
      }));
      chat.contactRequested = resumedResult.meta.contactRequested || chat.contactRequested;

      return {
        reply,
        meta: {
          ...resumedResult.meta,
          resumedFromNamePrompt: true
        }
      };
    }

    const reply = `Danke dir, ${chat.profile.name}. Wie kann ich dir weiterhelfen?`;
    chat.messages.push(createMessage("assistant", reply, { source: "system", topic: "Begruessung" }));

    return {
      reply,
      meta: { source: "system", topic: "Begruessung" }
    };
  }

  if (chat.awaitingLeadDetails) {
    const leadDetails = extractLeadDetails(message, chat.profile?.name || "");

    if (hasUsableLeadContact(leadDetails)) {
      chat.lead = {
        ...(chat.lead || {}),
        ...leadDetails,
        updatedAt: new Date().toISOString()
      };
      chat.awaitingLeadDetails = false;
      chat.lastCompletedTopic = chat.activeTopic || chat.lastCompletedTopic || "";
      const reply = buildLeadCompletionReply(chat);
      const completedTopic = chat.activeTopic || "Kontakt";
      chat.activeTopic = "";
      chat.messages.push(createMessage("assistant", reply, {
        source: "system",
        topic: completedTopic,
        captureLead: true,
        flowCompleted: true
      }));

      return {
        reply,
        meta: {
          source: "system",
          topic: completedTopic,
          captureLead: true,
          flowCompleted: true
        }
      };
    }

    const reply = buildLeadReminderReply(chat);
    chat.messages.push(createMessage("assistant", reply, {
      source: "system",
      topic: chat.activeTopic || "Kontakt",
      awaitingLeadDetails: true
    }));

    return {
      reply,
      meta: {
        source: "system",
        topic: chat.activeTopic || "Kontakt",
        awaitingLeadDetails: true
      }
    };
  }

  const result = await resolveReply({
    message,
    config,
    chat: {
      ...chat,
      trainingEntries
    }
  });

  if (result.meta.requiresLeadDetails) {
    chat.awaitingLeadDetails = true;
    chat.activeTopic = result.meta.topic || chat.activeTopic || "";
  } else if (result.meta.topic) {
    chat.activeTopic = result.meta.topic;
  }

  chat.messages.push(createMessage("assistant", result.answer, result.meta));
  chat.contactRequested = result.meta.contactRequested || chat.contactRequested;

  return {
    reply: result.answer,
    meta: result.meta
  };
}

app.get("/api/public/config", asyncHandler(async (req, res) => {
  const config = await getConfig();
  res.json({
    name: config.gymName,
    botName: config.botName,
    botAvatarUrl: config.botAvatarUrl,
    welcomeMessage: config.welcomeMessage,
    humanEscalationText: config.humanEscalationText
  });
}));

app.post("/api/chat/start", asyncHandler(async (req, res) => {
  const sessionId = createSessionId();
  const config = await getConfig();
  res.json(createChatSession(sessionId, config));
}));

app.post("/api/chat/message", asyncHandler(async (req, res) => {
  const { sessionId, message, lead } = req.body || {};
  if (!sessionId || !message) {
    return res.status(400).json({ error: "sessionId und message sind erforderlich." });
  }

  const chats = await getChats();
  const config = await getConfig();
  const trainingEntries = await getTrainingEntries();
  let chat = chats.find((entry) => entry.id === sessionId);
  let chatIndex = chats.findIndex((entry) => entry.id === sessionId);

  if (!chat) {
    chat = createChatSession(sessionId, config);
    chats.unshift(chat);
    chatIndex = 0;
  }
  chat = hydrateChatSession(chat, config);
  chats[chatIndex] = chat;

  if (lead && (lead.name || lead.email || lead.phone)) {
    chat.lead = {
      name: lead.name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      notes: lead.notes || "",
      updatedAt: new Date().toISOString()
    };
  }

  ensureUserMessageRecorded(chat, message);

  const result = await processChatMessage({
    chat,
    message,
    config,
    trainingEntries
  });

  if (result.meta.captureLead && chat.lead) {
    const leads = await getLeads();
    const existing = leads.find((entry) => entry.chatId === chat.id);
    const leadPayload = {
      id: existing ? existing.id : `lead_${Date.now()}`,
      chatId: chat.id,
      source: "website-chatbot",
      status: existing ? existing.status : "neu",
      topic: result.meta.topic || "Allgemeine Anfrage",
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...chat.lead
    };

    const nextLeads = existing
      ? leads.map((entry) => (entry.chatId === chat.id ? leadPayload : entry))
      : [leadPayload, ...leads];

    await saveLeads(nextLeads);
  }

  await saveChats(chats);
  res.json({
    sessionId,
    reply: result.reply,
    meta: result.meta,
    chat
  });
}));

app.get("/api/admin/chats", asyncHandler(async (req, res) => {
  res.json(await getInteractiveChats());
}));

app.patch("/api/admin/chats/:id", asyncHandler(async (req, res) => {
  const chats = await getChats();
  const chat = chats.find((entry) => entry.id === req.params.id);
  if (!chat) {
    return res.status(404).json({ error: "Chat nicht gefunden." });
  }

  const allowed = ["status", "adminNote", "trained", "correctionCount", "openedAt"];
  allowed.forEach((key) => {
    if (key in (req.body || {})) {
      chat[key] = req.body[key];
    }
  });
  chat.updatedAt = new Date().toISOString();
  await saveChats(chats);
  res.json(chat);
}));

async function deleteChatById(req, res) {
  const chats = await getChats();
  const nextChats = chats.filter((entry) => entry.id !== req.params.id);
  if (nextChats.length === chats.length) {
    return res.status(404).json({ error: "Chat nicht gefunden." });
  }

  const leads = await getLeads();
  await saveChats(nextChats);
  await saveLeads(leads.filter((entry) => entry.chatId !== req.params.id));
  res.status(204).end();
}

app.post("/api/admin/chats/bulk-delete", asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];
  if (!ids.length) {
    return res.status(400).json({ error: "Mindestens eine Chat-ID ist erforderlich." });
  }

  const idSet = new Set(ids);
  const chats = await getChats();
  const deletedIds = chats.filter((entry) => idSet.has(entry.id)).map((entry) => entry.id);
  if (!deletedIds.length) {
    return res.status(404).json({ error: "Keine passenden Chats gefunden." });
  }

  const leads = await getLeads();
  await saveChats(chats.filter((entry) => !idSet.has(entry.id)));
  await saveLeads(leads.filter((entry) => !idSet.has(entry.chatId)));
  res.json({ deletedIds });
}));

app.delete("/api/admin/chats/:id", asyncHandler(deleteChatById));
app.delete("/api/admin/chat/:id", asyncHandler(deleteChatById));
app.delete("/api/chats/:id", asyncHandler(deleteChatById));

app.get("/api/admin/leads", asyncHandler(async (req, res) => {
  res.json(await getLeads());
}));

app.patch("/api/admin/leads/:id", asyncHandler(async (req, res) => {
  const leads = await getLeads();
  const lead = leads.find((entry) => entry.id === req.params.id);
  if (!lead) {
    return res.status(404).json({ error: "Lead nicht gefunden." });
  }

  Object.assign(lead, req.body || {}, { updatedAt: new Date().toISOString() });
  await saveLeads(leads);
  res.json(lead);
}));

app.get("/api/admin/training", asyncHandler(async (req, res) => {
  const entries = await getTrainingEntries();
  const { search, category, keyword } = req.query;

  const filtered = entries.filter((entry) => {
    const matchesSearch = search
      ? `${entry.question} ${entry.improved_answer} ${(entry.keywords || []).join(" ")}`.toLowerCase().includes(String(search).toLowerCase())
      : true;
    const matchesCategory = category ? entry.category === category : true;
    const matchesKeyword = keyword
      ? (entry.keywords || []).some((item) => item.toLowerCase() === String(keyword).toLowerCase())
      : true;
    return matchesSearch && matchesCategory && matchesKeyword;
  });

  res.json(filtered);
}));

app.post("/api/admin/training", asyncHandler(async (req, res) => {
  const {
    question,
    improvedAnswer,
    keywords,
    category,
    sourceChatId,
    previousBotAnswer,
    createdBy
  } = req.body || {};
  if (!question || !improvedAnswer) {
    return res.status(400).json({ error: "question und improvedAnswer sind erforderlich." });
  }

  const trainingEntries = await getTrainingEntries();
  const now = new Date().toISOString();
  const entry = normalizeTrainingEntry({
    id: `training_${Date.now()}`,
    question,
    improved_answer: improvedAnswer,
    keywords: Array.isArray(keywords) ? keywords : [],
    category: category || "Allgemein",
    source_chat_id: sourceChatId || null,
    previous_bot_answer: previousBotAnswer || "",
    created_at: now,
    updated_at: now,
    created_by: createdBy || "admin"
  });

  trainingEntries.unshift(entry);
  await saveTrainingEntries(trainingEntries);

  if (sourceChatId) {
    const chats = await getChats();
    const chat = chats.find((item) => item.id === sourceChatId);
    if (chat) {
      chat.trained = true;
      chat.correctionCount = (chat.correctionCount || 0) + 1;
      chat.status = chat.status === "neu" ? "zu pruefen" : chat.status;
      chat.updatedAt = new Date().toISOString();
      await saveChats(chats);
    }
  }

  res.status(201).json(entry);
}));

app.put("/api/admin/training/:id", asyncHandler(async (req, res) => {
  const trainingEntries = await getTrainingEntries();
  const index = trainingEntries.findIndex((entry) => entry.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Trainingseintrag nicht gefunden." });
  }

  const current = trainingEntries[index];
  trainingEntries[index] = normalizeTrainingEntry({
    ...current,
    ...req.body,
    id: current.id,
    updated_at: new Date().toISOString()
  });
  await saveTrainingEntries(trainingEntries);
  res.json(trainingEntries[index]);
}));

app.delete("/api/admin/training/:id", asyncHandler(async (req, res) => {
  const trainingEntries = await getTrainingEntries();
  const next = trainingEntries.filter((entry) => entry.id !== req.params.id);
  if (next.length === trainingEntries.length) {
    return res.status(404).json({ error: "Trainingseintrag nicht gefunden." });
  }

  await saveTrainingEntries(next);
  res.status(204).end();
}));

app.get("/api/admin/config", asyncHandler(async (req, res) => {
  res.json({
    ...await getConfig(),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini"
  });
}));

app.put("/api/admin/config", asyncHandler(async (req, res) => {
  const current = await getConfig();
  const next = {
    ...current,
    ...req.body
  };
  await saveConfig(next);
  res.json(next);
}));

app.post("/api/admin/preview/reply", asyncHandler(async (req, res) => {
  const { message, config: draftConfig, profileName, chatState } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: "message ist erforderlich." });
  }

  const trainingEntries = await getTrainingEntries();
  const config = {
    ...await getConfig(),
    ...(draftConfig || {})
  };

  const previewChat = hydrateChatSession({
    id: "preview_chat",
    ...(chatState || {}),
    profile: {
      name: profileName || chatState?.profile?.name || ""
    }
  }, config);

  ensureUserMessageRecorded(previewChat, message);

  const result = await processChatMessage({
    chat: previewChat,
    message,
    config,
    trainingEntries
  });

  res.json({
    reply: result.reply,
    meta: result.meta,
    chatState: previewChat
  });
}));

app.put("/api/admin/knowledge-prompt", asyncHandler(async (req, res) => {
  const current = await getConfig();
  const next = {
    ...current,
    knowledgePrompt: String(req.body?.knowledgePrompt || "").trim()
  };
  await saveConfig(next);
  res.json({
    knowledgePrompt: next.knowledgePrompt
  });
}));

app.put("/api/admin/knowledge-sources", asyncHandler(async (req, res) => {
  const current = await getConfig();
  const parsedSources = parseKnowledgeSources(req.body?.sources || "");
  const next = {
    ...current,
    knowledgeSources: await syncKnowledgeSources(parsedSources, { force: true })
  };
  await saveConfig(next);
  res.json({
    knowledgeSources: next.knowledgeSources
  });
}));

app.get("/api/knowledge-links", asyncHandler(async (req, res) => {
  const config = await getConfig();
  res.json({
    links: config.knowledgeSources || []
  });
}));

app.get("/api/admin/knowledge-links", asyncHandler(async (req, res) => {
  const config = await getConfig();
  res.json({
    links: config.knowledgeSources || []
  });
}));

app.post("/api/knowledge-links", asyncHandler(async (req, res) => {
  const current = await getConfig();
  const existingSources = current.knowledgeSources || [];
  const existingUrls = existingSources.map((source) => source.url);
  const incomingSources = parseKnowledgeSources(req.body?.links || req.body?.sources || "");
  const dedupedIncoming = incomingSources.filter((source) => !existingUrls.includes(source.url));
  const syncedIncoming = await syncKnowledgeSources(dedupedIncoming, { force: true });
  const next = {
    ...current,
    knowledgeSources: [...existingSources, ...syncedIncoming]
  };
  await saveConfig(next);
  res.status(201).json({
    links: next.knowledgeSources
  });
}));

app.post("/api/admin/knowledge-links", asyncHandler(async (req, res) => {
  const current = await getConfig();
  const existingSources = current.knowledgeSources || [];
  const existingUrls = existingSources.map((source) => source.url);
  const incomingSources = parseKnowledgeSources(req.body?.links || req.body?.sources || "");
  const dedupedIncoming = incomingSources.filter((source) => !existingUrls.includes(source.url));
  const syncedIncoming = await syncKnowledgeSources(dedupedIncoming, { force: true });
  const next = {
    ...current,
    knowledgeSources: [...existingSources, ...syncedIncoming]
  };
  await saveConfig(next);
  res.status(201).json({
    links: next.knowledgeSources
  });
}));

app.delete("/api/admin/knowledge-sources/:id", asyncHandler(async (req, res) => {
  const current = await getConfig();
  const requestedId = decodeURIComponent(req.params.id);
  const nextSources = (current.knowledgeSources || []).filter((source) => {
    return source.id !== requestedId && source.url !== requestedId;
  });
  if (nextSources.length === (current.knowledgeSources || []).length) {
    return res.status(404).json({ error: "Link nicht gefunden." });
  }

  const next = {
    ...current,
    knowledgeSources: nextSources
  };
  await saveConfig(next);
  res.json({
    knowledgeSources: next.knowledgeSources
  });
}));

app.delete("/api/knowledge-links/:id", asyncHandler(async (req, res) => {
  const current = await getConfig();
  const requestedId = decodeURIComponent(req.params.id);
  const nextSources = (current.knowledgeSources || []).filter((source) => {
    return source.id !== requestedId && source.url !== requestedId;
  });
  if (nextSources.length === (current.knowledgeSources || []).length) {
    return res.status(404).json({ error: "Link nicht gefunden." });
  }

  const next = {
    ...current,
    knowledgeSources: nextSources
  };
  await saveConfig(next);
  res.json({
    links: next.knowledgeSources
  });
}));

app.delete("/api/admin/knowledge-links/:id", asyncHandler(async (req, res) => {
  const current = await getConfig();
  const requestedId = decodeURIComponent(req.params.id);
  const nextSources = (current.knowledgeSources || []).filter((source) => {
    return source.id !== requestedId && source.url !== requestedId;
  });
  if (nextSources.length === (current.knowledgeSources || []).length) {
    return res.status(404).json({ error: "Link nicht gefunden." });
  }

  const next = {
    ...current,
    knowledgeSources: nextSources
  };
  await saveConfig(next);
  res.json({
    links: next.knowledgeSources
  });
}));

app.post("/api/admin/knowledge-sources/sync", asyncHandler(async (req, res) => {
  const current = await getConfig();
  const syncedSources = await syncKnowledgeSources(current.knowledgeSources || [], { force: true });
  const next = {
    ...current,
    knowledgeSources: syncedSources
  };
  await saveConfig(next);
  res.json({
    knowledgeSources: syncedSources
  });
}));

app.get("/api/admin/analytics", asyncHandler(async (req, res) => {
  const chats = await getInteractiveChats();
  const leads = await getLeads();
  const trainingEntries = await getTrainingEntries();
  const questions = {};

  chats.forEach((chat) => {
    chat.messages
      .filter((message) => message.role === "user")
      .forEach((message) => {
        questions[message.content] = (questions[message.content] || 0) + 1;
      });
  });

  const topQuestions = Object.entries(questions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([question, count]) => ({ question, count }));

  res.json({
    chatCount: chats.length,
    leadCount: leads.length,
    trainingCount: trainingEntries.length,
    humanHandoverCount: chats.filter((chat) => chat.contactRequested).length,
    topQuestions
  });
}));

app.use((req, res) => {
  res.status(404).json({ error: "Route nicht gefunden." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Interner Serverfehler." });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`JonFit Chatbot laeuft auf http://localhost:${PORT}`);
  });
}

module.exports = app;
