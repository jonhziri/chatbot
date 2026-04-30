(function () {
  if (window.__jonfitWidgetLoaded) return;
  window.__jonfitWidgetLoaded = true;

  var script = document.currentScript;
  var baseUrl = (script && script.dataset.baseUrl ? script.dataset.baseUrl : "https://chatbot-five-orcin-64.vercel.app").replace(/\/$/, "");
  var opener = null;
  var teaserClosed = false;

  var iframe = document.createElement("iframe");
  var defaultClosedWidth = 96;
  var defaultClosedHeight = 96;

  iframe.id = "jonfit-chatbot-frame";
  iframe.src = baseUrl + "/widget-simple";
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

  function renderOpener(text) {
    if (teaserClosed || opener) {
      return;
    }

    opener = document.createElement("div");
    opener.style.position = "fixed";
    opener.style.right = "116px";
    opener.style.bottom = "30px";
    opener.style.maxWidth = "280px";
    opener.style.padding = "12px 14px";
    opener.style.borderRadius = "16px";
    opener.style.background = "rgba(255,255,255,0.97)";
    opener.style.color = "#162621";
    opener.style.fontFamily = '"Montserrat","Trebuchet MS","Segoe UI",sans-serif';
    opener.style.fontSize = "15px";
    opener.style.lineHeight = "1.35";
    opener.style.zIndex = "999998";
    opener.style.boxShadow = "0 18px 40px rgba(15, 35, 30, 0.16)";
    opener.style.border = "1px solid rgba(18,39,34,0.08)";
    opener.style.cursor = "pointer";
    opener.style.opacity = "0";
    opener.style.transform = "translateY(8px)";
    opener.style.transition = "opacity 220ms ease, transform 220ms ease";
    opener.textContent = text;

    opener.addEventListener("click", function () {
      iframe.contentWindow && iframe.contentWindow.postMessage({
        type: "jonfit-chatbot:control",
        action: "open"
      }, "*");
      teaserClosed = true;
      removeOpener();
    });

    document.body.appendChild(opener);
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
