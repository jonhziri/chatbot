const fs = require("fs");
const path = require("path");
const { createSupabaseClient, hasSupabaseConfig } = require("./supabaseClient");

const dataDir = path.join(__dirname, "..", "data");
const files = {
  chats: path.join(dataDir, "chats.json"),
  leads: path.join(dataDir, "leads.json"),
  config: path.join(dataDir, "config.json"),
  training: path.join(dataDir, "training.json")
};

const defaultConfig = {
  gymName: "JonFit",
  botName: "JonFit Assist",
  botStatus: "draft",
  botAvatarUrl: "",
  botTone: "modern, klar, professionell",
  botGoal: "Leads generieren",
  welcomeMessage: "Hallo und willkommen bei JonFit. Wie ist dein Name?",
  knowledgePrompt:
    "Beispiel: Du bist der digitale Assistent von JonFit. Beantworte Fragen freundlich, klar und professionell. Nutze nur Informationen, die in den Trainingsdaten, dem Wissensprompt oder den verknuepften Quellen enthalten sind. Erfinde keine Leistungen. JonFit hat keine Sauna. Wellness umfasst Lichttherapie und Hydrojetmassage.",
  knowledgeSources: [
    {
      id: "source_demo_1",
      url: "https://jonfit.de",
      status: "not_synced",
      title: "",
      excerpt: "",
      content: "",
      contentChunks: [],
      lastSyncedAt: null,
      syncMessage: "Noch nicht synchronisiert."
    }
  ],
  leadPrompt:
    "Wenn du moechtest, kann ich deine Kontaktdaten fuer einen Rueckruf oder ein Probetraining aufnehmen.",
  forbiddenStatements:
    "Erfinde keine Leistungen, Preise oder Verfuegbarkeiten. Sage nichts ueber Sauna, wenn es keine gibt.",
  leadRule:
    "Frage nur dann nach Kontaktdaten, wenn der Nutzer ein Probetraining, Rueckruf oder persoenliche Beratung wuenscht.",
  humanEscalationText:
    "Ich moechte dir lieber nichts Falsches sagen. Bitte melde dich direkt per E-Mail beim JonFit Team.",
  fallbackContact:
    "Schreibe uns bitte an info@jonfit.de.",
  llmEnabled: true
};

const supabase = createSupabaseClient();

function usingSupabase() {
  return hasSupabaseConfig() && Boolean(supabase);
}

function logSupabaseFallback(error) {
  console.warn(`[storage] Supabase nicht verfuegbar, nutze JSON-Fallback: ${error.message || error}`);
}

function ensureDataFiles() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(files.config)) {
    fs.writeFileSync(files.config, JSON.stringify(defaultConfig, null, 2));
  }

  if (!fs.existsSync(files.chats)) {
    fs.writeFileSync(files.chats, JSON.stringify(require("../data/chats.seed.json"), null, 2));
  }

  if (!fs.existsSync(files.leads)) {
    fs.writeFileSync(files.leads, JSON.stringify(require("../data/leads.seed.json"), null, 2));
  }

  if (!fs.existsSync(files.training)) {
    fs.writeFileSync(files.training, JSON.stringify(require("../data/training.seed.json"), null, 2));
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, payload) {
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
}

function normalizeTrainingEntry(entry) {
  const now = new Date().toISOString();
  return {
    id: entry.id || `training_${Date.now()}`,
    question: entry.question || entry.user_question || "",
    improved_answer: entry.improved_answer || entry.improvedAnswer || "",
    keywords: Array.isArray(entry.keywords) ? entry.keywords.filter(Boolean) : [],
    category: entry.category || "Allgemein",
    source_chat_id: entry.source_chat_id || entry.sourceChatId || null,
    previous_bot_answer: entry.previous_bot_answer || entry.previousBotAnswer || "",
    created_at: entry.created_at || now,
    updated_at: entry.updated_at || entry.created_at || now,
    created_by: entry.created_by || entry.createdBy || "admin"
  };
}

function normalizeChat(chat) {
  return {
    ...chat,
    status: chat.status === "open" ? "neu" : (chat.status || "neu"),
    trained: chat.trained || false,
    correctionCount: chat.correctionCount || 0,
    adminNote: chat.adminNote || "",
    updatedAt: chat.updatedAt || chat.createdAt,
    openedAt: chat.openedAt || null,
    awaitingName: chat.awaitingName || false,
    profile: chat.profile || { name: chat.lead?.name?.split(" ")[0] || "" }
  };
}

async function readRows(table, orderColumn = "updated_at") {
  const { data, error } = await supabase
    .from(table)
    .select("data")
    .order(orderColumn, { ascending: false });

  if (error) {
    throw new Error(`Supabase ${table} konnte nicht gelesen werden: ${error.message}`);
  }

  return (data || []).map((row) => row.data).filter(Boolean);
}

