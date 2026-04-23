const state = {
  chats: [],
  filteredChats: [],
  selectedChatId: null,
  selectionMode: false,
  selectedChatIds: [],
  analytics: null,
  leads: [],
  trainingEntries: [],
  config: {},
  studioDraft: {},
  isAdminReady: false,
  hasLoadedConfigOnce: false,
  activeTab: "review",
  previewChat: {
    messages: [],
    awaitingName: true,
    profileName: "",
    pendingNameIntent: "",
    awaitingLeadDetails: false,
    activeTopic: "",
    lastCompletedTopic: "",
    lead: null
  },
  contextMenu: {
    visible: false,
    x: 0,
    y: 0,
    chatId: null,
    messageId: null
  },
  trainingTarget: null,
  confirmAction: null
};

const elements = {
  chatList: document.getElementById("chat-list"),
  chatSearch: document.getElementById("chat-search"),
  statusFilter: document.getElementById("status-filter"),
  toggleSelectionMode: document.getElementById("toggle-selection-mode"),
  selectionActions: document.getElementById("selection-actions"),
  selectionCount: document.getElementById("selection-count"),
  selectAllChats: document.getElementById("select-all-chats"),
  clearSelection: document.getElementById("clear-selection"),
  bulkDeleteChats: document.getElementById("bulk-delete-chats"),
  panelMeta: document.getElementById("panel-meta"),
  chatThread: document.getElementById("chat-thread"),
  stats: document.getElementById("stats"),
  chatStatusSelect: document.getElementById("chat-status-select"),
  saveChatStatus: document.getElementById("save-chat-status"),
  chatNote: document.getElementById("chat-note"),
  saveChatNote: document.getElementById("save-chat-note"),
  leadList: document.getElementById("lead-list"),
  analyticsOverview: document.getElementById("analytics-overview"),
  topQuestions: document.getElementById("top-questions"),
  trainingList: document.getElementById("training-list"),
  trainingSearch: document.getElementById("training-search"),
  trainingCategoryFilter: document.getElementById("training-category-filter"),
  trainingKeywordFilter: document.getElementById("training-keyword-filter"),
  createTraining: document.getElementById("create-training"),
  saveStudioConfig: document.getElementById("save-studio-config"),
  studioBotName: document.getElementById("studio-bot-name"),
  studioBotStatus: document.getElementById("studio-bot-status"),
  studioAvatarUrl: document.getElementById("studio-avatar-url"),
  studioAvatarUpload: document.getElementById("studio-avatar-upload"),
  studioAvatarPreview: document.getElementById("studio-avatar-preview"),
  studioWelcomeMessage: document.getElementById("studio-welcome-message"),
  studioBotTone: document.getElementById("studio-bot-tone"),
  studioBotGoal: document.getElementById("studio-bot-goal"),
  studioForbiddenStatements: document.getElementById("studio-forbidden-statements"),
  studioLeadRule: document.getElementById("studio-lead-rule"),
  knowledgePrompt: document.getElementById("knowledge-prompt"),
  knowledgePromptLength: document.getElementById("knowledge-prompt-length"),
  saveKnowledgePrompt: document.getElementById("save-knowledge-prompt"),
  knowledgeSourcesInput: document.getElementById("knowledge-sources-input"),
  knowledgeSourceList: document.getElementById("knowledge-source-list"),
  saveKnowledgeSources: document.getElementById("save-knowledge-sources"),
  syncKnowledgeSources: document.getElementById("sync-knowledge-sources"),
  studioHumanEscalationText: document.getElementById("studio-human-escalation-text"),
  studioFallbackContact: document.getElementById("studio-fallback-contact"),
  openaiStatusText: document.getElementById("openai-status-text"),
  previewChatAvatar: document.getElementById("preview-chat-avatar"),
  previewChatName: document.getElementById("preview-chat-name"),
  previewChatStatus: document.getElementById("preview-chat-status"),
  previewChatThread: document.getElementById("preview-chat-thread"),
  previewChatForm: document.getElementById("preview-chat-form"),
  previewChatInput: document.getElementById("preview-chat-input"),
  previewChatSend: document.getElementById("preview-chat-send"),
  resetPreviewChat: document.getElementById("reset-preview-chat"),
  tabs: Array.from(document.querySelectorAll(".tab-button")),
  panels: Array.from(document.querySelectorAll(".tab-panel")),
  contextMenu: document.getElementById("context-menu"),
  contextTrain: document.getElementById("context-train"),
  toastRegion: document.getElementById("toast-region"),
  trainingModal: document.getElementById("training-modal"),
  closeTrainingModal: document.getElementById("close-training-modal"),
  cancelTraining: document.getElementById("cancel-training"),
  saveTraining: document.getElementById("save-training"),
  trainingUserQuestion: document.getElementById("training-user-question"),
  trainingPreviousAnswer: document.getElementById("training-previous-answer"),
  trainingImprovedAnswer: document.getElementById("training-improved-answer"),
  trainingCategory: document.getElementById("training-category"),
  trainingKeywords: document.getElementById("training-keywords"),
  confirmModal: document.getElementById("confirm-modal"),
  confirmMessage: document.getElementById("confirm-message"),
  confirmCancel: document.getElementById("confirm-cancel"),
  confirmSubmit: document.getElementById("confirm-submit")
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok && response.status !== 204) {
    const error = await response.json();
    throw new Error(error.error || "API-Fehler");
  }
  return response.status === 204 ? null : response.json();
}

