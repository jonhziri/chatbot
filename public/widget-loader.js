(function () {
  if (window.__jonfitWidgetLoaded) return;
  window.__jonfitWidgetLoaded = true;

  var script = document.currentScript;
  var baseUrl = (script && script.dataset.baseUrl ? script.dataset.baseUrl : "https://chatbot-five-orcin-64.vercel.app").replace(/\/$/, "");
  var opener = null;
  var teaserClosed = false;

  var iframe = document.createElement("iframe");
  var defaultClosedWidth = 132;
  var defaultClosedHeight = 132;

  iframe.id = "jonfit-chatbot-frame";
  iframe.src = baseUrl + "/widget-wix";
  iframe.allow = "clipboard-write";
  iframe.setAttribute("allowtransparency", "true");
  iframe.setAttribute("scrolling", "no");
  iframe.style.position = "fixed";
  iframe.style.right = "20px";
  iframe.style.bottom = "20px";
  iframe.style.width = defaultClosedWidth + "px";
  iframe.style.height = defaultClosedHeight + "px";
  iframe.style.border = "0";
  iframe.style.background = "transparent";
  iframe.style.display = "block";
  iframe.style.overflow = "hidden";
  iframe.style.zIndex = "999999";

  function getTeaserText(welcomeMessage) {
    var text = String(welcomeMessage || "").trim();
    if (!text) return "Hey, wie kann ich dir heute helfen?";

    var firstSentenceMatch = text.match(/^[^.!?]+[.!?]?/);
    var candidate = (firstSentenceMatch ? firstSentenceMatch[0] : text).trim();
    return candidate.length <= 90 ? candidate : candidate.slice(0, 87).trim() + "...";
  }

  function removeOpener() {
    if (opener) {
      opener.remove();
      opener = null;
    }
  }

  function applyOpenerLayout() {
    if (!opener) return;

    if (window.innerWidth < 640) {
      opener.style.right = "12px";
      opener.style.left = "auto";
      opener.style.bottom = "120px";
      opener.style.maxWidth = "min(280px, calc(100vw - 24px))";
    } else {
      opener.style.right = "116px";
      opener.style.left = "auto";
      opener.style.bottom = "54px";
      opener.style.maxWidth = "280px";
    }
  }

  function renderOpener(text) {
    if (teaserClosed || opener) {
      return;
    }

    opener = document.createElement("div");
    opener.style.position = "fixed";
    opener.style.padding = "10px 12px";
    opener.style.borderRadius = "16px";
    opener.style.background = "rgba(255,255,255,0.97)";
    opener.style.color = "#162621";
    opener.style.fontFamily = '"Montserrat","Trebuchet MS","Segoe UI",sans-serif';
    opener.style.fontSize = "15px";
    opener.style.lineHeight = "1.35";
    opener.style.zIndex = "999998";
    opener.style.boxShadow = "0 18px 40px rgba(15, 35, 30, 0.16)";
    opener.style.border = "1px solid rgba(18,39,34,0.08)";
    opener.style.opacity = "0";
    opener.style.transform = "translateY(10px)";
    opener.style.transition = "opacity 260ms ease, transform 260ms ease";
    opener.style.display = "flex";
    opener.style.alignItems = "flex-start";
    opener.style.gap = "10px";

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
    openButton.textContent = text;
    openButton.style.flex = "1";
    openButton.style.border = "0";
    openButton.style.background = "transparent";
    openButton.style.color = "#162621";
    openButton.style.cursor = "pointer";
    openButton.style.textAlign = "left";
    openButton.style.padding = "2px 2px 2px 0";
    openButton.style.font = "inherit";

    openButton.addEventListener("click", function () {
      iframe.contentWindow && iframe.contentWindow.postMessage({
        type: "jonfit-chatbot:control",
        action: "open"
      }, "*");
      teaserClosed = true;
      removeOpener();
    });

    closeButton.addEventListener("click", function (event) {
      event.stopPropagation();
      teaserClosed = true;
      removeOpener();
    });

    opener.appendChild(closeButton);
    opener.appendChild(openButton);
    document.body.appendChild(opener);
    applyOpenerLayout();
    requestAnimationFrame(function () {
      if (!opener) return;
      opener.style.opacity = "1";
      opener.style.transform = "translateY(0)";
    });
  }

  function applySize(width, height) {
    iframe.style.width = width + "px";
    iframe.style.height = height + "px";
  }

  function applyOffsets() {
    if (window.innerWidth < 640) {
      iframe.style.right = "12px";
      iframe.style.bottom = "12px";
    } else {
      iframe.style.right = "20px";
      iframe.style.bottom = "20px";
    }
  }

  function applyClosedSize() {
    var width = defaultClosedWidth;
    var height = defaultClosedHeight;

    if (window.innerWidth < 640) {
      width = Math.min(defaultClosedWidth, window.innerWidth - 24);
      height = defaultClosedHeight;
    }

    applySize(width, height);
  }

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "jonfit-chatbot:resize") return;

    var width = Number(event.data.width) || defaultClosedWidth;
    var height = Number(event.data.height) || defaultClosedHeight;

    if (window.innerWidth < 640) {
      width = Math.min(width, window.innerWidth - 24);
      height = Math.min(height, Math.round(window.innerHeight * 0.84));
    }

    applyOffsets();
    applySize(width, height);

    if (event.data.state === "open") {
      teaserClosed = true;
      removeOpener();
    }
  });

  window.addEventListener("resize", function () {
    applyOffsets();
    applyClosedSize();
    applyOpenerLayout();
  });

  applyOffsets();
  applyClosedSize();
  document.body.appendChild(iframe);

  window.setTimeout(function () {
    fetch(baseUrl + "/api/public/config")
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (config) {
        renderOpener(getTeaserText(config && config.welcomeMessage));
      })
      .catch(function () {
        renderOpener("Hey, wie kann ich dir heute helfen?");
      });
  }, 3000);
})();
