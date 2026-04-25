(function () {
  if (window.__jonfitWidgetLoaded) return;
  window.__jonfitWidgetLoaded = true;

  var script = document.currentScript;
  var baseUrl = (script && script.dataset.baseUrl ? script.dataset.baseUrl : "https://chatbot-five-orcin-64.vercel.app").replace(/\/$/, "");

  var iframe = document.createElement("iframe");
  var defaultClosedWidth = 380;
  var defaultClosedHeight = 180;

  iframe.id = "jonfit-chatbot-frame";
  iframe.src = baseUrl + "/widget";
  iframe.allow = "clipboard-write";
  iframe.style.position = "fixed";
  iframe.style.right = "20px";
  iframe.style.bottom = "20px";
  iframe.style.width = defaultClosedWidth + "px";
  iframe.style.height = defaultClosedHeight + "px";
  iframe.style.border = "0";
  iframe.style.background = "transparent";
  iframe.style.overflow = "hidden";
  iframe.style.zIndex = "999999";

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
      width = Math.min(330, window.innerWidth - 24);
      height = 180;
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
  });

  window.addEventListener("resize", function () {
    applyOffsets();
    applyClosedSize();
  });

  applyOffsets();
  applyClosedSize();
  document.body.appendChild(iframe);
})();