function createStudioDraft(config = {}) {
  return {
    botName: config.botName || "JonFit Assist",
    botStatus: config.botStatus || "draft",
    botAvatarUrl: config.botAvatarUrl || "",
    welcomeMessage: config.welcomeMessage || "Hallo und willkommen bei JonFit. Wie ist dein Name?",
    botTone: config.botTone || "modern, klar, professionell",
    botGoal: config.botGoal || "Leads generieren",
    forbiddenStatements: config.forbiddenStatements || "",
    leadRule: config.leadRule || "",
    humanEscalationText: config.humanEscalationText || "",
    fallbackContact: config.fallbackContact || "",
    knowledgePrompt: config.knowledgePrompt || "",
    knowledgeSources: Array.isArray(config.knowledgeSources) ? [...config.knowledgeSources] : []
  };
}

function ensureAdminDefaults() {
  const baseConfig = state.config && Object.keys(state.config).length ? state.config : {};
  state.config = {
    ...baseConfig
  };
  state.studioDraft = {
    ...createStudioDraft(baseConfig),
    ...(state.studioDraft || {})
  };
}

function avatarFallbackLabel(name) {
  return (name || "JonFit").trim().charAt(0).toUpperCase() || "J";
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

function applyAvatar(element, url, fallbackText) {
  if (!element) return;
  if (url) {
    element.style.backgroundImage = `url("${url}")`;
    element.style.backgroundColor = "transparent";
    element.textContent = "";
  } else {
    element.style.backgroundImage = "";
    element.style.backgroundColor = "";
    element.textContent = fallbackText;
  }
}

function resetPreviewChat() {
  ensureAdminDefaults();
  const welcomeMessage = state.studioDraft?.welcomeMessage || "Hallo und willkommen bei JonFit. Wie ist dein Name?";
  state.previewChat = {
    messages: [{ role: "assistant", content: welcomeMessage }],
    awaitingName: true,
    profileName: "",
    pendingNameIntent: "",
    awaitingLeadDetails: false,
    activeTopic: "",
    lastCompletedTopic: "",
    lead: null,
    profile: { name: "" }
  };
  renderPreviewChat();
}

function syncPreviewWelcomeIfPristine() {
  if (!state.previewChat.awaitingName) return;
  if (state.previewChat.messages.length !== 1) return;
  state.previewChat.messages[0] = {
    role: "assistant",
    content: state.studioDraft?.welcomeMessage || "Hallo und willkommen bei JonFit. Wie ist dein Name?"
  };
  renderPreviewChat();
}

function updateStudioDraft(patch) {
  ensureAdminDefaults();
  state.studioDraft = {
    ...state.studioDraft,
    ...patch
  };
  renderStudioBuilder();
  renderPreviewInsights();
  syncPreviewWelcomeIfPristine();
}

function getSelectedChat() {
  return state.chats.find((chat) => chat.id === state.selectedChatId) || null;
}

function displayNameForChat(chat) {
  return chat.profile?.name || chat.lead?.name || "Unbekannter Nutzer";
}

function lastMessagePreview(chat) {
  const lastMessage = [...chat.messages].reverse().find(Boolean);
  return lastMessage ? lastMessage.content : "Noch keine Nachrichten";
}

function statusClass(status) {
  return (status || "neu").replace(/\s+/g, "-");
}

function isChatSelected(chatId) {
  return state.selectedChatIds.includes(chatId);
}

function setSelectionMode(enabled) {
  state.selectionMode = enabled;
  if (!enabled) {
    state.selectedChatIds = [];
  }
  renderSelectionToolbar();
  renderChatList();
}

function toggleChatSelection(chatId) {
  if (isChatSelected(chatId)) {
    state.selectedChatIds = state.selectedChatIds.filter((id) => id !== chatId);
  } else {
    state.selectedChatIds = [...state.selectedChatIds, chatId];
  }
  renderSelectionToolbar();
  renderChatList();
}

function removeChatsFromState(chatIds) {
  const ids = new Set(chatIds);
  state.chats = state.chats.filter((entry) => !ids.has(entry.id));
  state.leads = state.leads.filter((entry) => !ids.has(entry.chatId));
  state.selectedChatIds = state.selectedChatIds.filter((id) => !ids.has(id));
  if (ids.has(state.selectedChatId)) {
    state.selectedChatId = state.chats[0]?.id || null;
  }
}

function renderSelectionToolbar() {
  const count = state.selectedChatIds.length;
  const filteredIds = state.filteredChats.map((chat) => chat.id);
  const allVisibleSelected = filteredIds.length > 0 && filteredIds.every((id) => state.selectedChatIds.includes(id));
  elements.toggleSelectionMode.classList.toggle("active", state.selectionMode);
  elements.toggleSelectionMode.innerHTML = state.selectionMode ? '<span class="button-check">✓</span> Auswahl beenden' : "Auswaehlen";
  elements.selectionActions.hidden = !state.selectionMode;
  elements.selectionCount.textContent = count === 1 ? "1 ausgewaehlt" : `${count} ausgewaehlt`;
  elements.bulkDeleteChats.disabled = count === 0;
  elements.selectAllChats.disabled = filteredIds.length === 0 || allVisibleSelected;
}

function isChatNew(chat) {
  if (!chat || chat.openedAt) return false;
  const createdAt = new Date(chat.createdAt).getTime();
  if (Number.isNaN(createdAt)) return false;
  const ageMs = Date.now() - createdAt;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return ageMs <= thirtyDaysMs;
}

function renderChatList() {
  const search = elements.chatSearch.value.trim().toLowerCase();
  const filter = elements.statusFilter.value;

  state.filteredChats = state.chats.filter((chat) => {
    const matchesFilter = filter === "all" || (chat.status || "neu") === filter;
    const haystack = `${displayNameForChat(chat)} ${lastMessagePreview(chat)} ${chat.adminNote || ""}`.toLowerCase();
    return matchesFilter && (!search || haystack.includes(search));
  });

  elements.chatList.innerHTML = "";
  state.filteredChats.forEach((chat) => {
    const showNewBadge = isChatNew(chat);
    const showStatusChip = (chat.status || "neu") !== "neu";
    const selectedInBulk = isChatSelected(chat.id);
    const row = document.createElement("div");
    row.className = `chat-row-shell ${chat.id === state.selectedChatId ? "active" : ""} ${state.selectionMode ? "selection-mode" : ""} ${selectedInBulk ? "selected" : ""}`;

    if (state.selectionMode) {
      const selectToggle = document.createElement("button");
      selectToggle.className = `chat-select-toggle ${selectedInBulk ? "checked" : ""}`;
      selectToggle.type = "button";
      selectToggle.setAttribute("aria-label", selectedInBulk ? "Chat abwaehlen" : "Chat auswaehlen");
      selectToggle.innerHTML = selectedInBulk ? "✓" : "";
      selectToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleChatSelection(chat.id);
      });
      row.appendChild(selectToggle);
    }

    const main = document.createElement("button");
    main.className = `chat-row ${chat.id === state.selectedChatId ? "active" : ""}`;
    main.type = "button";
    main.innerHTML = `
      <div class="chat-row-top">
        <strong>${displayNameForChat(chat)}</strong>
        ${showNewBadge ? '<span class="badge new">Neu</span>' : ""}
      </div>
      <div class="chat-row-preview">${lastMessagePreview(chat)}</div>
      <div class="chat-row-meta">
        <span>${new Date(chat.updatedAt || chat.createdAt).toLocaleString("de-DE")}</span>
        ${showStatusChip ? `<span class="status-chip ${statusClass(chat.status)}">${chat.status || "neu"}</span>` : "<span></span>"}
      </div>
      <div class="chat-row-meta">
        ${chat.trained ? '<span class="badge trained">Trainiert</span>' : "<span></span>"}
        ${(chat.correctionCount || 0) > 0 ? `<span>${chat.correctionCount} Korrektur</span>` : "<span></span>"}
      </div>
    `;
    main.addEventListener("click", async () => {
      if (state.selectionMode) {
        toggleChatSelection(chat.id);
        return;
      }
      state.selectedChatId = chat.id;
      if (isChatNew(chat)) {
        const openedAt = new Date().toISOString();
        chat.openedAt = openedAt;
        try {
          await api(`/api/admin/chats/${chat.id}`, {
            method: "PATCH",
            body: JSON.stringify({ openedAt })
          });
        } catch (error) {
          showToast(error.message || "Chat konnte nicht als geoeffnet markiert werden", "error");
        }
      }
      render();
    });

    const removeButton = document.createElement("button");
    removeButton.className = "chat-row-delete";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", "Chat loeschen");
    removeButton.textContent = "🗑";
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openConfirmModal({
        message: "Bist du sicher, dass du diesen Chat loeschen moechtest?",
        onConfirm: async () => {
          try {
            await api(`/api/admin/chats/${chat.id}`, { method: "DELETE" });
            removeChatsFromState([chat.id]);
            closeConfirmModal();
            render();
            showToast("Chat erfolgreich geloescht");
          } catch (error) {
            showToast(error.message || "Chat konnte nicht geloescht werden", "error");
          }
        }
      });
    });

    row.appendChild(main);
    row.appendChild(removeButton);
    elements.chatList.appendChild(row);
  });
}