async function replaceRows(table, rows, mapRow) {
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .neq("id", "__never__");

  if (deleteError) {
    throw new Error(`Supabase ${table} konnte nicht geleert werden: ${deleteError.message}`);
  }

  if (!rows.length) {
    return;
  }

  const { error: insertError } = await supabase
    .from(table)
    .upsert(rows.map(mapRow), { onConflict: "id" });

  if (insertError) {
    throw new Error(`Supabase ${table} konnte nicht gespeichert werden: ${insertError.message}`);
  }
}

async function getChats() {
  if (usingSupabase()) {
    try {
      return (await readRows("chats")).map(normalizeChat);
    } catch (error) {
      logSupabaseFallback(error);
    }
  }

  return readJson(files.chats).map(normalizeChat);
}

async function saveChats(payload) {
  if (usingSupabase()) {
    try {
      await replaceRows("chats", payload, (chat) => ({
        id: chat.id,
        data: chat,
        created_at: chat.createdAt || new Date().toISOString(),
        updated_at: chat.updatedAt || chat.createdAt || new Date().toISOString()
      }));
      return;
    } catch (error) {
      logSupabaseFallback(error);
    }
  }

  writeJson(files.chats, payload);
}

async function getLeads() {
  if (usingSupabase()) {
    try {
      return await readRows("leads");
    } catch (error) {
      logSupabaseFallback(error);
    }
  }

  return readJson(files.leads);
}

async function saveLeads(payload) {
  if (usingSupabase()) {
    try {
      await replaceRows("leads", payload, (lead) => ({
        id: lead.id,
        chat_id: lead.chatId || null,
        data: lead,
        created_at: lead.createdAt || new Date().toISOString(),
        updated_at: lead.updatedAt || lead.createdAt || new Date().toISOString()
      }));
      return;
    } catch (error) {
      logSupabaseFallback(error);
    }
  }

  writeJson(files.leads, payload);
}

async function getConfig() {
  if (usingSupabase()) {
    try {
      const { data, error } = await supabase
        .from("bot_config")
        .select("data")
        .eq("id", "default")
        .maybeSingle();

      if (error) {
        throw new Error(`Supabase bot_config konnte nicht gelesen werden: ${error.message}`);
      }

      const config = data?.data || defaultConfig;
      return {
        ...defaultConfig,
        ...config,
        knowledgePrompt: config.knowledgePrompt || defaultConfig.knowledgePrompt,
        knowledgeSources: Array.isArray(config.knowledgeSources) ? config.knowledgeSources : defaultConfig.knowledgeSources
      };
    } catch (error) {
      logSupabaseFallback(error);
    }
  }

  const config = readJson(files.config);
  return {
    ...defaultConfig,
    ...config,
    knowledgePrompt: config.knowledgePrompt || defaultConfig.knowledgePrompt,
    knowledgeSources: Array.isArray(config.knowledgeSources) ? config.knowledgeSources : defaultConfig.knowledgeSources
  };
}

async function saveConfig(payload) {
  if (usingSupabase()) {
    try {
      const { error } = await supabase
        .from("bot_config")
        .upsert({
          id: "default",
          data: payload,
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });

      if (error) {
        throw new Error(`Supabase bot_config konnte nicht gespeichert werden: ${error.message}`);
      }
      return;
    } catch (error) {
      logSupabaseFallback(error);
    }
  }

  writeJson(files.config, payload);
}

async function getTrainingEntries() {
  if (usingSupabase()) {
    try {
      return (await readRows("training_entries", "updated_at")).map(normalizeTrainingEntry);
    } catch (error) {
      logSupabaseFallback(error);
    }
  }

  return readJson(files.training).map(normalizeTrainingEntry);
}

async function saveTrainingEntries(payload) {
  const entries = payload.map(normalizeTrainingEntry);

  if (usingSupabase()) {
    try {
      await replaceRows("training_entries", entries, (entry) => ({
        id: entry.id,
        data: entry,
        question: entry.question,
        category: entry.category,
        keywords: entry.keywords,
        source_chat_id: entry.source_chat_id,
        created_at: entry.created_at || new Date().toISOString(),
        updated_at: entry.updated_at || entry.created_at || new Date().toISOString()
      }));
      return;
    } catch (error) {
      logSupabaseFallback(error);
    }
  }

  writeJson(files.training, entries);
}

module.exports = {
  defaultConfig,
  ensureDataFiles,
  getChats,
  saveChats,
  getLeads,
  saveLeads,
  getConfig,
  saveConfig,
  getTrainingEntries,
  saveTrainingEntries,
  normalizeTrainingEntry,
  usingSupabase
};
