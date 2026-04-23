function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&uuml;/gi, "ue")
    .replace(/&ouml;/gi, "oe")
    .replace(/&auml;/gi, "ae")
    .replace(/&szlig;/gi, "ss")
    .replace(/\r/g, " ")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTitle(html, url) {
  const titleMatch = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return stripHtml(titleMatch[1]).slice(0, 160);
  }

  try {
    return new URL(url).hostname;
  } catch (error) {
    return url;
  }
}

function chunkText(text, maxChunkLength = 1400) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return [];

  const paragraphs = cleanText
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks = [];
  let current = "";

  paragraphs.forEach((paragraph) => {
    if (!current) {
      current = paragraph;
      return;
    }

    if (`${current}\n\n${paragraph}`.length <= maxChunkLength) {
      current = `${current}\n\n${paragraph}`;
      return;
    }

    chunks.push(current);
    current = paragraph;
  });

  if (current) {
    chunks.push(current);
  }

  return chunks.slice(0, 12);
}

function createSourceRecord(url, index = 0) {
  return {
    id: `source_${Date.now()}_${index}`,
    url,
    status: "not_synced",
    title: "",
    excerpt: "",
    content: "",
    contentChunks: [],
    lastSyncedAt: null,
    syncMessage: "Noch nicht synchronisiert."
  };
}

function normalizeKnowledgeSource(source, index = 0) {
  const normalizedUrl = String(source?.url || "").trim();
  return {
    id: source?.id || `source_${Date.now()}_${index}`,
    url: normalizedUrl,
    status: source?.status || "not_synced",
    title: String(source?.title || ""),
    excerpt: String(source?.excerpt || ""),
    content: String(source?.content || ""),
    contentChunks: Array.isArray(source?.contentChunks) ? source.contentChunks.filter(Boolean) : [],
    lastSyncedAt: source?.lastSyncedAt || null,
    syncMessage: String(source?.syncMessage || "Noch nicht synchronisiert.")
  };
}

function parseKnowledgeSources(rawValue) {
  const values = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  const uniqueValues = [...new Set(values)];
  const invalid = uniqueValues.filter((value) => !isValidHttpUrl(value));
  if (invalid.length) {
    throw new Error(`Ungueltige URL(s): ${invalid.join(", ")}`);
  }

  return uniqueValues.map((url, index) => createSourceRecord(url, index));
}

async function fetchText(url) {
  if (typeof fetch !== "function") {
    throw new Error("Diese Node-Version unterstuetzt kein globales fetch.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": "JonFitBot/1.0 (+knowledge sync)",
        accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function syncSingleKnowledgeSource(source, options = {}) {
  const normalized = normalizeKnowledgeSource(source);
  const shouldFetch = options.force || ["not_synced", "pending", "error"].includes(normalized.status);

  if (!shouldFetch) {
    return normalized;
  }

  try {
    const html = await fetchText(normalized.url);
    const textContent = stripHtml(html).slice(0, 18000);
    const contentChunks = chunkText(textContent);
    const excerpt = contentChunks[0] ? contentChunks[0].slice(0, 280) : "";

    if (!contentChunks.length) {
      throw new Error("Kein verwertbarer Textinhalt gefunden.");
    }

    return {
      ...normalized,
      status: "synced",
      title: extractTitle(html, normalized.url),
      excerpt,
      content: textContent,
      contentChunks,
      lastSyncedAt: new Date().toISOString(),
      syncMessage: `${contentChunks.length} Inhaltsteil(e) synchronisiert.`
    };
  } catch (error) {
    return {
      ...normalized,
      status: "error",
      syncMessage: `Synchronisierung fehlgeschlagen: ${error.message || "Unbekannter Fehler"}`,
      lastSyncedAt: normalized.lastSyncedAt || null
    };
  }
}

async function syncKnowledgeSources(sources, options = {}) {
  const normalizedSources = (sources || []).map((source, index) => normalizeKnowledgeSource(source, index));
  const results = [];

  for (const source of normalizedSources) {
    results.push(await syncSingleKnowledgeSource(source, options));
  }

  return results;
}

module.exports = {
  createSourceRecord,
  isValidHttpUrl,
  normalizeKnowledgeSource,
  parseKnowledgeSources,
  stripHtml,
  chunkText,
  syncSingleKnowledgeSource,
  syncKnowledgeSources
};