function renderMeta() {
  const selectedChat = getSelectedChat();
  const metaByTab = {
    review: selectedChat
      ? `
        <h2>${displayNameForChat(selectedChat)}</h2>
        <p>${new Date(selectedChat.createdAt).toLocaleString("de-DE")} · <span class="status-chip ${statusClass(selectedChat.status)}">${selectedChat.status || "neu"}</span></p>
      `
      : "<h2>Kein Chat ausgewaehlt</h2><p>Waehle links einen Chat aus der Inbox.</p>",
    training: "<h2>Bot Studio</h2><p>Globale Bot-Konfiguration, Wissensbasis und Live-Vorschau.</p>",
    leads: "<h2>Leads</h2><p>Alle gesammelten Kontaktanfragen an einem Ort.</p>",
    analytics: "<h2>Analytics</h2><p>Uebersicht, Trainingsstand und haeufige Fragen.</p>"
  };

  elements.panelMeta.innerHTML = metaByTab[state.activeTab] || metaByTab.review;

  if (selectedChat) {
    elements.chatStatusSelect.value = selectedChat.status || "neu";
    elements.chatNote.value = selectedChat.adminNote || "";
  } else {
    elements.chatNote.value = "";
  }
}

function previousUserMessage(messages, index) {
  for (let current = index - 1; current >= 0; current -= 1) {
    if (messages[current].role === "user") {
      return messages[current];
    }
  }
  return null;
}

function sourceLabel(source) {
  const labels = {
    training: "Quelle: Training",
    rule: "Quelle: Regel",
    openai: "Quelle: OpenAI",
    fallback: "Quelle: Fallback",
    system: "Quelle: System"
  };
  return labels[source] || (source ? `Quelle: ${source}` : "");
}

