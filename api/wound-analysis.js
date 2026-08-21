const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const PROMPT_VERSION = 'wound-image-assessment-claude-reference-v1';

const SYSTEM_PROMPT = `You are a wound care specialist (CWOCN-level) performing structured assessment of a wound photograph. You produce DOCUMENTATION SUPPORT, not diagnosis.

THREE GOVERNING RULES:
1. Describe what is visible. Propose what is inferable. Name what is unknowable.
2. A photograph cannot assess depth, undermining, tunneling, induration, temperature, odor, pain or blanchability. Always list these as undeterminable unless separately supplied as bedside context.
3. When ambiguous, state low confidence and give a differential.

SCALE RULE: If no ruler, fiducial marker or known-size object is visibly in frame and coplanar with the wound, do not report centimetres. Set scaleAvailable=false, all cm fields null, and report aspectRatio only.

CAPTURE QUALITY: A = scale in frame, perpendicular, even light, cleansed, margins plus 4cm periwound visible. B = usable with one or two limitations. C = marginal. D = not assessable.

TISSUE: percentages in 10% increments summing to 100% of wound bed only. Describe granulation quality; slough; eschar and stable/unstable state; epithelial tissue; visible exposed structures.

EDGES: attached, unattached, epibole, macerated, hyperkeratotic/callused, fibrotic, punched-out, sloping, everted. PERIWOUND: assess the visible 4cm margin and explicitly note visibility limits.

INFECTION: screen image-assessable NERDS/STONEES features. Never assert infection; say features associated with infection and clinical correlation indicated. Etiology is a proposal by morphology and site, not a diagnosis.

HARD RULES: never reverse-stage; never stage non-pressure wounds; obscuring slough/eschar means Unstageable; never recommend debriding dry stable heel eschar; do not recommend debridement if pyoderma gangrenosum is in the differential; never assert biofilm; never establish Stage 1 or DTPI from colour alone. On Fitzpatrick IV-VI compare inflammation against adjacent skin and do not rely on redness.

ESCALATE visible features compatible with necrotizing infection, exposed bone, pyoderma gangrenosum, calciphylaxis, malignancy, new deep tissue injury, or dry digital gangrene. State uncertainty and action, not diagnosis.

OUTPUT DISCIPLINE: prose fields under 15 words; arrays at most 4 items; return only valid JSON with no markdown.`;

const SURVEY_SCHEMA = `Return the VISUAL SURVEY only using this exact shape:
{"imageQuality":{"grade":"A|B|C|D","scaleReference":false,"limitations":[],"privacyConcerns":[]},"measurement":{"scaleAvailable":false,"lengthCm":null,"widthCm":null,"areaCm2":null,"aspectRatio":"","note":""},"tissue":{"granulation":0,"granulationQuality":"","slough":0,"eschar":0,"escharState":"stable|unstable|n/a","epithelial":0,"exposedStructures":[],"note":""},"edges":{"findings":[],"note":""},"periwound":{"findings":[],"erythemaExtentCm":null,"note":""},"moisture":{"state":"desiccated|moist|wet|saturated","note":""}}`;

const INTERPRET_SCHEMA = `Return the CLINICAL INTERPRETATION only using this exact shape:
{"flags":[{"level":"emergency|urgent|refer","finding":"","action":""}],"infection":{"nerdsPresent":[],"stoneesPresent":[],"assessment":""},"classification":{"etiology":"","etiologyConfidence":"low|moderate|high","differential":[],"stagingApplicable":false,"stage":null,"stageConfidence":null,"rationale":""},"cannotDetermine":["depth","undermining","tunneling","induration"],"push":{"computable":false,"score":null,"missingInputs":[]},"nextCapture":[]}`;

function jsonFromClaude(payload) {
  const text = payload?.content?.filter(block => block.type === 'text').map(block => block.text).join('') || '';
  const cleaned = text.replace(/^```json\\s*/i, '').replace(/```\\s*$/, '').trim();
  return JSON.parse(cleaned);
}

async function verifySupabaseUser(token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase server environment is not configured.');
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!response.ok) return { user: null, status: response.status };
  return { user: await response.json(), status: response.status };
}

