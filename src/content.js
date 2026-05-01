(() => {
  const PROCESSED = "data-humanly-processed";
  const LEVELS = ["subtle", "human", "ceo"];

  const debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const escapeHtml = (s) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  function getComposeBody(dialog) {
    return (
      dialog.querySelector(
        'div[aria-label="Message Body"][contenteditable="true"]'
      ) ||
      dialog.querySelector('div[g_editable="true"][contenteditable="true"]') ||
      dialog.querySelector('div[contenteditable="true"][role="textbox"]')
    );
  }

  function plainToGmailHTML(text) {
    return text
      .split("\n")
      .map((l) => (l.length ? `<div>${escapeHtml(l)}</div>` : "<div><br></div>"))
      .join("");
  }

  function diffWords(a, b) {
    const aw = a.split(/(\s+)/);
    const bw = b.split(/(\s+)/);
    const m = aw.length;
    const n = bw.length;
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        if (aw[i] === bw[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0;
    let j = 0;
    while (j < n) {
      if (i < m && aw[i] === bw[j]) {
        ops.push({ op: "eq", text: bw[j] });
        i++;
        j++;
      } else if (i < m && dp[i + 1][j] >= dp[i][j + 1]) {
        i++;
      } else {
        ops.push({ op: "ins", text: bw[j] });
        j++;
      }
    }
    const merged = [];
    for (const o of ops) {
      const last = merged[merged.length - 1];
      if (last && last.op === o.op) last.text += o.text;
      else merged.push({ ...o });
    }
    return merged;
  }

  function renderDiffHTML(original, rewritten) {
    const ops = diffWords(original, rewritten);
    return ops
      .map((o) => {
        const safe = escapeHtml(o.text).replaceAll("\n", "<br>");
        if (o.op === "ins" && o.text.trim().length) {
          return `<mark class="hl-changed">${safe}</mark>`;
        }
        return safe;
      })
      .join("");
  }

  function buildPanel() {
    const wrap = document.createElement("div");
    wrap.className = "humanly-panel";
    wrap.innerHTML = `
      <div class="hp-head">
        <div class="hp-brand">Humanly</div>
        <button class="hp-close" title="Close" aria-label="Close">×</button>
      </div>
      <div class="hp-slider-row">
        <div class="hp-slider" data-idx="1">
          <div class="hp-track"></div>
          <div class="hp-fill"></div>
          <div class="hp-thumb"></div>
        </div>
        <div class="hp-labels">
          <span class="hp-lbl active" data-idx="0">Subtle</span>
          <span class="hp-lbl" data-idx="1">Human</span>
          <span class="hp-lbl" data-idx="2">CEO</span>
        </div>
      </div>
      <button class="hp-go">Humanize</button>
      <div class="hp-status" hidden></div>
      <div class="hp-output" hidden>
        <div class="hp-output-label">Rewritten</div>
        <div class="hp-output-text"></div>
        <div class="hp-actions">
          <button class="hp-cancel">Cancel</button>
          <button class="hp-replace">Replace draft</button>
        </div>
      </div>
    `;
    return wrap;
  }

  function wirePanel(panel, dialog) {
    const slider = panel.querySelector(".hp-slider");
    const thumb = panel.querySelector(".hp-thumb");
    const fill = panel.querySelector(".hp-fill");
    const labels = panel.querySelectorAll(".hp-lbl");
    const goBtn = panel.querySelector(".hp-go");
    const closeBtn = panel.querySelector(".hp-close");
    const status = panel.querySelector(".hp-status");
    const output = panel.querySelector(".hp-output");
    const outText = panel.querySelector(".hp-output-text");
    const replaceBtn = panel.querySelector(".hp-replace");
    const cancelBtn = panel.querySelector(".hp-cancel");

    let currentIdx = 1;
    let lastResult = null;

    const setIdx = (idx) => {
      currentIdx = Math.max(0, Math.min(2, idx));
      slider.dataset.idx = currentIdx;
      thumb.style.left = currentIdx * 50 + "%";
      fill.style.width = currentIdx * 50 + "%";
      labels.forEach((l) =>
        l.classList.toggle("active", Number(l.dataset.idx) === currentIdx)
      );
    };
    setIdx(1);

    labels.forEach((l) =>
      l.addEventListener("click", () => setIdx(Number(l.dataset.idx)))
    );

    const idxFromX = (clientX) => {
      const r = slider.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      return Math.round(pct * 2);
    };
    let dragging = false;
    thumb.addEventListener("mousedown", (e) => {
      dragging = true;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (dragging) setIdx(idxFromX(e.clientX));
    });
    document.addEventListener("mouseup", () => (dragging = false));
    slider.addEventListener("click", (e) => {
      if (e.target === thumb) return;
      setIdx(idxFromX(e.clientX));
    });

    const showStatus = (msg, kind = "info") => {
      status.hidden = false;
      status.textContent = msg;
      status.dataset.kind = kind;
    };
    const hideStatus = () => {
      status.hidden = true;
    };

    closeBtn.addEventListener("click", () => panel.remove());
    cancelBtn.addEventListener("click", () => {
      output.hidden = true;
      lastResult = null;
    });

    replaceBtn.addEventListener("click", () => {
      if (!lastResult) return;
      const body = getComposeBody(dialog);
      if (!body) {
        showStatus("Couldn't find compose body.", "err");
        return;
      }
      body.innerHTML = plainToGmailHTML(lastResult.text);
      body.dispatchEvent(new Event("input", { bubbles: true }));
      panel.remove();
    });

    goBtn.addEventListener("click", async () => {
      const body = getComposeBody(dialog);
      if (!body) {
        showStatus("Couldn't find compose body.", "err");
        return;
      }
      const draft = body.innerText.trim();
      if (!draft) {
        showStatus("Draft is empty.", "err");
        return;
      }
      goBtn.disabled = true;
      output.hidden = true;
      showStatus("Humanizing…", "info");

      try {
        const resp = await chrome.runtime.sendMessage({
          type: "humanize",
          level: LEVELS[currentIdx],
          text: draft,
        });
        if (!resp?.ok) {
          showStatus(resp?.error || "Unknown error.", "err");
          return;
        }
        lastResult = resp;
        outText.innerHTML = renderDiffHTML(draft, resp.text);
        output.hidden = false;
        hideStatus();
      } catch (e) {
        showStatus(e.message || String(e), "err");
      } finally {
        goBtn.disabled = false;
      }
    });
  }

  function decorate(dialog) {
    if (dialog.getAttribute(PROCESSED) === "1") return;
    const body = getComposeBody(dialog);
    if (!body) return;
    dialog.setAttribute(PROCESSED, "1");

    const trigger = document.createElement("button");
    trigger.className = "humanly-trigger";
    trigger.type = "button";
    trigger.title = "Humanize this draft";
    trigger.textContent = "✶ Humanize";

    let panel = null;
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (panel && panel.isConnected) {
        panel.remove();
        panel = null;
        return;
      }
      panel = buildPanel();
      dialog.appendChild(panel);
      wirePanel(panel, dialog);
    });

    dialog.style.position = dialog.style.position || "relative";
    dialog.appendChild(trigger);
  }

  function scan(root = document) {
    const dialogs = root.querySelectorAll('div[role="dialog"]');
    dialogs.forEach((d) => {
      if (getComposeBody(d)) decorate(d);
    });
  }

  const debouncedScan = debounce(scan, 150);
  const observer = new MutationObserver(() => debouncedScan());
  observer.observe(document.body, { childList: true, subtree: true });
  scan();
})();