function renderThread() {
  const chat = getSelectedChat();
  elements.chatThread.innerHTML = "";
  if (!chat) {
    elements.chatThread.innerHTML = "<p>Waehle links einen Chat aus.</p>";
    return;
  }

  chat.messages.forEach((message, index) => {
    const card = document.createElement("article");
    card.className = `message-card ${message.role}`;
    card.dataset.messageId = message.id;

    const tags = [];
    if (message.meta?.topic) tags.push(message.meta.topic);
    const sourceBadge = message.role === "assistant" && message.meta?.source
      ? `<span class="message-source-badge ${message.meta.source}">${sourceLabel(message.meta.source)}</span>`
      : "";

    card.innerHTML = `
      <div class="message-card-header">
        <span class="message-card-authorline">
          <span>${message.role === "assistant" ? "Bot" : displayNameForChat(chat)}</span>
          ${sourceBadge}
        </span>
        <span>${new Date(message.createdAt).toLocaleString("de-DE")}</span>
      </div>
      <div class="message-card-content">${message.content}</div>
      <div class="message-card-tags">${tags.map((tag) => `<span class="mini-tag">${tag}</span>`).join("")}</div>
    `;

    if (message.role === "assistant" && previousUserMessage(chat.messages, index)) {
      card.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        state.contextMenu = {
          visible: true,
          x: event.clientX,
          y: event.clientY,
          chatId: chat.id,
          messageId: message.id
        };
        renderContextMenu();
      });
    }

    elements.chatThread.appendChild(card);
  });
}

