import { PROVIDERS, DEFAULT_PROVIDER, callProvider } from "./providers.js";

const SYSTEM_PROMPTS = {
  subtle: `You rewrite emails to sound subtly more human, removing tells of AI authorship while keeping a professional tone.

Rules:
- Replace every em-dash (—) with a comma, period, or " and ".
- Eliminate AI-cliche phrases: "I wanted to reach out", "I hope this email finds you well", "synergies", "moving forward", "at your earliest convenience", "regarding", "express my interest in", "circle back", "touch base", "reach out", "leverage", "not just X but Y".
- Use natural contractions (I'm, we're, don't, you'd, it's).
- Slightly shorten verbose sentences. Cut throat-clearing.
- Keep the original structure and key facts. Do not add new information.
- Stay professional and complete (greeting, body, signoff if present).

Output ONLY the rewritten email body. No preamble, no explanation, no quotes around it.`,

  human: `You rewrite emails to sound clearly human and casual, like a real person who is busy but friendly.

Rules:
- Cut overall length by roughly 40-50%.
- Drop stiff openers ("I hope this finds you well", "I wanted to reach out") and stiff closers ("Please let me know at your earliest convenience").
- Use casual phrasing: contractions, "lmk", "wanted to", sentence fragments where natural.
- Lowercase casual openers are fine.
- Remove every em-dash, AI cliche, and corporate jargon.
- One or two short paragraphs maximum.
- Preserve only the core ask and any concrete details (names, dates, links).

Output ONLY the rewritten email body. No preamble, no explanation, no quotes.`,

  ceo: `You rewrite emails as if a busy executive typed them on a phone between meetings.

Rules:
- Aggressively short. Sentence fragments. Often drop the subject ("think we should connect", "would love to chat").
- Lowercase starts are fine. Skip greetings entirely.
- Maximum 3 short sentences in the body.
- Drop ALL niceties, throat-clearing, and corporate jargon.
- Add roughly ONE small typo per ~50 words of output. A missed letter, a doubled letter, or two transposed letters. Make it look like a real fat-finger typo, not a deliberate mistake. Never typo a name, number, link, or technical term.
- Append exactly this on a new line at the end:

Sent from my iPhone
- Preserve only the core ask. Drop everything else.

Output ONLY the rewritten email body. No preamble, no explanation, no quotes.`,
};

async function loadSettings() {
  const out = await chrome.storage.local.get(["provider", "model", "apiKeys"]);
  const provider = out.provider || DEFAULT_PROVIDER;
  const apiKeys = out.apiKeys || {};
  const apiKey = apiKeys[provider] || "";
  const model = out.model || PROVIDERS[provider]?.defaultModel || "";
  return { provider, apiKey, model };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "humanize") return false;

  (async () => {
    try {
      const { provider, apiKey, model } = await loadSettings();
      if (!PROVIDERS[provider]) {
        sendResponse({ ok: false, error: `Unknown provider: ${provider}` });
        return;
      }
      if (!apiKey) {
        sendResponse({
          ok: false,
          error: `No API key for ${PROVIDERS[provider].label}. Click the Humanly toolbar icon to add one.`,
        });
        return;
      }
      const level = msg.level in SYSTEM_PROMPTS ? msg.level : "human";
      const text = String(msg.text || "").trim();
      if (!text) {
        sendResponse({ ok: false, error: "Empty draft." });
        return;
      }
      const out = await callProvider({
        provider,
        apiKey,
        model,
        system: SYSTEM_PROMPTS[level],
        userText: text,
      });
      sendResponse({ ok: true, text: out, level, provider, model });
    } catch (e) {
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();

  return true;
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
