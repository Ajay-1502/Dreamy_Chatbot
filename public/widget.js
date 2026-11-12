/*
 * Dreamy chat widget for webdreams.in
 * Add to any page:
 *   <script src="https://YOUR-SERVER/widget.js" data-api="https://YOUR-SERVER"></script>
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var API = ((script && script.getAttribute("data-api")) || "").replace(/\/$/, "");
  var STORAGE_KEY = "webdreams-dreamy-chat";
  var GREETING =
    "Hi! I'm Dreamy, the WebDreams virtual assistant. Are you looking for a website, online store, SEO or digital marketing?";
  var history = [];

  try {
    var saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) history = saved;
  } catch (e) {}

  function save() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {}
  }

  var css =
    ".wd-btn{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:0;background:#1f4fd8;color:#fff;font-size:26px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:2147483000}" +
    ".wd-btn:focus-visible,.wd-send:focus-visible,.wd-close:focus-visible{outline:3px solid #ffb703;outline-offset:2px}" +
    ".wd-panel{position:fixed;right:20px;bottom:92px;width:360px;max-width:calc(100vw - 24px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".wd-panel.wd-open{display:flex}" +
    ".wd-head{background:#1f4fd8;color:#fff;padding:12px 14px;display:flex;align-items:center;justify-content:space-between}" +
    ".wd-head b{font-size:15px}.wd-head small{display:block;opacity:.85;font-size:12px}" +
    ".wd-close{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1}" +
    ".wd-msgs{flex:1;overflow-y:auto;padding:12px;background:#f4f6fb;display:flex;flex-direction:column;gap:8px}" +
    ".wd-m{max-width:85%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word}" +
    ".wd-bot{background:#fff;color:#1b1f2a;align-self:flex-start;border:1px solid #e1e5ee}" +
    ".wd-user{background:#1f4fd8;color:#fff;align-self:flex-end}" +
    ".wd-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e1e5ee;background:#fff}" +
    ".wd-in{flex:1;border:1px solid #c9cfdd;border-radius:20px;padding:9px 14px;font-size:14px;outline:none}" +
    ".wd-in:focus{border-color:#1f4fd8}" +
    ".wd-send{border:0;background:#1f4fd8;color:#fff;border-radius:20px;padding:0 16px;font-size:14px;cursor:pointer}" +
    ".wd-send:disabled{opacity:.5;cursor:default}" +
    ".wd-wa{font-size:12px;text-align:center;padding:6px;background:#fff;color:#555}" +
    ".wd-wa a{color:#1f4fd8}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  var btn = el("button", "wd-btn", "💬");
  btn.setAttribute("aria-label", "Chat with WebDreams");
  btn.setAttribute("aria-expanded", "false");

  var panel = el("div", "wd-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat with Dreamy");

  var head = el("div", "wd-head");
  var title = el("div");
  title.appendChild(el("b", "", "Dreamy"));
  title.appendChild(el("small", "", "WebDreams India assistant"));
  var close = el("button", "wd-close", "×");
  close.setAttribute("aria-label", "Close chat");
  head.appendChild(title);
  head.appendChild(close);

  var msgs = el("div", "wd-msgs");
  msgs.setAttribute("aria-live", "polite");

  var form = el("form", "wd-form");
  var input = el("input", "wd-in");
  input.type = "text";
  input.placeholder = "Type your message...";
  input.maxLength = 1000;
  input.setAttribute("aria-label", "Your message");
  var send = el("button", "wd-send", "Send");
  send.type = "submit";
  form.appendChild(input);
  form.appendChild(send);

  var wa = el("div", "wd-wa");
  wa.appendChild(document.createTextNode("Prefer WhatsApp? "));
  var waLink = el("a", "", "Chat on 97411 97999");
  waLink.href = "https://api.whatsapp.com/send?phone=919741197999&text=Hello";
  waLink.target = "_blank";
  waLink.rel = "noopener";
  wa.appendChild(waLink);

  panel.appendChild(head);
  panel.appendChild(msgs);
  panel.appendChild(form);
  panel.appendChild(wa);
  document.body.appendChild(panel);
  document.body.appendChild(btn);

  function addMsg(role, text) {
    var m = el("div", "wd-m " + (role === "user" ? "wd-user" : "wd-bot"), text);
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  }

  function render() {
    msgs.textContent = "";
    addMsg("assistant", GREETING);
    history.forEach(function (m) {
      addMsg(m.role, m.content);
    });
  }

  function toggle(open) {
    var willOpen = typeof open === "boolean" ? open : !panel.classList.contains("wd-open");
    panel.classList.toggle("wd-open", willOpen);
    btn.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) input.focus();
  }

  btn.addEventListener("click", function () {
    toggle();
  });
  close.addEventListener("click", function () {
    toggle(false);
    btn.focus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("wd-open")) toggle(false);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    history.push({ role: "user", content: text });
    save();
    addMsg("user", text);
    var typing = addMsg("assistant", "Typing...");
    send.disabled = true;

    fetch(API + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return data;
        });
      })
      .then(function (data) {
        var reply =
          (data && data.reply) ||
          "Sorry, something went wrong. Please WhatsApp us on 97411 97999.";
        typing.textContent = reply;
        history.push({ role: "assistant", content: reply });
        save();
      })
      .catch(function () {
        typing.textContent =
          "Sorry, I can't connect right now. Please WhatsApp us on 97411 97999 or call 0836-4258918.";
        // Drop the unanswered user message so the history keeps alternating roles.
        history.pop();
        save();
      })
      .then(function () {
        send.disabled = false;
        msgs.scrollTop = msgs.scrollHeight;
        input.focus();
      });
  });

  render();
})();