function renderStats() {
  const stats = state.analytics;
  if (!stats) return;
  elements.stats.innerHTML = [
    ["Chats", stats.chatCount],
    ["Leads", stats.leadCount],
    ["Training", stats.trainingCount]
  ]
    .map(([label, value]) => `<div class="stat-tile"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderTrainingEntries() {
  elements.trainingList.innerHTML = "";
  const search = elements.trainingSearch.value.trim().toLowerCase();
  const category = elements.trainingCategoryFilter.value.trim().toLowerCase();
  const keyword = elements.trainingKeywordFilter.value.trim().toLowerCase();

  state.trainingEntries
    .filter((entry) => {
      const matchesSearch = search
        ? `${entry.question} ${entry.improved_answer} ${entry.previous_bot_answer || ""}`.toLowerCase().includes(search)
        : true;
      const matchesCategory = category ? (entry.category || "").toLowerCase().includes(category) : true;
      const matchesKeyword = keyword
        ? (entry.keywords || []).some((item) => item.toLowerCase().includes(keyword))
        : true;
      return matchesSearch && matchesCategory && matchesKeyword;
    })
    .forEach((entry) => {
      const card = document.createElement("div");
      card.className = "entry-card";
      card.innerHTML = `
        <div class="entry-header">
          <div>
            <h3>${entry.question || "Ohne Frage"}</h3>
            <div class="entry-meta">Quelle: ${entry.source_chat_id || "manuell"} · ${new Date(entry.updated_at || entry.created_at).toLocaleString("de-DE")}</div>
          </div>
          <span class="status-chip beantwortet">${entry.category || "Allgemein"}</span>
        </div>
        <div class="entry-fields">
          <div class="field-group">
            <label>Frage</label>
            <input data-key="question" value="${entry.question || ""}" placeholder="Frage" />
          </div>
          <div class="field-grid">
            <div class="field-group">
              <label>Kategorie</label>
              <input data-key="category" value="${entry.category || ""}" placeholder="Kategorie" />
            </div>
            <div class="field-group">
              <label>Keywords</label>
              <input data-key="keywords" value="${(entry.keywords || []).join(", ")}" placeholder="Keywords" />
            </div>
          </div>
          <div class="field-group">
            <label>Verbesserte Antwort</label>
            <textarea data-key="improved_answer" rows="4">${entry.improved_answer || ""}</textarea>
          </div>
          <div class="field-group">
            <label>Vorherige Bot-Antwort</label>
            <textarea data-key="previous_bot_answer" rows="3" placeholder="Vorherige Bot-Antwort">${entry.previous_bot_answer || ""}</textarea>
          </div>
        </div>
        <div class="row">
          <button data-action="save" type="button">Speichern</button>
          <button data-action="delete" type="button">Loeschen</button>
        </div>
      `;
      card.addEventListener("click", async (event) => {
        const action = event.target.dataset.action;
        if (!action) return;
        if (action === "delete") {
          await api(`/api/admin/training/${entry.id}`, { method: "DELETE" });
          showToast("Eintrag geloescht");
        } else {
          const payload = {};
          card.querySelectorAll("[data-key]").forEach((field) => {
            payload[field.dataset.key] = field.value;
          });
          payload.keywords = payload.keywords.split(",").map((item) => item.trim()).filter(Boolean);
          await api(`/api/admin/training/${entry.id}`, {
            method: "PUT",
            body: JSON.stringify(payload)
          });
          showToast("Eintrag gespeichert");
        }
        await reloadAll();
      });
      elements.trainingList.appendChild(card);
    });
}

function renderStudioBuilder() {
  if (!state.studioDraft) return;
  elements.studioBotName.value = state.studioDraft.botName || "";
  elements.studioBotStatus.value = state.studioDraft.botStatus || "draft";
  elements.studioAvatarUrl.value = state.studioDraft.botAvatarUrl || "";
  elements.studioWelcomeMessage.value = state.studioDraft.welcomeMessage || "";
  elements.studioBotTone.value = state.studioDraft.botTone || "";
  elements.studioBotGoal.value = state.studioDraft.botGoal || "";
  elements.studioForbiddenStatements.value = state.studioDraft.forbiddenStatements || "";
  elements.studioLeadRule.value = state.studioDraft.leadRule || "";
  elements.studioHumanEscalationText.value = state.studioDraft.humanEscalationText || "";
  elements.studioFallbackContact.value = state.studioDraft.fallbackContact || "";
  applyAvatar(
    elements.studioAvatarPreview,
    state.studioDraft.botAvatarUrl,
    avatarFallbackLabel(state.studioDraft.botName)
  );
}

function renderKnowledgeCenter() {
  if (!state.studioDraft) return;
  elements.knowledgePrompt.value = state.studioDraft.knowledgePrompt || "";
  elements.knowledgePromptLength.textContent = `${elements.knowledgePrompt.value.length} Zeichen`;

  elements.knowledgeSourceList.innerHTML = "";
  (state.studioDraft.knowledgeSources || []).forEach((source) => {
    const card = document.createElement("div");
    card.className = "source-chip";
    card.innerHTML = `
      <div class="source-chip-main">
        <span class="source-icon">↗</span>
        <div class="source-chip-text">
          <strong>${source.title || formatSourceUrl(source.url)}</strong>
          <small>${source.syncMessage || "Quelle gespeichert."}</small>
        </div>
      </div>
      <div class="source-status ${source.status || "not_synced"}">${formatKnowledgeSourceStatus(source.status || "not_synced")}</div>
      <button class="source-delete" type="button" aria-label="Link loeschen">🗑</button>
    `;
    card.querySelector(".source-delete").addEventListener("click", () => {
      openConfirmModal({
        message: "Bist du sicher, dass du diesen Link loeschen moechtest?",
        onConfirm: async () => {
          try {
            const deleteTarget = encodeURIComponent(source.id || source.url);
            const response = await api(`/api/knowledge-links/${deleteTarget}`, {
              method: "DELETE"
            });
            state.config = {
              ...state.config,
              knowledgeSources: response.links
            };
            state.studioDraft = {
              ...state.studioDraft,
              knowledgeSources: response.links
            };
            renderKnowledgeCenter();
            renderPreviewInsights();
            closeConfirmModal();
            showToast("Link erfolgreich geloescht");
          } catch (error) {
            showToast(error.message || "Link konnte nicht geloescht werden", "error");
          }
        }
      });
    });
    elements.knowledgeSourceList.appendChild(card);
  });
}

function renderOpenAiStatus() {
  if (!state.config) return;
  elements.openaiStatusText.textContent = state.config.openaiConfigured
    ? `OpenAI ist aktiv. Modell: ${state.config.openaiModel}.`
    : "OpenAI ist nicht aktiv, weil kein OPENAI_API_KEY serverseitig gesetzt ist.";
}

function renderLeads() {
  elements.leadList.innerHTML = "";
  if (!state.leads.length) {
    elements.leadList.innerHTML = '<div class="preview-empty">Noch keine Leads vorhanden.</div>';
    return;
  }

  state.leads.forEach((lead) => {
    const card = document.createElement("div");
    card.className = "entry-card";
    card.innerHTML = `
      <div class="entry-header">
        <div>
          <h3>${lead.name || "Ohne Namen"}</h3>
          <div class="entry-meta">${lead.topic || "Allgemeine Anfrage"} · ${new Date(lead.updatedAt || lead.createdAt).toLocaleString("de-DE")}</div>
        </div>
        <span class="status-chip ${statusClass(lead.status || "neu")}">${lead.status || "neu"}</span>
      </div>
      <div class="entry-fields">
        <div class="field-grid">
          <div class="field-group">
            <label>E-Mail</label>
            <input value="${lead.email || ""}" readonly />
          </div>
          <div class="field-group">
            <label>Telefon</label>
            <input value="${lead.phone || ""}" readonly />
          </div>
        </div>
        <div class="field-group">
          <label>Notiz</label>
          <textarea rows="3" readonly>${lead.notes || "Keine Notiz vorhanden."}</textarea>
        </div>
      </div>
    `;
    elements.leadList.appendChild(card);
  });
}

function renderAnalyticsPanel() {
  if (!state.analytics) return;
  elements.analyticsOverview.innerHTML = [
    ["Chats", state.analytics.chatCount],
    ["Leads", state.analytics.leadCount],
    ["Training", state.analytics.trainingCount],
    ["Uebergaben", state.analytics.humanHandoverCount]
  ]
    .map(([label, value]) => `<div class="stat-tile"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");

  elements.topQuestions.innerHTML = "";
  if (!(state.analytics.topQuestions || []).length) {
    elements.topQuestions.innerHTML = '<div class="preview-empty">Noch keine haeufigen Fragen verfuegbar.</div>';
    return;
  }

  state.analytics.topQuestions.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "entry-card compact-card";
    row.innerHTML = `<strong>${entry.question}</strong><p>${entry.count}x gestellt</p>`;
    elements.topQuestions.appendChild(row);
  });
}

function renderPreviewInsights() {
  ensureAdminDefaults();
  const botName = state.studioDraft.botName || "JonFit Assist";
  const status = state.studioDraft.botStatus || "draft";
  const avatarUrl = state.studioDraft.botAvatarUrl || "";
  const avatarLabel = avatarFallbackLabel(botName);

  applyAvatar(elements.previewChatAvatar, avatarUrl, avatarLabel);

  elements.previewChatName.textContent = botName;
  elements.previewChatStatus.textContent = status === "aktiv" ? "online" : "im Aufbau";
  elements.previewChatInput.disabled = !state.isAdminReady;
  elements.previewChatSend.disabled = !state.isAdminReady;
  elements.previewChatInput.placeholder = state.isAdminReady
    ? "Schreibe deine Nachricht..."
    : "Lade Bot-Konfiguration...";
}

