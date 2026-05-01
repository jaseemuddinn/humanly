async function toApiError(res) {
  let detail = "";
  try {
    const t = await res.text();
    try {
      detail = JSON.parse(t)?.error?.message || JSON.parse(t)?.message || t;
    } catch {
      detail = t;
    }
  } catch {}
  return new Error(`API ${res.status}: ${detail || res.statusText}`);
}

async function anthropicCall({ apiKey, model, system, userText, maxTokens = 1024 }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userText }],
    }),
  });
  if (!res.ok) throw await toApiError(res);
  const data = await res.json();
  return (data?.content?.find((b) => b.type === "text")?.text || "").trim();
}

function makeOpenAILike(baseUrl, extraHeaders = {}) {
  return async function ({ apiKey, model, system, userText, maxTokens = 1024 }) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userText },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw await toApiError(res);
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content || "").trim();
  };
}

async function geminiCall({ apiKey, model, system, userText, maxTokens = 1024 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    }),
  });
  if (!res.ok) throw await toApiError(res);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

export const PROVIDERS = {
  anthropic: {
    label: "Anthropic (Claude)",
    keyPlaceholder: "sk-ant-...",
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
    models: [
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-6",
      "claude-opus-4-7",
    ],
    defaultModel: "claude-haiku-4-5-20251001",
    call: anthropicCall,
  },
  openai: {
    label: "OpenAI (GPT)",
    keyPlaceholder: "sk-...",
    keyHelpUrl: "https://platform.openai.com/api-keys",
    models: [
      "gpt-4o-mini",
      "gpt-4o",
      "gpt-4.1-mini",
      "gpt-4.1",
      "gpt-5-mini",
      "gpt-5",
    ],
    defaultModel: "gpt-4o-mini",
    call: makeOpenAILike("https://api.openai.com/v1"),
  },
  gemini: {
    label: "Google Gemini",
    keyPlaceholder: "AIza...",
    keyHelpUrl: "https://aistudio.google.com/app/apikey",
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ],
    defaultModel: "gemini-2.5-flash",
    call: geminiCall,
  },
  xai: {
    label: "xAI (Grok)",
    keyPlaceholder: "xai-...",
    keyHelpUrl: "https://console.x.ai/",
    models: ["grok-4", "grok-3", "grok-3-mini", "grok-2-latest"],
    defaultModel: "grok-3-mini",
    call: makeOpenAILike("https://api.x.ai/v1"),
  },
  groq: {
    label: "Groq (fast Llama)",
    keyPlaceholder: "gsk_...",
    keyHelpUrl: "https://console.groq.com/keys",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "gemma2-9b-it",
    ],
    defaultModel: "llama-3.3-70b-versatile",
    call: makeOpenAILike("https://api.groq.com/openai/v1"),
  },
  deepseek: {
    label: "DeepSeek",
    keyPlaceholder: "sk-...",
    keyHelpUrl: "https://platform.deepseek.com/api_keys",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    call: makeOpenAILike("https://api.deepseek.com/v1"),
  },
  mistral: {
    label: "Mistral",
    keyPlaceholder: "...",
    keyHelpUrl: "https://console.mistral.ai/api-keys/",
    models: [
      "mistral-small-latest",
      "mistral-large-latest",
      "ministral-8b-latest",
      "ministral-3b-latest",
    ],
    defaultModel: "mistral-small-latest",
    call: makeOpenAILike("https://api.mistral.ai/v1"),
  },
  openrouter: {
    label: "OpenRouter (any model)",
    keyPlaceholder: "sk-or-...",
    keyHelpUrl: "https://openrouter.ai/keys",
    models: [
      "anthropic/claude-haiku-4.5",
      "openai/gpt-4o-mini",
      "google/gemini-2.5-flash",
      "x-ai/grok-3-mini",
      "meta-llama/llama-3.3-70b-instruct",
    ],
    defaultModel: "openai/gpt-4o-mini",
    call: makeOpenAILike("https://openrouter.ai/api/v1", {
      "HTTP-Referer": "https://humanly.local",
      "X-Title": "Humanly",
    }),
  },
};

export const PROVIDER_ORDER = [
  "anthropic",
  "openai",
  "gemini",
  "xai",
  "groq",
  "deepseek",
  "mistral",
  "openrouter",
];

export const DEFAULT_PROVIDER = "anthropic";

export async function callProvider({ provider, apiKey, model, system, userText, maxTokens }) {
  const def = PROVIDERS[provider];
  if (!def) throw new Error(`Unknown provider: ${provider}`);
  return def.call({ apiKey, model, system, userText, maxTokens });
}
