(function () {
  if (window.__jonfitWidgetLoaded) return;
  window.__jonfitWidgetLoaded = true;

  var script = document.currentScript;
  var baseUrl = (script && script.dataset.baseUrl ? script.dataset.baseUrl : "https://chatbot-five-orcin-64.vercel.app").replace(/\/$/, "");
  var iframe = document.createElement("iframe");
  var launcher = null;
  var teaser = null;
  var teaserClosed = false;
  var iframeLoaded = false;
  var pendingOpen = false;
  var isOpen = false;
  var configCache = null;

  function clampMobileWidth(width) {
    return Math.min(width, window.innerWidth - 24);
  }

  function getOpenSize() {
    var side = getHorizontalSide();
    if (window.innerWidth < 640) {
      return {
        width: clampMobileWidth(460),
        height: Math.min(Math.round(window.innerHeight * 0.84), 760),
        side: side,
        sideOffset: 12,
        right: 12,
        bottom: 12
      };
    }

    return {
      width: 460,
      height: 760,
      side: side,
      sideOffset: 20,
      right: 20,
      bottom: 20
    };
  }

  function getInterfaceConfig() {
    return (configCache && configCache.interfaceConfig) || {};
  }

  function getHorizontalSide() {
    return getInterfaceConfig().launcherPosition === "left" ? "left" : "right";
  }

  function getLauncherOffsets() {
    var side = getHorizontalSide();
    if (window.innerWidth < 640) {
      return { side: side, sideOffset: 12, bottom: 12 };
    }

    return { side: side, sideOffset: 20, bottom: 20 };
  }

  function getAvatarLabel(name) {
    return (String(name || "JonFit").trim().charAt(0).toUpperCase() || "J");
  }

  function applyAvatar(node, avatarUrl, fallbackLabel) {
    if (!node) return;
    if (avatarUrl) {
      node.style.backgroundImage = 'url("' + avatarUrl + '")';
      node.style.backgroundSize = "cover";
      node.style.backgroundPosition = "center";
      node.textContent = "";
    } else {
      node.style.backgroundImage = "";
      node.textContent = fallbackLabel;
    }
  }

  function applyLauncherPosition() {
    if (!launcher) return;
    var offsets = getLauncherOffsets();
    launcher.style.left = offsets.side === "left" ? offsets.sideOffset + "px" : "auto";
    launcher.style.right = offsets.side === "right" ? offsets.sideOffset + "px" : "auto";
    launcher.style.bottom = offsets.bottom + "px";
  }

  function applyTeaserPosition() {
    if (!teaser || !launcher) return;
    var offsets = getLauncherOffsets();

    if (window.innerWidth < 640) {
      teaser.style.left = offsets.side === "left" ? offsets.sideOffset + "px" : "auto";
      teaser.style.right = offsets.side === "right" ? offsets.sideOffset + "px" : "auto";
      teaser.style.bottom = offsets.bottom + 96 + "px";
      teaser.style.maxWidth = "min(280px, calc(100vw - 24px))";
    } else {
      teaser.style.left = offsets.side === "left" ? offsets.sideOffset + 92 + "px" : "auto";
      teaser.style.right = offsets.side === "right" ? offsets.sideOffset + 92 + "px" : "auto";
      teaser.style.bottom = offsets.bottom + 12 + "px";
      teaser.style.maxWidth = "320px";
    }
  }

  function applyFramePosition(size) {
    iframe.style.left = size.side === "left" ? size.sideOffset + "px" : "auto";
    iframe.style.right = size.side === "right" ? size.sideOffset + "px" : "auto";
    iframe.style.bottom = size.bottom + "px";
  }

  function hideTeaser() {
    if (!teaser) return;
    teaser.style.opacity = "0";
    teaser.style.transform = "translateY(10px)";
    teaser.style.pointerEvents = "none";
    teaser.setAttribute("aria-hidden", "true");
  }

  function showTeaser() {
    if (!teaser || teaserClosed || isOpen) return;
    teaser.style.opacity = "1";
    teaser.style.transform = "translateY(0)";
    teaser.style.pointerEvents = "auto";
    teaser.setAttribute("aria-hidden", "false");
  }

  function removeTeaser() {
    if (!teaser) return;
    teaser.remove();
    teaser = null;
  }

  function buildTeaserText(welcomeMessage) {
    var text = String(welcomeMessage || "").trim();
    if (!text) return "Hey, wie kann ich dir heute helfen?";
    var firstSentenceMatch = text.match(/^[^.!?]+[.!?]?/);
    var candidate = (firstSentenceMatch ? firstSentenceMatch[0] : text).trim();
    return candidate.length <= 90 ? candidate : candidate.slice(0, 87).trim() + "...";
  }

  function hideIframe() {
    isOpen = false;
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.left = "auto";
    iframe.style.right = "auto";
    iframe.style.bottom = "0";
    if (launcher) launcher.style.display = "grid";
  }

  function openIframe() {
    var size = getOpenSize();
    isOpen = true;
    iframe.style.width = size.width + "px";
    iframe.style.height = size.height + "px";
    applyFramePosition(size);
    iframe.style.opacity = "1";
    iframe.style.pointerEvents = "auto";
    if (launcher) launcher.style.display = "none";
    hideTeaser();

    if (iframeLoaded && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "jonfit-chatbot:control", action: "open" }, "*");
    } else {
      pendingOpen = true;
    }
  }

  function renderLauncher(config) {
    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Chat mit JonFit öffnen");
    launcher.style.position = "fixed";
    launcher.style.width = "88px";
    launcher.style.height = "88px";
    launcher.style.padding = "0";
    launcher.style.margin = "0";
    launcher.style.border = "0";
    launcher.style.background = "transparent";
    launcher.style.boxShadow = "none";
    launcher.style.cursor = "pointer";
    launcher.style.display = "grid";
    launcher.style.placeItems = "center";
    launcher.style.zIndex = "999999";

    var avatar = document.createElement("span");
    avatar.style.width = "72px";
    avatar.style.height = "72px";
    avatar.style.borderRadius = "999px";
    avatar.style.display = "grid";
    avatar.style.placeItems = "center";
    avatar.style.backgroundColor = "#1b5a4e";
    avatar.style.color = "#ffffff";
    avatar.style.fontFamily = '"Montserrat","Trebuchet MS","Segoe UI",sans-serif';
    avatar.style.fontWeight = "700";
    avatar.style.fontSize = "1rem";
    avatar.style.backgroundRepeat = "no-repeat";
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
    avatar.style.boxShadow = "none";

    avatar.style.backgroundColor = (config && config.interfaceConfig && config.interfaceConfig.primaryColor) || "#1b5a4e";
    applyAvatar(avatar, config && config.botAvatarUrl, getAvatarLabel(config && config.botName));
    launcher.appendChild(avatar);
    applyLauncherPosition();

    launcher.addEventListener("click", function () {
      openIframe();
    });

    document.body.appendChild(launcher);
  }

  function renderTeaser(config) {
    teaser = document.createElement("div");
    teaser.setAttribute("aria-hidden", "true");
    teaser.style.position = "fixed";
    teaser.style.padding = "10px 12px";
    teaser.style.borderRadius = "16px";
    teaser.style.background = "rgba(255,255,255,0.97)";
    teaser.style.color = "#162621";
    teaser.style.fontFamily = '"Montserrat","Trebuchet MS","Segoe UI",sans-serif';
    teaser.style.fontSize = "15px";
    teaser.style.lineHeight = "1.35";
    teaser.style.zIndex = "999998";
    teaser.style.boxShadow = "0 18px 40px rgba(15, 35, 30, 0.16)";
    teaser.style.border = "1px solid rgba(18,39,34,0.08)";
    teaser.style.opacity = "0";
    teaser.style.transform = "translateY(10px)";
    teaser.style.transition = "opacity 260ms ease, transform 260ms ease";
    teaser.style.display = "flex";
    teaser.style.alignItems = "flex-start";
    teaser.style.gap = "10px";

    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Hinweis schliessen");
    closeButton.textContent = "×";
    closeButton.style.width = "26px";
    closeButton.style.height = "26px";
    closeButton.style.border = "0";
    closeButton.style.borderRadius = "999px";
    closeButton.style.background = "rgba(22,38,33,0.06)";
    closeButton.style.color = "#62726b";
    closeButton.style.cursor = "pointer";
    closeButton.style.flex = "0 0 26px";
    closeButton.style.fontSize = "18px";
    closeButton.style.lineHeight = "1";
    closeButton.style.padding = "0";

    var openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = buildTeaserText(config && config.welcomeMessage);
    openButton.style.flex = "1";
    openButton.style.border = "0";
    openButton.style.background = "transparent";
    openButton.style.color = "#162621";
    openButton.style.cursor = "pointer";
    openButton.style.textAlign = "left";
    openButton.style.padding = "2px 2px 2px 0";
    openButton.style.font = "inherit";
    openButton.style.color = (config && config.interfaceConfig && config.interfaceConfig.headerColor) || "#162621";

    openButton.addEventListener("click", function () {
      teaserClosed = true;
      hideTeaser();
      openIframe();
    });

    closeButton.addEventListener("click", function (event) {
      event.stopPropagation();
      teaserClosed = true;
      hideTeaser();
    });

    teaser.appendChild(closeButton);
    teaser.appendChild(openButton);
    document.body.appendChild(teaser);
    applyTeaserPosition();

    window.setTimeout(showTeaser, 3000);
  }

  function ensureConfig() {
    if (configCache) return Promise.resolve(configCache);
    return fetch(baseUrl + "/api/public/config")
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (config) {
        configCache = config || {};
        return configCache;
      })
      .catch(function () {
        configCache = {};
        return configCache;
      });
  }

  iframe.id = "jonfit-chatbot-frame";
  iframe.src = baseUrl + "/widget-wix";
  iframe.allow = "clipboard-write";
  iframe.setAttribute("allowtransparency", "true");
  iframe.setAttribute("scrolling", "no");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.background = "transparent";
  iframe.style.display = "block";
  iframe.style.overflow = "hidden";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "999999";

  iframe.addEventListener("load", function () {
    iframeLoaded = true;
    if (pendingOpen && iframe.contentWindow) {
      pendingOpen = false;
      iframe.contentWindow.postMessage({ type: "jonfit-chatbot:control", action: "open" }, "*");
    }
  });

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "jonfit-chatbot:resize") return;

    if (event.data.state === "open") {
      isOpen = true;
      var width = Number(event.data.width) || 460;
      var height = Number(event.data.height) || 760;
      var size = getOpenSize();
      iframe.style.width = Math.min(width, size.width) + "px";
      iframe.style.height = Math.min(height, size.height) + "px";
      applyFramePosition(size);
      iframe.style.opacity = "1";
      iframe.style.pointerEvents = "auto";
      if (launcher) launcher.style.display = "none";
      hideTeaser();
      return;
    }

    hideIframe();
  });

  window.addEventListener("resize", function () {
    applyLauncherPosition();
    applyTeaserPosition();

    if (isOpen) {
      var size = getOpenSize();
      iframe.style.width = size.width + "px";
      iframe.style.height = size.height + "px";
      applyFramePosition(size);
    }
  });

  document.body.appendChild(iframe);
  hideIframe();

  ensureConfig().then(function (config) {
    renderLauncher(config);
    renderTeaser(config);
  });
})();