function renderPreviewChat() {
  elements.previewChatThread.innerHTML = "";
  if (!state.previewChat.messages.length) {
    elements.previewChatThread.innerHTML = '<div class="preview-empty">Die Live-Vorschau startet mit deiner Startnachricht.</div>';
    return;
  }

  state.previewChat.messages.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = `preview-chat-message ${message.role}`;
    bubble.textContent = message.content;
    elements.previewChatThread.appendChild(bubble);
  });
  elements.previewChatThread.scrollTop = elements.previewChatThread.scrollHeight;
}

function renderTabs() {
  elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === state.activeTab));
  elements.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === state.activeTab));
}

function renderContextMenu() {
  if (!state.contextMenu.visible) {
    elements.contextMenu.hidden = true;
    return;
  }

  elements.contextMenu.hidden = false;
  elements.contextMenu.style.left = `${state.contextMenu.x}px`;
  elements.contextMenu.style.top = `${state.contextMenu.y}px`;
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3000);
}

function openConfirmModal({ message, onConfirm }) {
  state.confirmAction = onConfirm;
  elements.confirmMessage.textContent = message;
  elements.confirmModal.hidden = false;
}

function closeConfirmModal() {
  state.confirmAction = null;
  elements.confirmModal.hidden = true;
}

function formatSourceUrl(url) {
  return String(url).replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function formatKnowledgeSourceStatus(status) {
  if (status === "synced") return "synchronisiert";
  if (status === "error") return "fehler";
  if (status === "pending") return "in arbeit";
  return "nicht synchronisiert";
}

function openTrainingModal(target) {
  state.trainingTarget = target;
  elements.trainingUserQuestion.value = target.userQuestion;
  elements.trainingUserQuestion.readOnly = Boolean(target.userQuestion);
  elements.trainingPreviousAnswer.value = target.previousBotAnswer;
  elements.trainingPreviousAnswer.readOnly = Boolean(target.previousBotAnswer);
  elements.trainingImprovedAnswer.value = "";
  elements.trainingCategory.value = target.category || "";
  elements.trainingKeywords.value = (target.keywords || []).join(", ");
  elements.trainingModal.hidden = false;
  requestAnimationFrame(() => elements.trainingImprovedAnswer.focus());
}

function closeTrainingModal() {
  state.trainingTarget = null;
  elements.trainingUserQuestion.readOnly = true;
  elements.trainingPreviousAnswer.readOnly = true;
  elements.trainingModal.hidden = true;
}

function render() {
  renderSelectionToolbar();
  renderChatList();
  renderMeta();
  renderThread();
  renderStats();
  renderTrainingEntries();
  renderStudioBuilder();
  renderKnowledgeCenter();
  renderPreviewInsights();
  renderPreviewChat();
  renderOpenAiStatus();
  renderLeads();
  renderAnalyticsPanel();
  renderTabs();
  renderContextMenu();
}

async function loadChats() {
  state.chats = await api("/api/admin/chats");
  state.selectedChatIds = state.selectedChatIds.filter((id) => state.chats.some((chat) => chat.id === id));
  if (!state.selectedChatId && state.chats[0]) {
    state.selectedChatId = state.chats[0].id;
  }
  if (state.selectedChatId && !state.chats.some((chat) => chat.id === state.selectedChatId)) {
    state.selectedChatId = state.chats[0]?.id || null;
  }
}

async function loadSupportingData() {
  state.isAdminReady = false;
  const [analytics, leads, trainingEntries, config, knowledgeLinks] = await Promise.all([
    api("/api/admin/analytics"),
    api("/api/admin/leads"),
    api("/api/admin/training"),
    api("/api/admin/config"),
    api("/api/knowledge-links")
  ]);
  state.analytics = analytics;
  state.leads = leads;
  state.trainingEntries = trainingEntries;
  state.config = {
    ...config,
    knowledgeSources: knowledgeLinks.links || []
  };
  const baseDraft = createStudioDraft(config);
  state.studioDraft = state.hasLoadedConfigOnce
    ? {
        ...baseDraft,
        knowledgeSources: knowledgeLinks.links || [],
        ...state.studioDraft,
        knowledgePrompt: state.studioDraft.knowledgePrompt ?? baseDraft.knowledgePrompt,
        knowledgeSources: Array.isArray(state.studioDraft.knowledgeSources)
          ? state.studioDraft.knowledgeSources
          : baseDraft.knowledgeSources
      }
    : {
        ...baseDraft,
        knowledgeSources: knowledgeLinks.links || []
      };
  if (!state.previewChat.messages.length) {
    resetPreviewChat();
  }
  state.isAdminReady = true;
  state.hasLoadedConfigOnce = true;
}

async function reloadAll() {
  try {
    state.isAdminReady = false;
    await loadChats();
    await loadSupportingData();
  } finally {
    render();
  }
}

elements.chatSearch.addEventListener("input", renderChatList);
elements.statusFilter.addEventListener("change", renderChatList);
elements.toggleSelectionMode.addEventListener("click", () => {
  setSelectionMode(!state.selectionMode);
});
elements.clearSelection.addEventListener("click", () => {
  state.selectedChatIds = [];
  renderSelectionToolbar();
  renderChatList();
});
elements.selectAllChats.addEventListener("click", () => {
  const visibleIds = state.filteredChats.map((chat) => chat.id);
  if (!visibleIds.length) return;
  const nextIds = new Set([...state.selectedChatIds, ...visibleIds]);
  state.selectedChatIds = [...nextIds];
  renderSelectionToolbar();
  renderChatList();
});
elements.bulkDeleteChats.addEventListener("click", () => {
  const ids = [...state.selectedChatIds];
  if (!ids.length) return;
  const message = ids.length === 1
    ? "Bist du sicher, dass du diesen Chat loeschen moechtest?"
    : `Bist du sicher, dass du ${ids.length} Chats loeschen moechtest?`;
  openConfirmModal({
    message,
    onConfirm: async () => {
      try {
        const response = await api("/api/admin/chats/bulk-delete", {
          method: "POST",
          body: JSON.stringify({ ids })
        });
        removeChatsFromState(response.deletedIds || ids);
        closeConfirmModal();
        if (!state.chats.length) {
          setSelectionMode(false);
          render();
        } else {
          render();
        }
        showToast(ids.length === 1 ? "Chat erfolgreich geloescht" : "Chats erfolgreich geloescht");
      } catch (error) {
        showToast(error.message || "Chats konnten nicht geloescht werden", "error");
      }
    }
  });
});

elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.activeTab = tab.dataset.tab;
    renderTabs();
  });
});

