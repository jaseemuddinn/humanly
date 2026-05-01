import {
  PROVIDERS,
  PROVIDER_ORDER,
  DEFAULT_PROVIDER,
  callProvider,
} from "./providers.js";

const $ = (sel) => document.querySelector(sel);

const providerSel = $("#provider");
const providerLabel = $("#providerLabel");
const providerHost = $("#providerHost");
const keyHelpLink = $("#keyHelpLink");
const apiKeyEl = $("#apiKey");
const modelEl = $("#model");
const modelList = $("#modelList");
const saveBtn = $("#save");
const testBtn = $("#test");
const toggleBtn = $("#toggleVis");
const statusEl = $("#status");

let state = {
  provider: DEFAULT_PROVIDER,
  apiKeys: {},
  modelByProvider: {},
};

function setStatus(text, kind) {
  if (!text) {
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.removeAttribute("data-kind");
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = text;
  if (kind) statusEl.dataset.kind = kind;
  else statusEl.removeAttribute("data-kind");
}

function hostFromCallTarget(provider) {
  const fakeMap = {
    anthropic: "api.anthropic.com",
    openai: "api.openai.com",
    gemini: "generativelanguage.googleapis.com",
    xai: "api.x.ai",
    groq: "api.groq.com",
    deepseek: "api.deepseek.com",
    mistral: "api.mistral.ai",
    openrouter: "openrouter.ai",
  };
  return fakeMap[provider] || "";
}

function renderProviderOptions() {
  providerSel.innerHTML = "";
  for (const id of PROVIDER_ORDER) {
    const def = PROVIDERS[id];
    if (!def) continue;
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = def.label;
    providerSel.appendChild(opt);
  }
}

function renderForProvider(providerId) {
  const def = PROVIDERS[providerId];
  if (!def) return;

  providerLabel.textContent = `(${def.label})`;
  providerHost.textContent = hostFromCallTarget(providerId);
  keyHelpLink.href = def.keyHelpUrl;
  apiKeyEl.placeholder = def.keyPlaceholder;
  apiKeyEl.value = state.apiKeys[providerId] || "";

  modelList.innerHTML = "";
  for (const m of def.models) {
    const o = document.createElement("option");
    o.value = m;
    modelList.appendChild(o);
  }
  modelEl.value =
    state.modelByProvider[providerId] || def.defaultModel || "";
}

async function load() {
  const stored = await chrome.storage.local.get([
    "provider",
    "apiKeys",
    "modelByProvider",
    "model",
    "apiKey",
  ]);

  state.provider = stored.provider || DEFAULT_PROVIDER;
  state.apiKeys = stored.apiKeys || {};
  state.modelByProvider = stored.modelByProvider || {};

  if (stored.apiKey && !state.apiKeys[state.provider]) {
    state.apiKeys[state.provider] = stored.apiKey;
  }
  if (stored.model && !state.modelByProvider[state.provider]) {
    state.modelByProvider[state.provider] = stored.model;
  }

  renderProviderOptions();
  providerSel.value = state.provider;
  renderForProvider(state.provider);
}

async function save() {
  const provider = providerSel.value;
  const apiKey = apiKeyEl.value.trim();
  const model = modelEl.value.trim();

  state.provider = provider;
  state.apiKeys = { ...state.apiKeys, [provider]: apiKey };
  state.modelByProvider = { ...state.modelByProvider, [provider]: model };

  await chrome.storage.local.set({
    provider,
    apiKeys: state.apiKeys,
    modelByProvider: state.modelByProvider,
    model,
    apiKey,
  });
  setStatus("Saved.", "ok");
  setTimeout(() => setStatus(""), 1800);
}

async function testKey() {
  const provider = providerSel.value;
  const apiKey = apiKeyEl.value.trim();
  const model = modelEl.value.trim();
  if (!apiKey) {
    setStatus("Add a key first.", "err");
    return;
  }
  if (!model) {
    setStatus("Pick or type a model ID.", "err");
    return;
  }
  setStatus("Testing…");
  testBtn.disabled = true;
  try {
    const out = await callProvider({
      provider,
      apiKey,
      model,
      system: "Reply with one word.",
      userText: "ping",
      maxTokens: 16,
    });
    setStatus(out ? `OK ✓  ${out.slice(0, 40)}` : "OK ✓", "ok");
  } catch (e) {
    setStatus(e.message || String(e), "err");
  } finally {
    testBtn.disabled = false;
  }
}

providerSel.addEventListener("change", () => {
  state.apiKeys[state.provider] = apiKeyEl.value.trim();
  state.modelByProvider[state.provider] = modelEl.value.trim();
  state.provider = providerSel.value;
  renderForProvider(state.provider);
});

toggleBtn.addEventListener("click", () => {
  const showing = apiKeyEl.type === "text";
  apiKeyEl.type = showing ? "password" : "text";
  toggleBtn.textContent = showing ? "show" : "hide";
});
saveBtn.addEventListener("click", save);
testBtn.addEventListener("click", testKey);

load();
