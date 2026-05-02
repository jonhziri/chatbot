let sessionId = null;
let clientChatState = null;
const widgetPath = window.location.pathname;
const simpleWidgetMode =
  document.body.classList.contains("widget-simple-mode") ||
  widgetPath === "/widget-simple" ||
  widgetPath === "/widget-sample" ||
  widgetPath === "/widget-wix";
const embedMode = document.body.classList.contains("embed-mode") || widgetPath === "/widget" || simpleWidgetMode;
const teaserDelayMs = embedMode ? 450 : 3000;
const widgetEntranceDelayMs = embedMode ? 2000 : 0;
const widgetEntranceDurationMs = embedMode ? 420 : 0;
const defaultTeaserMessage = "Hey, wie kann ich dir heute helfen?";
const embedMessageType = "jonfit-chatbot:resize";
const embedControlMessageType = "jonfit-chatbot:control";
let teaserTimer = null;
let teaserHandled = false;
let isAwaitingReply = false;
let closeTimer = null;
let widgetEntered = !embedMode;

const elements = {
  widget: document.querySelector(".chat-widget"),
  launcher: document.getElementById("chat-launcher"),
  launcherAvatar: document.getElementById("launcher-avatar"),
  close: document.getElementById("chat-close"),
  teaser: document.getElementById("chat-teaser"),
  teaserOpen: document.getElementById("teaser-open"),
  teaserDismiss: document.getElementById("teaser-dismiss"),
  teaserText: document.getElementById("teaser-text"),
  messages: document.getElementById("messages"),
  chatForm: document.getElementById("chat-form"),
  messageInput: document.getElementById("message-input"),
  welcomePreview: document.getElementById("welcome-preview"),
  botName: document.getElementById("bot-name"),
  headerAvatar: document.getElementById("header-avatar"),
  chatWindow: document.getElementById("chat-window")
};

if (embedMode) {
  document.body.classList.add("embed-mode");
  document.querySelector(".demo-shell")?.remove();
  elements.widget.classList.add("widget-pre-enter");
}

function getEmbedDimensions() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isOpen = elements.widget.dataset.state === "open";
  const teaserVisible = elements.teaser.classList.contains("visible");

  if (isOpen) {
    return {
      width: viewportWidth <= 640 ? viewportWidth : Math.min(460, viewportWidth),
      height: viewportWidth <= 640 ? viewportHeight : Math.min(760, viewportHeight)
    };
  }

  if (simpleWidgetMode) {
    return {
      width: 132,
      height: 132
    };
  }

  if (teaserVisible) {
    return {
      width: Math.min(viewportWidth, 430),
      height: 132
    };
  }

  return {
    width: 132,
    height: 132
  };
}

function postEmbedResize() {
  if (!embedMode || window.parent === window) {
    return;
  }

  const { width, height } = getEmbedDimensions();
  window.parent.postMessage(
    {
      type: embedMessageType,
      width,
      height,
      state: elements.widget.dataset.state
    },
    "*"
  );
}