[
  [elements.studioBotName, "botName"],
  [elements.studioBotStatus, "botStatus"],
  [elements.studioAvatarUrl, "botAvatarUrl"],
  [elements.studioWelcomeMessage, "welcomeMessage"],
  [elements.studioBotTone, "botTone"],
  [elements.studioBotGoal, "botGoal"],
  [elements.studioForbiddenStatements, "forbiddenStatements"],
  [elements.studioLeadRule, "leadRule"],
  [elements.studioHumanEscalationText, "humanEscalationText"],
  [elements.studioFallbackContact, "fallbackContact"]
].forEach(([element, key]) => {
  element.addEventListener("input", () => updateStudioDraft({ [key]: element.value }));
});

elements.studioAvatarUpload.addEventListener("change", () => {
  const [file] = elements.studioAvatarUpload.files || [];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => updateStudioDraft({ botAvatarUrl: String(reader.result || "") });
  reader.readAsDataURL(file);
});

elements.resetPreviewChat.addEventListener("click", () => {
  resetPreviewChat();
  showToast("Vorschau zurueckgesetzt");
});

elements.previewChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.isAdminReady) {
    showToast("Die Bot-Konfiguration wird noch geladen", "error");
    return;
  }
  const message = elements.previewChatInput.value.trim();
  if (!message) return;
  ensureAdminDefaults();
  const previewConfig = {
    ...(state.config || {}),
    ...(state.studioDraft || createStudioDraft(state.config || {}))
  };

  state.previewChat.messages.push({ role: "user", content: message });
  elements.previewChatInput.value = "";
  elements.previewChatInput.disabled = true;
  elements.previewChatSend.disabled = true;
  renderPreviewChat();

  try {
    const response = await api("/api/admin/preview/reply", {
      method: "POST",
      body: JSON.stringify({
        message,
        profileName: state.previewChat.profile?.name || state.previewChat.profileName,
        chatState: state.previewChat,
        config: {
          ...previewConfig,
          knowledgePrompt: previewConfig.knowledgePrompt || "",
          knowledgeSources: Array.isArray(previewConfig.knowledgeSources) ? previewConfig.knowledgeSources : []
        }
      })
    });
    state.previewChat = {
      ...state.previewChat,
      ...response.chatState,
      profileName: response.chatState?.profile?.name || state.previewChat.profileName || ""
    };
    renderPreviewChat();
  } catch (error) {
    state.previewChat.messages.push({
      role: "assistant",
      content: error.message || "Die Vorschau konnte gerade keine Antwort erzeugen."
    });
    renderPreviewChat();
  } finally {
    elements.previewChatInput.disabled = false;
    elements.previewChatSend.disabled = false;
    elements.previewChatInput.focus();
  }
});

