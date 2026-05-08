const OpenAI = require("openai");

const SYSTEM_PROMPT = `You are Naturanza Food's friendly and helpful customer assistant.

ABOUT NATURANZA:
- Premium organic food brand based in Lahore, Pakistan
- Specializes in 100% pure, natural, chemical-free organic products
- Sourced directly from certified sustainable farms

PRODUCTS & PRICES:
1. Ispaghol (Organic Powder) - Rs. 8,500 — natural fiber supplement
2. Organic Honey - Rs. 8,000 — raw, unfiltered pure honey

POLICIES:
- Free shipping on orders over Rs. 50
- Fast delivery across Pakistan
- Every product tested for purity

CONTACT:
- Location: Lahore, Pakistan
- WhatsApp: +92 347 4147400
- Email: support@naturanzafoods.com

INSTRUCTIONS:
1. Reply in the SAME language the user writes in (Urdu/Roman Urdu/English)
2. Be warm, friendly, and concise (2-4 sentences usually)
3. If asked about order tracking, ask for their Order ID
4. If you cannot help, redirect to WhatsApp: +92 347 4147400
5. NEVER make up product details not listed above
6. Use emojis sparingly to feel friendly but professional`;

const MAX_TOKENS = 1000;

const normalizeBaseUrl = (value, fallback) => {
  const trimmed = String(value || fallback || "").trim();
  return trimmed.replace(/\/+$/, "");
};

const buildMessages = (conversationHistory) => {
  if (!Array.isArray(conversationHistory)) {
    return [];
  }

  return conversationHistory.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content || ""),
  }));
};

const postJson = async (url, payload, headers = {}) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM request failed (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return response.json();
};

const buildGeminiContents = (messages) =>
  messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: String(message.content || "") }],
  }));

const getOllamaResponse = async (messages) => {
  const baseUrl = normalizeBaseUrl(
    process.env.OLLAMA_BASE_URL,
    "http://localhost:11434",
  );
  const model = String(process.env.OLLAMA_MODEL || "llama3.1:8b").trim();

  const data = await postJson(`${baseUrl}/api/chat`, {
    model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    stream: false,
  });

  const reply = String(data?.message?.content || "").trim();
  if (!reply) {
    throw new Error("Ollama returned an empty response");
  }

  return reply;
};

const getOpenAiResponse = async (messages) => {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey });
  const model = String(process.env.OPENAI_MODEL || "gpt-4.1-nano").trim();

  const data = await client.chat.completions.create({
    model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
  });

  const reply = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!reply) {
    throw new Error("OpenAI returned an empty response");
  }

  return reply;
};

const getGeminiResponse = async (messages) => {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = String(
    process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
  ).trim();
  const baseUrl = normalizeBaseUrl(
    process.env.GEMINI_BASE_URL,
    "https://generativelanguage.googleapis.com/v1beta",
  );

  const data = await postJson(
    `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
    {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: buildGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: MAX_TOKENS,
      },
    },
    {
      "x-goog-api-key": apiKey,
    },
  );

  const reply = String(
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("") || "",
  ).trim();

  if (!reply) {
    const blockReason =
      data?.promptFeedback?.blockReason ||
      data?.candidates?.[0]?.finishReason ||
      "empty response";
    throw new Error(`Gemini returned ${blockReason}`);
  }

  return reply;
};

const getLmStudioResponse = async (messages) => {
  const baseUrl = normalizeBaseUrl(
    process.env.LMSTUDIO_BASE_URL,
    "http://localhost:1234",
  );
  const model = String(
    process.env.LMSTUDIO_MODEL || "llama-3.1-8b-instruct",
  ).trim();

  const data = await postJson(`${baseUrl}/v1/chat/completions`, {
    model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
  });

  const reply = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!reply) {
    throw new Error("LM Studio returned an empty response");
  }

  return reply;
};

const getChatResponse = async (conversationHistory = []) => {
  const provider = String(process.env.CHAT_PROVIDER || "ollama")
    .trim()
    .toLowerCase();
  const messages = buildMessages(conversationHistory);

  if (provider === "ollama") {
    return getOllamaResponse(messages);
  }

  if (provider === "lmstudio" || provider === "lm-studio") {
    return getLmStudioResponse(messages);
  }

  if (provider === "openai") {
    return getOpenAiResponse(messages);
  }

  if (provider === "gemini" || provider === "google") {
    return getGeminiResponse(messages);
  }

  throw new Error(`Unsupported chat provider: ${provider}`);
};

module.exports = { getChatResponse };