async function callClaude(image, context, schema) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1400,
      temperature: 0,
      system: `${SYSTEM_PROMPT}\\n\\n${schema}`,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
        { type: 'text', text: `Clinician-supplied context: body site ${context.bodySite || 'not recorded'}; laterality ${context.laterality || 'not recorded'}; surface ${context.surface || 'not recorded'}; skin tone ${context.skinTone || 'not recorded'}; exudate ${context.exudate || 'not recorded'}; days since baseline ${context.daysSinceBaseline ?? 'not recorded'}. Assess the photograph. Return only JSON.` },
      ] }],
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Anthropic request failed (${response.status}).`);
  return jsonFromClaude(payload);
}

function promptText(context, schema) {
  return `${SYSTEM_PROMPT}\\n\\n${schema}\\n\\nClinician-supplied context: body site ${context.bodySite || 'not recorded'}; laterality ${context.laterality || 'not recorded'}; surface ${context.surface || 'not recorded'}; skin tone ${context.skinTone || 'not recorded'}; exudate ${context.exudate || 'not recorded'}; days since baseline ${context.daysSinceBaseline ?? 'not recorded'}. Assess the photograph. Return only JSON.`;
}

async function callOpenAICompatible({ baseUrl, apiKey, model, image, context, schema }) {
  const response = await fetch(baseUrl, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({
    model,
    input: [{ role: 'user', content: [
      { type: 'input_text', text: promptText(context, schema) },
      { type: 'input_image', image_url: `data:${image.mediaType};base64,${image.base64}` },
    ] }],
    text: { format: { type: 'json_object' } },
  }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Provider request failed (${response.status}).`);
  const text = payload.output_text || payload.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
  return JSON.parse(text);
}

async function callGemini(image, context, schema) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: image.mediaType, data: image.base64 } },
      { text: promptText(context, schema) },
    ] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Gemini request failed (${response.status}).`);
  return JSON.parse(payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '{}');
}

function providerConfig(provider) {
  if (provider === 'anthropic') return { enabled: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL };
  if (provider === 'openai') return { enabled: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || 'gpt-5.6' };
  if (provider === 'gemini') return { enabled: Boolean(process.env.GEMINI_API_KEY), model: process.env.GEMINI_MODEL || 'gemini-3.7-flash' };
  if (provider === 'kimi') return { enabled: Boolean(process.env.MOONSHOT_API_KEY && process.env.MOONSHOT_BASE_URL && process.env.KIMI_MODEL), model: process.env.KIMI_MODEL || 'not configured' };
  return { enabled: false, model: 'unknown' };
}

async function callProvider(provider, image, context, schema) {
  if (provider === 'anthropic') return callClaude(image, context, schema);
  if (provider === 'openai') return callOpenAICompatible({ baseUrl: 'https://api.openai.com/v1/responses', apiKey: process.env.OPENAI_API_KEY, model: providerConfig(provider).model, image, context, schema });
  if (provider === 'gemini') return callGemini(image, context, schema);
  if (provider === 'kimi') return callOpenAICompatible({ baseUrl: process.env.MOONSHOT_BASE_URL, apiKey: process.env.MOONSHOT_API_KEY, model: process.env.KIMI_MODEL, image, context, schema });
  throw new Error('Unsupported provider.');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ providers: Object.fromEntries(['anthropic','openai','gemini','kimi'].map(name => [name, providerConfig(name)])) });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\\s+/i, '');
  const verification = token ? await verifySupabaseUser(token) : { user: null, status: 401 };
  if (!verification.user) return res.status(401).json({ error: verification.status === 401 ? 'Your Supabase session was not accepted by the server. Sign in again; if this continues, verify that Vercel and the website use the same Supabase project.' : 'The server could not validate your Supabase session.' });
  const { image, context = {}, provider = 'anthropic' } = req.body || {};
  const config = providerConfig(provider);
  if (!config.enabled) return res.status(503).json({ error: `${provider} is not configured in Vercel.` });
  if (!image?.base64 || !['image/jpeg','image/png','image/webp','image/gif'].includes(image.mediaType)) return res.status(400).json({ error: 'A supported wound image is required.' });
  if (image.base64.length > 5_500_000) return res.status(413).json({ error: 'Image is too large. Capture or upload a smaller image.' });
  try {
    const settled = await Promise.allSettled([
      callProvider(provider, image, context, SURVEY_SCHEMA),
      callProvider(provider, image, context, INTERPRET_SCHEMA),
    ]);
    if (settled.every(result => result.status === 'rejected')) throw settled[0].reason;
    const survey = settled[0].status === 'fulfilled' ? settled[0].value : null;
    const interpretation = settled[1].status === 'fulfilled' ? settled[1].value : null;
    return res.status(200).json({ survey, interpretation, partial: !survey || !interpretation, provider, model: config.model, promptVersion: PROMPT_VERSION });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Wound analysis failed.' });
  }
}