elements.saveChatStatus.addEventListener("click", async () => {
  const chat = getSelectedChat();
  if (!chat) return;
  await api(`/api/admin/chats/${chat.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: elements.chatStatusSelect.value })
  });
  await reloadAll();
  showToast("Status gespeichert");
});

elements.saveChatNote.addEventListener("click", async () => {
  const chat = getSelectedChat();
  if (!chat) return;
  await api(`/api/admin/chats/${chat.id}`, {
    method: "PATCH",
    body: JSON.stringify({ adminNote: elements.chatNote.value })
  });
  await reloadAll();
  showToast("Notiz gespeichert");
});

elements.createTraining.addEventListener("click", () => {
  openTrainingModal({
    chatId: null,
    messageId: null,
    userQuestion: "",
    previousBotAnswer: "",
    category: "",
    keywords: []
  });
});

elements.knowledgePrompt.addEventListener("input", () => {
  elements.knowledgePromptLength.textContent = `${elements.knowledgePrompt.value.length} Zeichen`;
  updateStudioDraft({ knowledgePrompt: elements.knowledgePrompt.value });
});

elements.saveKnowledgePrompt.addEventListener("click", async () => {
  if (!state.isAdminReady) {
    showToast("Die Bot-Konfiguration wird noch geladen", "error");
    return;
  }
  const response = await api("/api/admin/knowledge-prompt", {
    method: "PUT",
    body: JSON.stringify({
      knowledgePrompt: elements.knowledgePrompt.value
    })
  });
  state.config = {
    ...state.config,
    knowledgePrompt: response.knowledgePrompt
  };
  state.studioDraft = {
    ...state.studioDraft,
    knowledgePrompt: response.knowledgePrompt
  };
  renderKnowledgeCenter();
  showToast("Prompt erfolgreich gespeichert");
});

elements.saveKnowledgeSources.addEventListener("click", async () => {
  if (!state.isAdminReady) {
    showToast("Die Bot-Konfiguration wird noch geladen", "error");
    return;
  }
  const input = elements.knowledgeSourcesInput.value.trim();
  if (!input) {
    return;
  }

  try {
    const response = await api("/api/knowledge-links", {
      method: "POST",
      body: JSON.stringify({
        links: input
      })
    });
    state.config = {
      ...state.config,
      knowledgeSources: response.links
    };
    state.studioDraft = {
      ...state.studioDraft,
      knowledgeSources: response.links
    };
    elements.knowledgeSourcesInput.value = "";
    renderKnowledgeCenter();
    renderPreviewInsights();
    showToast("Link erfolgreich gespeichert");
  } catch (error) {
    showToast(error.message || "Links konnten nicht gespeichert werden", "error");
  }
});

elements.syncKnowledgeSources.addEventListener("click", async () => {
  try {
    const response = await api("/api/admin/knowledge-sources/sync", {
      method: "POST",
      body: JSON.stringify({})
    });
    state.config = {
      ...state.config,
      knowledgeSources: response.knowledgeSources
    };
    state.studioDraft = {
      ...state.studioDraft,
      knowledgeSources: response.knowledgeSources
    };
    renderKnowledgeCenter();
    renderPreviewInsights();
    showToast("Quellen aktualisiert");
  } catch (error) {
    showToast(error.message || "Quellen konnten nicht aktualisiert werden", "error");
  }
});

elements.saveStudioConfig.addEventListener("click", async () => {
  if (!state.isAdminReady) {
    showToast("Die Bot-Konfiguration wird noch geladen", "error");
    return;
  }
  try {
    const response = await api("/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({
        botName: state.studioDraft.botName,
        botStatus: state.studioDraft.botStatus,
        botAvatarUrl: state.studioDraft.botAvatarUrl,
        welcomeMessage: state.studioDraft.welcomeMessage,
        botTone: state.studioDraft.botTone,
        botGoal: state.studioDraft.botGoal,
        forbiddenStatements: state.studioDraft.forbiddenStatements,
        leadRule: state.studioDraft.leadRule,
        humanEscalationText: state.studioDraft.humanEscalationText,
        fallbackContact: state.studioDraft.fallbackContact
      })
    });
    state.config = {
      ...state.config,
      ...response
    };
    state.studioDraft = createStudioDraft(state.config);
    render();
    showToast("Einstellungen gespeichert");
  } catch (error) {
    showToast(error.message || "Avatar und Einstellungen konnten nicht gespeichert werden", "error");
  }
});

elements.contextTrain.addEventListener("click", () => {
  const chat = state.chats.find((item) => item.id === state.contextMenu.chatId);
  if (!chat) return;
  const messageIndex = chat.messages.findIndex((message) => message.id === state.contextMenu.messageId);
  const botMessage = chat.messages[messageIndex];
  const userMessage = previousUserMessage(chat.messages, messageIndex);
  state.contextMenu.visible = false;
  renderContextMenu();
  if (!botMessage || !userMessage) return;
  openTrainingModal({
    chatId: chat.id,
    messageId: botMessage.id,
    userQuestion: userMessage.content,
    previousBotAnswer: botMessage.content,
    category: botMessage.meta?.topic || "",
    keywords: []
  });
});

elements.closeTrainingModal.addEventListener("click", closeTrainingModal);
elements.cancelTraining.addEventListener("click", closeTrainingModal);
elements.trainingModal.addEventListener("click", (event) => {
  if (event.target === elements.trainingModal) {
    closeTrainingModal();
  }
});

elements.saveTraining.addEventListener("click", async () => {
  if (!state.trainingTarget) return;
  const improvedAnswer = elements.trainingImprovedAnswer.value.trim();
  if (!improvedAnswer) return;

  await api("/api/admin/training", {
    method: "POST",
    body: JSON.stringify({
      question: state.trainingTarget.userQuestion || elements.trainingUserQuestion.value.trim(),
      previousBotAnswer: state.trainingTarget.previousBotAnswer,
      improvedAnswer,
      sourceChatId: state.trainingTarget.chatId,
      category: elements.trainingCategory.value.trim() || "Allgemein",
      keywords: elements.trainingKeywords.value.split(",").map((item) => item.trim()).filter(Boolean),
      createdBy: "admin"
    })
  });

  closeTrainingModal();
  await reloadAll();
  showToast("Eintrag gespeichert");
});

document.addEventListener("click", (event) => {
  if (!elements.contextMenu.contains(event.target)) {
    state.contextMenu.visible = false;
    renderContextMenu();
  }
});

window.addEventListener("resize", () => {
  state.contextMenu.visible = false;
  renderContextMenu();
});

elements.trainingSearch.addEventListener("input", renderTrainingEntries);
elements.trainingCategoryFilter.addEventListener("input", renderTrainingEntries);
elements.trainingKeywordFilter.addEventListener("input", renderTrainingEntries);
elements.confirmCancel.addEventListener("click", closeConfirmModal);
elements.confirmSubmit.addEventListener("click", async () => {
  if (!state.confirmAction) return;
  const action = state.confirmAction;
  await action();
});
elements.confirmModal.addEventListener("click", (event) => {
  if (event.target === elements.confirmModal) {
    closeConfirmModal();
  }
});

reloadAll();