function avatarFallbackLabel(name) {
  return (name || "JonFit").trim().charAt(0).toUpperCase() || "J";
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

function buildTeaserMessage(welcomeMessage) {
  const text = String(welcomeMessage || "").trim();
  if (!text) return defaultTeaserMessage;

  const firstSentence = text.match(/^[^.!?]+[.!?]?/);
  const candidate = (firstSentence ? firstSentence[0] : text).trim();

  if (candidate.length <= 90) {
    return candidate;
  }

  return `${candidate.slice(0, 87).trim()}...`;
}

function applyBotIdentity(config) {
  const botName = config.botName || "JonFit Assist";
  const avatarUrl = config.botAvatarUrl || "";
  const avatarLabel = avatarFallbackLabel(botName);
  const teaserMessage = buildTeaserMessage(config.welcomeMessage);

  elements.botName.textContent = botName;
  elements.welcomePreview.textContent = "Jetzt online";
  if (elements.teaserText) {
    elements.teaserText.textContent = teaserMessage;
  }

  [elements.launcherAvatar, elements.headerAvatar].forEach((element) => {
    applyAvatar(element, avatarUrl, avatarLabel);
  });
}

function extractFirstUrl(text) {
  const value = String(text || "");
  const markdownMatch = value.match(/\[[^\]]+\]\(\s*(https?:\/\/[^\s)]+)\s*\)/i);
  const rawMatch = value.match(/https?:\/\/[^\s<>"'\]\[()]+/i);
  const rawUrl = markdownMatch?.[1] || rawMatch?.[0] || "";
  const cleanedUrl = rawUrl
    .split("](")[0]
    .replace(/[.,!?:;\])]+$/, "")
    .trim();

  if (!cleanedUrl) return null;

  try {
    return new URL(cleanedUrl).href;
  } catch (error) {
    return null;
  }
}

function resolveRedirectUrl(url, content = "", meta = {}) {
  const text = `${content} ${url} ${meta?.topic || ""}`.toLowerCase();

  if (text.includes("pbohnetrainer") || /probetraining[^.?!]*(ohne trainer)|ohne trainer[^.?!]*probetraining/.test(text)) {
    return "https://www.jonfit.de/pbohnetrainer";
  }

  if (
    text.includes("pbmittrainer") ||
    text.includes("service-page/probetraining") ||
    /probetraining/.test(text)
  ) {
    return "https://www.jonfit.de/pbmittrainer";
  }

  return url;
}

function buildRedirectLabel(url, meta = {}, content = "") {
  const topic = String(meta?.topic || "").toLowerCase();
  const text = `${content} ${url}`.toLowerCase();

  if (topic.includes("kurs") || text.includes("/kurse") || text.includes("kurs")) {
    return "Zur Kursseite";
  }
  if (topic.includes("probetraining") || text.includes("probetraining")) {
    return "Zum Probetraining";
  }
  if (topic.includes("mitglied") || text.includes("mitglied")) {
    return "Zu den Mitgliedschaften";
  }
  if (topic.includes("kontakt") || text.includes("kontakt")) {
    return "Zur Kontaktseite";
  }
  if (text.includes("termin") || text.includes("buch")) {
    return "Zur Buchungsseite";
  }

  return "Zur Website";
}

function cleanAssistantMessage(content, redirectUrl) {
  let text = String(content || "").trim();
  if (!redirectUrl) return text;

  const escapedUrl = redirectUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  text = text
    .replace(/\[[^\]]+\]\(\s*https?:\/\/[^)\s]+\s*\)/gi, "")
    .replace(/https?:\/\/[^\s<>"'\]\[()]+/gi, "")
    .replace(new RegExp(escapedUrl, "gi"), "");
  text = text
    .replace(/Hier ist der (direkte )?Link[^.?!:]*:\s*/gi, "")
    .replace(/Hier findest du den (direkten )?Link[^.?!:]*:\s*/gi, "")
    .replace(/Den (direkten )?Link findest du hier[^.?!:]*:\s*/gi, "")
    .replace(/Wenn du magst,[^.?!]*(Link|link)[^.?!]*[.?!]/gi, "")
    .replace(/Moechtest du[^.?!]*(Link|link)[^.?!]*[?!.]/gi, "")
    .replace(/Möchtest du[^.?!]*(Link|link)[^.?!]*[?!.]/gi, "")
    .replace(/Soll ich dir[^.?!]*(Link|link)[^.?!]*[?!.]/gi, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\]\s*/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/unter\s*\./gi, "auf unserer Website.")
    .replace(/unter\s*:/gi, "auf unserer Website:")
    .replace(/:\s*(?=[.!?]|$)/g, "")
    .replace(/\s+:\s*/g, ": ")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\.\s*\./g, ".")
    .trim();

  return text;
}

