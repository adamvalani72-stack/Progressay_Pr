import express from 'express';

const systemPrompt = [
  'You are Gaming Hub AI, a friendly gaming assistant.',
  'Help users discover games, compare genres, and learn fair-play tips and strategy.',
  'Gaming Hub currently features Pixel Patrol (arcade action), Neon Kart (arcade racing), Orbital Puzzles (space puzzles), Skyline Showdown (tactical city battles), and Redemption Run (western action).',
  'Do not claim to launch games or to know live game data unless the user provides it.',
  'Do not ask users to share passwords, payment details, private account information, or other sensitive data.',
  'Keep advice safe, age-appropriate, and respectful. Be clear when you are uncertain.'
].join(' ');

const providerDefinitions = {
  openai: {
    label: 'OpenAI',
    key: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    endpoint: 'https://api.openai.com/v1/responses'
  },
  gemini: {
    label: 'Google Gemini',
    key: 'GEMINI_API_KEY',
    modelEnv: 'GEMINI_MODEL'
  },
  anthropic: {
    label: 'Anthropic Claude',
    key: 'ANTHROPIC_API_KEY',
    modelEnv: 'ANTHROPIC_MODEL',
    endpoint: 'https://api.anthropic.com/v1/messages'
  },
  ollama: {
    label: 'Ollama (self-hosted)',
    modelEnv: 'OLLAMA_MODEL',
    defaultModel: '',
    baseUrlEnv: 'OLLAMA_BASE_URL',
    defaultBaseUrl: 'http://127.0.0.1:11434'
  }
};

const requestWindowMs = 10 * 60 * 1000;
const requestLimit = 12;
const maximumMessages = 12;
const maximumMessageLength = 1200;
const timeoutMs = 30_000;

function getProviderList() {
  return Object.entries(providerDefinitions).map(([id, definition]) => ({
    id,
    label: definition.label,
    configured: id === 'ollama'
      ? Boolean(process.env[definition.modelEnv]?.trim())
      : Boolean(process.env[definition.key]?.trim() && process.env[definition.modelEnv]?.trim()),
    ...(process.env[definition.modelEnv]?.trim()
      ? { model: process.env[definition.modelEnv].trim() }
      : {})
  }));
}

function parseChatMessages(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > maximumMessages) return null;
  const messages = [];
  for (const item of input) {
    if (!item || !['user', 'assistant'].includes(item.role) ||
        typeof item.content !== 'string' || item.content.trim().length < 1 ||
        item.content.length > maximumMessageLength) {
      return null;
    }
    messages.push({ role: item.role, content: item.content.trim() });
  }
  if (messages.at(-1)?.role !== 'user') return null;
  return messages;
}

function providerErrorMessage(response) {
  if (response.status === 401 || response.status === 403) {
    return 'The selected AI provider rejected its server credentials. Check the provider key in your server environment.';
  }
  if (response.status === 429) {
    return 'The selected AI provider is busy or has reached its usage limit. Try again later.';
  }
  return 'The selected AI provider could not complete your request. Check its server setup and try again.';
}

