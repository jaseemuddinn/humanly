# Humanly

A Chrome extension that rewrites your Gmail drafts to sound human, with three intensity levels (Subtle / Human / CEO). Functionally a Sinceerly clone, **BYOK only** — bring your own API key, no paid tier, no servers.

## What it does

- Adds a `✶ Humanize` button to any Gmail compose window.
- Opens a panel with a 3-stop slider (Subtle / Human / CEO) and a Humanize button.
- Calls your chosen AI provider with your key to rewrite the draft.
- Shows the rewritten version with **yellow highlights** on every change.
- One click replaces your draft.

## Supported providers

| Provider | Notes | Get a key |
| -------- | ----- | --------- |
| **Anthropic** (Claude) | claude-haiku-4-5 / sonnet-4-6 / opus-4-7 | https://console.anthropic.com/settings/keys |
| **OpenAI** (GPT) | gpt-4o-mini / gpt-4o / gpt-4.1 / gpt-5 | https://platform.openai.com/api-keys |
| **Google Gemini** | gemini-2.5-flash / gemini-2.5-pro / gemini-2.0-flash | https://aistudio.google.com/app/apikey |
| **xAI** (Grok) | grok-4 / grok-3 / grok-3-mini | https://console.x.ai/ |
| **Groq** | llama-3.3-70b-versatile / llama-3.1-8b-instant | https://console.groq.com/keys |
| **DeepSeek** | deepseek-chat / deepseek-reasoner | https://platform.deepseek.com/api_keys |
| **Mistral** | mistral-small-latest / mistral-large-latest | https://console.mistral.ai/api-keys/ |
| **OpenRouter** | any model on OpenRouter (provider/model format) | https://openrouter.ai/keys |

Each provider keeps its own API key — switching back doesn't lose anything. The model field accepts any model ID the provider supports (the dropdown is suggestions, not a closed list).

## The three levels

| Level  | Behavior |
| ------ | -------- |
| Subtle | Removes em-dashes and AI cliches, adds contractions, light edits. Stays professional. |
| Human  | ~50% shorter. Casual. Drops formal openers/closers. One or two short paragraphs. |
| CEO    | Aggressively short. Fragments. Lowercase starts. One small typo per ~50 words. Appends "Sent from my iPhone". |

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked**.
4. Select this folder (`chrome_Ext/`).
5. Click the Humanly toolbar icon to open settings.
6. Pick a provider, paste your API key, pick a model, click **Test key**, then **Save**.
7. Open Gmail, start a draft, click `✶ Humanize`.

## Privacy

- API keys are stored in `chrome.storage.local` — local to this browser, nowhere else.
- Email text is sent only to the provider you picked, over HTTPS, only when you click Humanize.
- No analytics, no telemetry, no remote logging. The extension has zero servers.

## Files

```
manifest.json              MV3 manifest with host permissions for all providers
icons/                     16/48/128 PNG action icons
src/
  providers.js             Provider definitions + call functions (one place to add more)
  background.js            Service worker — routes humanize requests through providers
  content.js               Gmail injection, compose detection, slider panel, word-level diff
  content.css              Panel + trigger button styles
  options.html / .css / .js  Settings page (provider + per-provider key + model picker + test)
```

## Adding a new provider

Edit `src/providers.js`:

1. Add an entry to the `PROVIDERS` object with `label`, `keyPlaceholder`, `keyHelpUrl`, `models`, `defaultModel`, and `call`.
2. For OpenAI-compatible APIs use `makeOpenAILike("https://your-base-url/v1")`.
3. Add the provider's host to `host_permissions` in `manifest.json`.
4. Add the provider id to `PROVIDER_ORDER`.
5. Reload the extension at `chrome://extensions`.

## Notes

- Default provider is Anthropic; default model is `claude-haiku-4-5-20251001` (fast and cheap).
- The Anthropic API requires the `anthropic-dangerous-direct-browser-access: true` header when called directly from a browser; this extension sets it automatically.
- Gmail's DOM changes occasionally; if the Humanize button stops appearing, check the selectors in `getComposeBody()` in `src/content.js`.
