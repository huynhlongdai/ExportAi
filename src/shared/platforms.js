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
    },
    perplexity: {
      id: "perplexity",
      name: "Perplexity",
      adapterVersion: "2026.05.30.1",
      adapterStatus: "local",
      productName: "ExportAI for Perplexity",
      hosts: ["perplexity.ai", "www.perplexity.ai"],
      matches: ["https://www.perplexity.ai/*", "https://perplexity.ai/*"],
      selectors: [
        '[data-testid*="thread"]',
        '[data-testid*="query"]',
        '[data-testid*="answer"]',
        '[class*="query"]',
        '[class*="answer"]',
        '[class*="prose"]',
        "article"
      ],
      selectorGroups: [
        ['[data-testid*="query"]', '[data-testid*="answer"]'],
        ['[class*="query"]', '[class*="answer"]'],
        ['[data-testid*="thread"]'],
        ['[class*="prose"]'],
        ["article"]
      ],
      roleHints: {
        user: /(user|you|bạn|human|query|question|prompt)/i,
        assistant: /(assistant|perplexity|answer|response|ai|model)/i
      }
    },
    claude: {
      id: "claude",
      name: "Claude",
      adapterVersion: "2026.05.30.1",
      adapterStatus: "local",
      productName: "ExportAI for Claude",
      hosts: ["claude.ai"],
      matches: ["https://claude.ai/*"],
      selectors: [
        '[data-testid*="user"]',
        '[data-testid*="assistant"]',
        '[data-testid*="message"]',
        '[class*="user"]',
        '[class*="assistant"]',
        '[class*="message"]',
        '[class*="prose"]',
        "article"
      ],
      selectorGroups: [
        ['[data-testid*="user"]', '[data-testid*="assistant"]'],
        ['[class*="user"]', '[class*="assistant"]'],
        ['[data-testid*="message"]'],
        ['[class*="message"]'],
        ['[class*="prose"]'],
        ["article"]
      ],
      roleHints: {
        user: /(user|you|bạn|human|prompt|query)/i,
        assistant: /(assistant|claude|model|response|answer|ai)/i
      }
    },
    copilot: {
      id: "copilot",
      name: "Copilot",
      adapterVersion: "2026.05.30.1",
      adapterStatus: "local",
      productName: "ExportAI for Copilot",
      hosts: ["copilot.microsoft.com", "www.bing.com"],
      matches: ["https://copilot.microsoft.com/*", "https://www.bing.com/chat*"],
      selectors: [
        '[data-testid*="message"]',
        '[data-testid*="user"]',
        '[data-testid*="assistant"]',
        '[class*="message"]',
        '[class*="user"]',
        '[class*="assistant"]',
        '[class*="response"]',
        "article"
      ],
      selectorGroups: [
        ['[data-testid*="user"]', '[data-testid*="assistant"]'],
        ['[data-testid*="message"]'],
        ['[class*="user"]', '[class*="assistant"]'],
        ['[class*="message"]'],
        ["article"]
      ],
      roleHints: {
        user: /(user|you|bạn|human|prompt|query)/i,
        assistant: /(assistant|copilot|bing|response|answer|model|ai)/i
      }
    },
    devin: {
      id: "devin",
      name: "Devin",
      adapterVersion: "2026.05.30.1",
      adapterStatus: "local",
      productName: "ExportAI for Devin",
      hosts: ["devin.ai", "app.devin.ai"],
      matches: ["https://devin.ai/*", "https://app.devin.ai/*"],
      selectors: [
        '[data-testid*="message"]',
        '[data-testid*="user"]',
        '[data-testid*="devin"]',
        '[class*="message"]',
        '[class*="user"]',
        '[class*="assistant"]',
        '[class*="prose"]',
        "article"
      ],
      selectorGroups: [
        ['[data-testid*="user"]', '[data-testid*="devin"]'],
        ['[data-testid*="message"]'],
        ['[class*="user"]', '[class*="assistant"]'],
        ['[class*="message"]'],
        ['[class*="prose"]'],
        ["article"]
      ],
      roleHints: {
        user: /(user|you|bạn|human|prompt|query)/i,
        assistant: /(assistant|devin|agent|response|answer|model|ai)/i
      }
    },
    lovable: {
      id: "lovable",
      name: "Lovable",
      adapterVersion: "2026.05.30.1",
      adapterStatus: "local",
      productName: "ExportAI for Lovable",
      hosts: ["lovable.dev", "www.lovable.dev"],
      matches: ["https://lovable.dev/*", "https://www.lovable.dev/*"],
      selectors: [
        '[data-testid*="message"]',
        '[data-testid*="user"]',
        '[data-testid*="assistant"]',
        '[class*="message"]',
        '[class*="user"]',
        '[class*="assistant"]',
        '[class*="prose"]',
        "article"
      ],
      selectorGroups: [
        ['[data-testid*="user"]', '[data-testid*="assistant"]'],
        ['[data-testid*="message"]'],
        ['[class*="user"]', '[class*="assistant"]'],
        ['[class*="message"]'],
        ['[class*="prose"]'],
        ["article"]
      ],
      roleHints: {
        user: /(user|you|bạn|human|prompt|query)/i,
        assistant: /(assistant|lovable|agent|response|answer|model|ai)/i
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