async function readProviderJson(response, provider) {
  if (!response.ok) {
    throw Object.assign(new Error(providerErrorMessage(response)), { status: response.status });
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${provider} returned an invalid response. Please try again.`);
  }
}

async function requestProvider(providerId, messages, fetchProvider) {
  const provider = providerDefinitions[providerId];
  if (!provider) throw Object.assign(new Error('Select a supported AI provider.'), { status: 400 });

  const signal = AbortSignal.timeout(timeoutMs);
  let response;
  let data;
  if (providerId === 'openai') {
    const key = process.env[provider.key]?.trim();
    if (!key) throw Object.assign(new Error('OpenAI is not configured on this server.'), { status: 503 });
    const model = process.env[provider.modelEnv]?.trim();
    if (!model) throw Object.assign(new Error('Set OPENAI_MODEL to the model ID enabled for your OpenAI account.'), { status: 503 });
    response = await fetchProvider(provider.endpoint, {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: messages,
        max_output_tokens: 700,
        store: false
      })
    });
    data = await readProviderJson(response, provider.label);
    const content = data.output_text || data.output
      ?.filter((item) => item.type === 'message')
      .flatMap((item) => item.content || [])
      .filter((item) => item.type === 'output_text')
      .map((item) => item.text)
      .join('');
    if (typeof content !== 'string' || !content.trim()) throw new Error(`${provider.label} did not return a text response.`);
    return content.trim();
  }

  if (providerId === 'gemini') {
    const key = process.env[provider.key]?.trim();
    if (!key) throw Object.assign(new Error('Google Gemini is not configured on this server.'), { status: 503 });
    const model = process.env[provider.modelEnv]?.trim();
    if (!model) throw Object.assign(new Error('Set GEMINI_MODEL to a Gemini model available to your API key.'), { status: 503 });
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    response = await fetchProvider(endpoint, {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        })),
        generationConfig: { maxOutputTokens: 700, temperature: 0.7 }
      })
    });
    data = await readProviderJson(response, provider.label);
    const content = data.candidates?.[0]?.content?.parts
      ?.map((part) => typeof part.text === 'string' ? part.text : '')
      .join('').trim();
    if (!content) throw new Error(`${provider.label} did not return a text response.`);
    return content;
  }

  if (providerId === 'anthropic') {
    const key = process.env[provider.key]?.trim();
    if (!key) throw Object.assign(new Error('Anthropic Claude is not configured on this server.'), { status: 503 });
    const model = process.env[provider.modelEnv]?.trim();
    if (!model) throw Object.assign(new Error('Set ANTHROPIC_MODEL to the model ID enabled for your Anthropic account.'), { status: 503 });
    response = await fetchProvider(provider.endpoint, {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages,
        max_tokens: 700,
        temperature: 0.7
      })
    });
    data = await readProviderJson(response, provider.label);
    const content = data.content?.filter((part) => part.type === 'text')
      .map((part) => part.text).join('').trim();
    if (!content) throw new Error(`${provider.label} did not return a text response.`);
    return content;
  }

  const model = process.env[provider.modelEnv]?.trim();
  if (!model) throw Object.assign(new Error('Ollama is not configured. Set OLLAMA_MODEL and make Ollama reachable from the Gaming Hub server.'), { status: 503 });
  const baseUrl = (process.env[provider.baseUrlEnv]?.trim() || provider.defaultBaseUrl).replace(/\/+$/, '');
  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw Object.assign(new Error('OLLAMA_BASE_URL must be a valid HTTP or HTTPS URL.'), { status: 503 });
  }
  if (!['http:', 'https:'].includes(parsedBaseUrl.protocol) || parsedBaseUrl.username || parsedBaseUrl.password) {
    throw Object.assign(new Error('OLLAMA_BASE_URL must be an HTTP or HTTPS URL without embedded credentials.'), { status: 503 });
  }
  response = await fetchProvider(`${baseUrl}/api/chat`, {
    method: 'POST',
    redirect: 'error',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      options: { num_predict: 700, temperature: 0.7 }
    })
  });
  data = await readProviderJson(response, provider.label);
  const content = data.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error(`${provider.label} did not return a text response.`);
  return content.trim();
}

export function createAiService(options = {}) {
  const router = express.Router();
  const requests = new Map();
  const fetchProvider = options.fetch || fetch;

  router.get('/providers', (request, response) => {
    response.set('Cache-Control', 'no-store');
    response.json({ providers: getProviderList() });
  });

  router.post('/chat', async (request, response) => {
    const user = request.authUser;
    if (!user) {
      response.status(401).json({ error: 'Sign in to use Gaming Hub AI.' });
      return;
    }
    const provider = request.body?.provider;
    const messages = parseChatMessages(request.body?.messages);
    if (!providerDefinitions[provider] || !messages) {
      response.status(400).json({
        error: `Choose a supported AI provider and send 1-${maximumMessages} chat messages. Each message must be under ${maximumMessageLength} characters.`
      });
      return;
    }

    const now = Date.now();
    const recent = (requests.get(user.id) || []).filter((time) => now - time < requestWindowMs);
    if (recent.length >= requestLimit) {
      response.set('Retry-After', String(Math.ceil(requestWindowMs / 1000)));
      response.status(429).json({ error: 'Gaming Hub AI message limit reached. Try again in 10 minutes.' });
      return;
    }
    recent.push(now);
    requests.set(user.id, recent);
    if (requests.size > 5000) {
      for (const [userId, timestamps] of requests) {
        const active = timestamps.filter((time) => now - time < requestWindowMs);
        if (active.length) requests.set(userId, active);
        else requests.delete(userId);
      }
    }

    response.set('Cache-Control', 'no-store');
    try {
      const answer = await requestProvider(provider, messages, fetchProvider);
      response.json({ answer });
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        response.status(504).json({ error: 'The AI took too long to respond. Please try again.' });
        return;
      }
      if (error.status) {
        response.status(error.status).json({ error: error.message });
        return;
      }
      console.error(`Gaming Hub AI ${provider} request failed:`, error.message);
      response.status(503).json({
        error: 'The AI provider could not be reached. Check its configuration and try again.'
      });
    }
  });

  return { router };
}
