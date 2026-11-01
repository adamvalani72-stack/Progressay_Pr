import express from 'express';

const systemPrompt = [
  'You are Gaming Hub AI, a knowledgeable and practical gaming assistant.',
  'Help with game recommendations, advanced strategies, builds, walkthroughs, mechanics, esports, gaming hardware, accessibility, troubleshooting, and game-related questions across platforms and genres.',
  'Answer promptly and stay focused. Give practical steps and a useful reason; expand with examples and tradeoffs when the user asks for detail.',
  'Ask a concise clarifying question only when essential details are missing; otherwise state reasonable assumptions and answer.',
  'Gaming Hub currently features Pixel Patrol (arcade action), Neon Kart (arcade racing), Orbital Puzzles (space puzzles), Skyline Showdown (tactical city battles), and Redemption Run (western action).',
  'Be transparent about uncertainty, game-version differences, and information that may have changed. Do not claim to launch games or know live data unless the user provides it.',
  'Do not ask users to share passwords, payment details, private account information, or other sensitive data.',
  'Keep advice safe, age-appropriate, respectful, and within fair play; do not help with cheating, account theft, or bypassing game security.'
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
  local: {
    label: 'Gaming Hub Guide (offline)',
    local: true
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
const requestLimit = 30;
const maximumMessages = 12;
const maximumMessageLength = 4000;
const maximumResponseTokens = 600;
const timeoutMs = 60_000;

function getProviderList() {
  return Object.entries(providerDefinitions).map(([id, definition]) => ({
    id,
    label: definition.label,
    configured: definition.local || (id === 'ollama'
      ? Boolean(process.env[definition.modelEnv]?.trim())
      : Boolean(process.env[definition.key]?.trim() && process.env[definition.modelEnv]?.trim())),
    ...(process.env[definition.modelEnv]?.trim()
      ? { model: process.env[definition.modelEnv].trim() }
      : {})
  }));
}

function getLocalGuideReply(messages) {
  const message = messages.at(-1).content.toLowerCase();
  if (/\b(hi|hello|hey)\b/.test(message)) {
    return 'Hi! I’m the offline Gaming Hub Guide. I can suggest a featured game or share general beginner tips. What do you enjoy playing?';
  }
  if (/\b(rac(e|ing)|kart|drive|cars?)\b/.test(message)) {
    return 'Try Neon Kart. For faster, cleaner laps: learn braking points, enter tight turns wide, aim for a late apex, then accelerate as you straighten out. Practice a clean line before testing shortcuts. I don’t have the game’s exact track data, so this is general racing advice.';
  }
  if (/\b(puzzl(e|es)|brain|logic|orbital)\b/.test(message)) {
    return 'Try Orbital Puzzles. Check the objective and move limits, scan for moves that open blocked areas or set up combos, and save scarce power-ups for a real bottleneck. Share the board or rules for a tailored walkthrough.';
  }
  if (/\b(strateg(y|ic)|tactic|battle|skyline)\b/.test(message)) {
    return 'For Skyline Showdown, check the objective and turn limit, deal with the biggest threat, and choose a move that keeps a useful follow-up. Avoid committing every resource to one attack if it leaves an objective exposed. Share the map and available actions for specific tactics.';
  }
  if (/\b(western|frontier|redemption)\b/.test(message)) {
    return 'Redemption Run is the featured western action game. Learn movement, aiming, and defense separately; use cover, save consumables for difficult encounters, and review what caused a failed attempt. Tell me the mission for focused advice.';
  }
  if (/\b(action|arcade|quick|pixel|patrol)\b/.test(message)) {
    return 'Pixel Patrol suits a quick arcade-action session. Prioritize survival over risky bonuses, keep room to react, and learn enemy patterns. After a failed run, identify one mistake—positioning, timing, or target choice—and focus on it next time.';
  }
  if (/\b(build|loadout|weapon|gear|skill tree|character)\b/.test(message)) {
    return 'For a strong build or loadout, start from the job you want it to do rather than chasing the highest-rated items. Pick one primary strength, cover its main weakness with a complementary option, and check whether your choices compete for the same resource or playstyle. Test the setup in a low-stakes encounter, change one component at a time, and compare consistency as well as peak damage. Builds depend heavily on the game, mode, patch, and available items; share those details and your preferred playstyle for a tailored recommendation.';
  }
  if (/\b(hardware|fps|lag|stutter\w*|crash\w*|performance|controller|headset|graphics)\b/.test(message)) {
    return 'For gaming performance issues, change one thing at a time so you can identify the cause. Check whether the issue is network latency or local frame-rate stutter; close unnecessary background tasks; verify the game’s files and updates; and lower one demanding graphics setting to test its effect. For controller or headset problems, confirm the device is selected in the game and operating-system settings, then reconnect it. Tell me your platform, game, hardware, and what you observe for specific troubleshooting. Don’t share account passwords or private data.';
  }
  if (/\b(esports|ranked|competitive|rank|team|practice|aim)\b/.test(message)) {
    return 'For competitive improvement, use a short review loop: choose one measurable skill, warm up with a focused drill, play a small set of matches, then review one decision you could change. Track process metrics such as positioning, objective timing, or communication—not only wins. Practice the weakest repeatable skill, take breaks when focus drops, and adapt to the current game version rather than relying on outdated tier lists. Share the game, role, and rank range for more specific coaching.';
  }
  if (/\b(recommend|suggest|which game|pick|choose|like|enjoy|genre)\b/.test(message)) {
    return 'Here are the featured games by style: Pixel Patrol for arcade action, Neon Kart for racing, Orbital Puzzles for puzzles, Skyline Showdown for tactical strategy, and Redemption Run for western action. Tell me which genres you enjoy and I’ll narrow it down.';
  }
  if (/\b(tip|tips|beginner|strategy|advice|how do i|help)\b/.test(message)) {
    return 'A useful improvement loop for most games is: set one specific goal for the session; observe the rules, enemy patterns, or map before committing resources; try one deliberate change; and review what happened afterward. Separate execution mistakes from planning mistakes so you know what to practice next. I can tailor this to Pixel Patrol, Neon Kart, Orbital Puzzles, Skyline Showdown, or Redemption Run if you name the game and describe the challenge.';
  }
  return 'I’m the offline Gaming Hub Guide, so I can help with the featured games and general beginner tips, but I don’t have a live AI model connected. Ask me to recommend a game, compare genres, or give tips for one of the featured games.';
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
  if (provider.local) return getLocalGuideReply(messages);

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
        max_output_tokens: maximumResponseTokens,
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
        generationConfig: { maxOutputTokens: maximumResponseTokens, temperature: 0.7 }
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
        max_tokens: maximumResponseTokens,
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
      options: { num_predict: maximumResponseTokens, temperature: 0.7 }
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
    const provider = request.body?.provider;
    const messages = parseChatMessages(request.body?.messages);
    if (!providerDefinitions[provider] || !messages) {
      response.status(400).json({
        error: `Choose a supported AI provider and send 1-${maximumMessages} chat messages. Each message must be under ${maximumMessageLength} characters.`
      });
      return;
    }

    const now = Date.now();
    const clientKey = request.ip || request.socket.remoteAddress || 'unknown';
    const recent = (requests.get(clientKey) || []).filter((time) => now - time < requestWindowMs);
    if (recent.length >= requestLimit) {
      response.set('Retry-After', String(Math.ceil(requestWindowMs / 1000)));
      response.status(429).json({ error: 'Gaming Hub AI message limit reached. Try again in 10 minutes.' });
      return;
    }
    recent.push(now);
    requests.set(clientKey, recent);
    if (requests.size > 5000) {
      for (const [key, timestamps] of requests) {
        const active = timestamps.filter((time) => now - time < requestWindowMs);
        if (active.length) requests.set(key, active);
        else requests.delete(key);
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
