(function () {
  const script = document.currentScript;
  const baseUrl = script && script.dataset.baseUrl ? script.dataset.baseUrl.replace(/\/$/, "") : "";
  const button = document.createElement("button");
  const frame = document.createElement("iframe");
  let open = false;

  button.type = "button";
  button.textContent = "JonFit Chat";
  button.setAttribute(
    "style",
    [
      "position:fixed",
      "right:24px",
      "bottom:24px",
      "z-index:9999",
      "border:none",
      "border-radius:999px",
      "padding:14px 18px",
      "background:#ca5a2e",
      "color:#fff",
      "font:600 15px sans-serif",
      "box-shadow:0 12px 30px rgba(0,0,0,.2)",
      "cursor:pointer"
    ].join(";")
  );

  frame.src = `${baseUrl}/`;
  frame.title = "JonFit Chat Widget";
  frame.setAttribute(
    "style",
    [
      "position:fixed",
      "right:24px",
      "bottom:84px",
      "width:min(420px,calc(100vw - 32px))",
      "height:min(760px,calc(100vh - 120px))",
      "border:none",
      "border-radius:24px",
      "overflow:hidden",
      "box-shadow:0 24px 50px rgba(0,0,0,.22)",
      "display:none",
      "z-index:9998",
      "background:#fff"
    ].join(";")
  );

  button.addEventListener("click", function () {
    open = !open;
    frame.style.display = open ? "block" : "none";
  });

  document.body.appendChild(button);
  document.body.appendChild(frame);
})();
