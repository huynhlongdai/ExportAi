(function initExportAIPlatforms(globalScope) {
  const platforms = {
    chatgpt: {
      id: "chatgpt",
      name: "ChatGPT",
      adapterVersion: "2026.05.28.1",
      adapterStatus: "local",
      productName: "ExportAI for ChatGPT",
      hosts: ["chatgpt.com", "chat.openai.com"],
      matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
      selectors: [
        '[data-message-author-role]',
        '[data-testid^="conversation-turn-"]',
        "article"
      ],
      selectorGroups: [
        ['[data-message-author-role]'],
        ['[data-testid^="conversation-turn-"]'],
        ["article"]
      ],
      roleHints: {
        user: /(user|you|bạn|human)/i,
        assistant: /(assistant|chatgpt|model|ai)/i
      }
    },
    grok: {
      id: "grok",
      name: "Grok",
      adapterVersion: "2026.05.28.3",
      adapterStatus: "local",
      productName: "ExportAI for Grok",
      hosts: ["grok.com", "x.com"],
      matches: ["https://grok.com/*", "https://x.com/i/grok*"],
      selectors: [
        '[data-testid="conversation-turn"]',
        '[data-testid="tweetText"]',
        '[data-testid*="message"]',
        '[data-testid*="response"]',
        '[class*="message"]',
        '[class*="prose"]',
        'main [dir="auto"]',
        "article"
      ],
      selectorGroups: [
        ['[data-testid="conversation-turn"]'],
        ['[data-testid="tweetText"]'],
        ['[data-testid*="message"]', '[data-testid*="response"]'],
        ['[class*="prose"]'],
        ['main [dir="auto"]'],
        ["article"]
      ],
      roleHints: {
        user: /(user|you|bạn|human)/i,
        assistant: /(assistant|grok|model|ai)/i
      }
    },
    gemini: {
      id: "gemini",
      name: "Gemini",
      adapterVersion: "2026.05.28.1",
      adapterStatus: "local",
      productName: "ExportAI for Gemini",
      hosts: ["gemini.google.com"],
      matches: ["https://gemini.google.com/*"],
      selectors: [
        "user-query",
        "model-response",
        ".query-text",
        ".response-container"
      ],
      selectorGroups: [
        ["user-query", "model-response"],
        [".query-text", ".response-container"]
      ],
      roleHints: {
        user: /(user|you|bạn|human|query)/i,
        assistant: /(assistant|gemini|model|response|ai)/i
      }
    }
  };

  function detectPlatformFromHost(hostname) {
    const host = hostname.replace(/^www\./, "");
    return (
      Object.values(platforms).find((platform) =>
        platform.hosts.some((knownHost) => host === knownHost || host.endsWith(`.${knownHost}`))
      ) || {
        id: "generic",
        name: "AI Chat",
        adapterVersion: "2026.05.28.1",
        adapterStatus: "fallback",
        productName: "ExportAI",
        hosts: [host],
        matches: [],
        selectors: ["article", '[role="article"]'],
        selectorGroups: [["article"], ['[role="article"]']],
        roleHints: {
          user: /(user|you|bạn|human)/i,
          assistant: /(assistant|model|ai)/i
        }
      }
    );
  }

  globalScope.ExportAIPlatforms = {
    all: platforms,
    detectPlatformFromHost
  };
})(globalThis);