function isHighlightKeyword(word) {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(String(word || ""))) {
    return true;
  }

  const normalized = String(word || "")
    .toLowerCase()
    .replace(/[.,!?;:()[\]'"„“]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");

  return [
    "probetraining",
    "trainer",
    "kurs",
    "kurse",
    "kursplan",
    "kursseite",
    "mitgliedschaft",
    "mitgliedschaften",
    "preis",
    "preise",
    "angebot",
    "angebote",
    "aktion",
    "aktionen",
    "oeffnungszeiten",
    "app",
    "link",
    "termin",
    "rueckruf",
    "kontakt",
    "jonfit"
  ].includes(normalized);
}

function renderTextWithFade(element, text) {
  const fragment = document.createDocumentFragment();
  let visibleIndex = 0;

  String(text || "").split(/(\s+)/).forEach((part) => {
    if (!part) return;

    if (part.includes("\n")) {
      part.split("\n").forEach((line, index) => {
        if (index > 0) {
          fragment.appendChild(document.createElement("br"));
        }
        if (line) {
          const word = document.createElement("span");
          word.className = `fade-word${isHighlightKeyword(line) ? " keyword" : ""}`;
          line.split("").forEach((character) => {
            const letter = document.createElement("span");
            letter.className = "fade-letter";
            letter.textContent = character;
            letter.style.animationDelay = `${Math.min(visibleIndex * 14, 900)}ms`;
            visibleIndex += 1;
            word.appendChild(letter);
          });
          fragment.appendChild(word);
        }
      });
      return;
    }

    if (/^\s+$/.test(part)) {
      fragment.appendChild(document.createTextNode(part));
      return;
    }

    const word = document.createElement("span");
    word.className = `fade-word${isHighlightKeyword(part) ? " keyword" : ""}`;
    part.split("").forEach((character) => {
      const span = document.createElement("span");
      span.className = "fade-letter";
      span.textContent = character;
      span.style.animationDelay = `${Math.min(visibleIndex * 14, 900)}ms`;
      visibleIndex += 1;
      word.appendChild(span);
    });

    fragment.appendChild(word);
  });

  element.textContent = "";
  element.appendChild(fragment);
}

function addMessage(role, content, meta = {}) {
  const rawRedirectUrl = role === "assistant" ? extractFirstUrl(content) : null;
  const redirectUrl = rawRedirectUrl ? resolveRedirectUrl(rawRedirectUrl, content, meta) : null;
  const displayContent = role === "assistant" ? cleanAssistantMessage(content, redirectUrl) : content;
  const el = document.createElement("article");
  el.className = `message ${role}`;
  const copy = document.createElement("div");
  copy.className = "message-copy";

  if (role === "assistant") {
    renderTextWithFade(copy, displayContent);
  } else {
    copy.textContent = displayContent;
  }

  el.appendChild(copy);

  if (role === "assistant") {
    if (redirectUrl) {
      const cta = document.createElement("a");
      cta.className = "message-cta";
      cta.href = redirectUrl;
      cta.textContent = buildRedirectLabel(redirectUrl, meta, content);
      cta.target = "_blank";
      cta.rel = "noopener noreferrer";
      el.appendChild(cta);
    }
  }

  elements.messages.appendChild(el);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function createTypingIndicator() {
  const el = document.createElement("article");
  el.className = "message assistant typing-indicator";
  el.innerHTML = `
    <div class="typing-dots" aria-label="JonFit Assist schreibt gerade">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  return el;
}

function setComposerDisabled(disabled) {
  isAwaitingReply = disabled;
  elements.messageInput.disabled = disabled;
  elements.chatForm.querySelector("button[type='submit']").disabled = disabled;
  elements.messageInput.placeholder = disabled ? "JonFit Assist antwortet gerade ..." : "Nachricht schreiben ...";
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  return response.json();
}

function setOpenState(isOpen) {
  if (isOpen) {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    elements.widget.dataset.state = "open";
    elements.launcher.setAttribute("aria-expanded", "true");
    elements.chatWindow.setAttribute("aria-hidden", "false");
    hideTeaser(true);
    requestAnimationFrame(() => elements.messageInput.focus());
    postEmbedResize();
    return;
  }

  elements.widget.dataset.state = "closing";
  elements.launcher.setAttribute("aria-expanded", "false");
  elements.chatWindow.setAttribute("aria-hidden", "true");

  closeTimer = window.setTimeout(() => {
    elements.widget.dataset.state = "closed";
    closeTimer = null;
    postEmbedResize();
  }, 220);
}

function hideTeaser(remember = false) {
  if (simpleWidgetMode) {
    if (remember) {
      teaserHandled = true;
    }
    return;
  }

  if (teaserTimer) {
    clearTimeout(teaserTimer);
    teaserTimer = null;
  }

  elements.teaser.classList.remove("visible");
  elements.teaser.setAttribute("aria-hidden", "true");

  if (remember) {
    teaserHandled = true;
  }

  postEmbedResize();
}

function showTeaser() {
  if (simpleWidgetMode) {
    return;
  }

  elements.teaser.classList.add("visible");
  elements.teaser.setAttribute("aria-hidden", "false");
  postEmbedResize();
}

function maybeShowTeaser() {
  if (simpleWidgetMode) {
    return;
  }

  if (teaserHandled || !widgetEntered) {
    return;
  }

  teaserTimer = window.setTimeout(() => {
    if (elements.widget.dataset.state === "open") {
      return;
    }

    showTeaser();
  }, teaserDelayMs);
}

function startWidgetEntrance() {
  if (!embedMode) {
    maybeShowTeaser();
    return;
  }

  window.setTimeout(() => {
    elements.widget.classList.remove("widget-pre-enter");
    elements.widget.classList.add("widget-entered");
    widgetEntered = true;
    postEmbedResize();

    window.setTimeout(() => {
      maybeShowTeaser();
    }, widgetEntranceDurationMs);
  }, widgetEntranceDelayMs);
}

async function bootstrap() {
  const config = await fetchJson("/api/public/config");
  applyBotIdentity(config);
  if (simpleWidgetMode) {
    teaserHandled = true;
    elements.teaser.setAttribute("aria-hidden", "true");
  }

  const chat = await fetchJson("/api/chat/start", { method: "POST", body: "{}" });
  sessionId = chat.id;
  clientChatState = chat;
  chat.messages.forEach((message) => addMessage(message.role, message.content, message.meta));
  postEmbedResize();
}

elements.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = elements.messageInput.value.trim();
  if (!message || !sessionId || isAwaitingReply) {
    return;
  }

  addMessage("user", message);
  elements.messageInput.value = "";
  setComposerDisabled(true);
  const typingIndicator = createTypingIndicator();
  elements.messages.appendChild(typingIndicator);
  elements.messages.scrollTop = elements.messages.scrollHeight;

  try {
    const payload = await fetchJson("/api/chat/message", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        message,
        clientChat: clientChatState
      })
    });

    typingIndicator.remove();
    clientChatState = payload.chat || clientChatState;
    addMessage("assistant", payload.reply, payload.meta);
  } finally {
    typingIndicator.remove();
    setComposerDisabled(false);
    elements.messageInput.focus();
  }
});

elements.launcher.addEventListener("click", () => setOpenState(true));
elements.close.addEventListener("click", () => setOpenState(false));
elements.teaserOpen.addEventListener("click", () => setOpenState(true));
elements.teaserDismiss.addEventListener("click", () => hideTeaser(true));

window.addEventListener("resize", postEmbedResize);
window.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== embedControlMessageType) {
    return;
  }

  if (event.data.action === "open") {
    setOpenState(true);
  }
});

bootstrap();
startWidgetEntrance();
