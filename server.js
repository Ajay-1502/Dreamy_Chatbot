import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const LEAD_WEBHOOK_URL = process.env.LEAD_WEBHOOK_URL || '';
const LEAD_WEBHOOK_SECRET = process.env.LEAD_WEBHOOK_SECRET || '';
const LEADS_FILE = path.join(__dirname, 'leads.jsonl');
const TEST_MODE = !process.env.GROQ_API_KEY;

const client = TEST_MODE
  ? null
  : new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });

console.log(
  TEST_MODE
    ? 'TEST MODE: FAQ answers are active; unknown questions use a simulated reply.'
    : 'GROQ MODE: FAQ answers are active; other questions can use Groq.'
);

const basePrompt = fs.readFileSync(
  path.join(__dirname, 'system-prompt.txt'),
  'utf-8'
);
const SYSTEM_PROMPT = `${basePrompt}

### Approved FAQ and accuracy rules
The backend answers recognized English FAQs directly. For questions that reach you, use only the company facts and policies in this prompt. Do not invent prices, vendors, guarantees, package inclusions, timelines or policies. If unsure, use the approved contact handoff: "For accurate information about this, please contact our Webdreams team at WhatsApp 97411 97999 or call 0836-4258918. Our team will be happy to assist you."

### Saving leads
When the visitor has given at least their name, a phone or WhatsApp number, and what they need, call the save_lead tool once with the details you have. After the tool succeeds, send the handoff message. Do not call save_lead again for the same visitor unless they give new details. Never tell the visitor about the tool itself.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'save_lead',
      description:
        "Save a visitor's contact details so the WebDreams team can follow up. Call once the visitor has shared a name, a phone or WhatsApp number, and what they need.",
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: "Visitor's name" },
          phone: { type: 'string', description: 'Phone or WhatsApp number' },
          email: { type: 'string', description: 'Email address, if given' },
          business: { type: 'string', description: 'Business name, if given' },
          need: {
            type: 'string',
            description: 'What the visitor needs, in one or two sentences',
          },
          call_time: {
            type: 'string',
            description: 'Preferred time to be called, if given',
          },
        },
        required: [],
      },
    },
  },
];

const FALLBACK_REPLY =
  "Sorry, I'm having trouble right now. Please WhatsApp us on 97411 97999 or call 0836-4258918 and the WebDreams team will help you.";
const TEST_REPLY =
  'I can help with common WebDreams questions. For anything that needs a detailed response or a callback, please WhatsApp our team on 97411 97999.';

function lastUserMessage(history) {
  return [...history].reverse().find((m) => m.role === 'user')?.content || '';
}

function normalise(text = '') {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[’]/g, "'")
    .replace(/[!?.,]+/g, '')
    .replace(/\s+/g, ' ');
}

function quickReply(text) {
  const q = normalise(text);

  if (
    /^(hi|hello|hey|hii|good morning|good afternoon|good evening|namaste)$/.test(
      q
    )
  ) {
    return "Hi! I'm Dreamy, the WebDreams virtual assistant. Are you looking for a website, online store, SEO or digital marketing?";
  }

  if (/^(thank you|thanks|thank u|thx|many thanks)$/.test(q)) {
    return "You're welcome! Feel free to ask if you have any other questions.";
  }

  if (/^(ok|okay|alright|got it)$/.test(q)) {
    return 'Alright! Let me know if you have any questions about WebDreams or our services.';
  }

  if (
    /\b(my name|what is my name|what's my name|what is your name and my name|what's your name and my name|what is ur name and my name|what's ur name and my name)\b/.test(
      q
    )
  ) {
    return 'My name is Dreamy. I do not know your name yet because you have not shared it with me.';
  }

  if (
    /\b(what is your name|what's your name|what is ur name|what's ur name|who are you|are you human|are you a person)\b/.test(
      q
    )
  ) {
    return "I'm Dreamy, the virtual assistant for WebDreams India. I'm here to help you with information about our services.";
  }

  if (
    /\b(services|service|what do you offer|what services|which services)\b/.test(
      q
    )
  ) {
    return [
      'WebDreams India offers these services:',
      '1. Web design and development — responsive business websites, web applications, logo design and CMS.',
      '2. E-commerce — online stores, payment gateway integration and product management.',
      '3. Digital marketing — SEO, local SEO, Google Ads, social media, content and performance marketing.',
      '4. Domain, hosting and business email — domain registration, hosting, SSL and branded email.',
      '5. Training and consultancy — digital marketing, SEO/SMO and e-commerce training.',
      '6. Other solutions — Student Information System, I-College CMS and English-Japanese translation.',
      '7. Startup support — special support and discounts for eligible startups.',
      'Tell me what you are looking for, and I can guide you to the relevant service.',
    ].join('\n');
  }

  if (
    /\b(tell me about|know about|about your company|about ur company|about the company|about webdreams|your company|who is webdreams|what is webdreams)\b/.test(
      q
    )
  ) {
    return 'WebDreams India is a web design, development and digital marketing company based in Hubli, Karnataka. The company has over 24 years of experience, has served 1,200+ clients, is STPI-registered and certified by WEConnect International. We serve clients across India and in the USA, UK and Iceland. Our services include website design and development, e-commerce, digital marketing, domain and hosting, training and consultancy, and other digital solutions.';
  }

  if (
    /\b(price|pricing|cost|how much|charges|quote|quotation|estimate)\b/.test(q)
  ) {
    return 'Our pricing depends on your project requirements, features and level of customisation. WebDreams prepares a customised quote after understanding your needs. You can request one here: https://www.webdreams.in/get-a-free-quote.html';
  }

  if (
    /\b(how long|timeline|how many days|delivery time|development time)\b/.test(
      q
    )
  ) {
    return 'A standard business website usually takes around 2 to 4 weeks. E-commerce websites and custom platforms may take longer depending on the features and project requirements.';
  }

  if (
    /\b(address|office location|where are you located|where is your office|location)\b/.test(
      q
    )
  ) {
    return 'Our office is at No. 18, Opp. Karnataka Gymkhana Association, Behind Mahaveer School, Bailappanavar Nagar, Hubli, Karnataka 580 029. You can call 0836-4258918 or WhatsApp 97411 97999.';
  }

  if (
    /\b(contact|phone number|call you|whatsapp number|contact details)\b/.test(
      q
    )
  ) {
    return 'You can call WebDreams on 0836-4258918 or WhatsApp 97411 97999. You can also submit an enquiry through https://www.webdreams.in/get-a-free-quote.html.';
  }

  if (/\b(portfolio|our work|projects|clients)\b/.test(q)) {
    return 'Some of our recent work includes KCD Tourism (Karnataka University), Nadgir Foundation, Regent Finance, KLE BBA Hubli, MGVCM Hubli, Vidyadan Samiti and Microfinish Group. You can view our portfolio at https://www.webdreams.in/portfolio.html.';
  }

  return null;
}

function hasLeadIntent(text) {
  return /\b(get a quote|request a quote|need a quote|want a quote|call me|please call|request a callback|callback|contact me|want to proceed|ready to proceed|start a project|start my project|hire you|need a website|want a website|build me a website|create a website|need an online store|want an online store|build an online store)\b/i.test(
    text
  );
}

function isGreeting(message) {
  const text = message.toLowerCase().trim();

  return /^(hi|hello|hey|good morning|good afternoon|good evening|namaste)[!. ]*$/i.test(
    text
  );
}

function isRegionalLanguage(text) {
  // Kannada and Devanagari (Hindi/Marathi) messages go to Groq so Dreamy can reply in the visitor's language.
  return /[\u0900-\u097F\u0C80-\u0CFF]/u.test(text);
}

function isLeadConversation(history) {
  const latest = lastUserMessage(history).toLowerCase();
  const directLeadIntent =
    hasLeadIntent(latest) ||
    /\b(call back|talk to (?:your|the) team|speak to (?:your|the) team|get in touch|interested,? please contact)\b/i.test(
      latest
    );
  if (directLeadIntent) return true;

  // If Dreamy previously asked for contact/callback details, a short reply such as a name, number or "yes" belongs to that lead flow.
  const previousAssistant =
    [...history].reverse().find((m) => m.role === 'assistant')?.content || '';
  const askedForLeadDetails =
    /\b(name|phone|mobile|whatsapp|contact details|callback|call you|reach you|preferred time)\b/i.test(
      previousAssistant
    ) &&
    /\b(share|provide|tell me|may i have|could you|would you like|shall we|can our team)\b/i.test(
      previousAssistant
    );
  return askedForLeadDetails;
}

async function saveLead(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const phone = typeof input?.phone === 'string' ? input.phone.trim() : '';
  const need = typeof input?.need === 'string' ? input.need.trim() : '';
  const placeholderNames = [
    'user',
    'visitor',
    'unknown',
    'not provided',
    'n/a',
    'none',
  ];
  const phoneDigits = phone.replace(/\D/g, '');
  if (
    !name ||
    placeholderNames.includes(name.toLowerCase()) ||
    !phone ||
    phoneDigits.length < 7 ||
    phoneDigits.length > 15 ||
    !need
  ) {
    throw new Error(
      'Lead validation failed: a valid name, phone number, and need are required.'
    );
  }

  const lead = {
    receivedAt: new Date().toISOString(),
    ...input,
    name,
    phone,
    need,
  };
  // Save locally first. A webhook outage must not undo a successfully saved local lead.
  fs.appendFileSync(LEADS_FILE, JSON.stringify(lead) + '\n', 'utf8');
  console.log('New lead saved locally:', lead.name);

  if (LEAD_WEBHOOK_URL) {
    try {
      const res = await fetch(LEAD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...lead,
          webhookSecret: LEAD_WEBHOOK_SECRET,
        }),
      });
      if (!res.ok)
        console.error(
          `Lead webhook returned ${res.status}; local lead remains saved.`
        );
    } catch (err) {
      console.error(
        'Lead webhook failed; local lead remains saved:',
        err?.message || err
      );
    }
  }
}

async function runAiChat(history) {
  if (TEST_MODE) return TEST_REPLY;

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];

  for (let round = 0; round < 4; round++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 600,
    });

    const assistantMessage = response.choices?.[0]?.message;

    if (!assistantMessage) return FALLBACK_REPLY;

    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls || [];

    if (toolCalls.length) {
      for (const call of toolCalls) {
        if (call.function?.name !== 'save_lead') {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: 'Unknown tool.',
          });
          continue;
        }

        let output;

        try {
          const lead = JSON.parse(call.function.arguments || '{}');

          const name = String(lead.name || '').trim();
          const phone = String(lead.phone || '').trim();
          const need = String(lead.need || '').trim();

          const missing = [];

          if (!name) missing.push('visitor name');
          if (!phone) missing.push('phone or WhatsApp number');
          if (!need) missing.push('what the visitor needs');

          if (missing.length > 0) {
            output =
              `Lead NOT saved. The following details are still missing: ${missing.join(', ')}. ` +
              'Ask the visitor politely for the missing details. Do not claim that the lead has been saved.';
          } else {
            await saveLead({
              ...lead,
              name,
              phone,
              need,
            });

            output = 'Lead saved successfully. Confirm this to the visitor.';
          }
        } catch (err) {
          console.error('save_lead failed:', err);

          output =
            'The details could not be saved. Apologise briefly and ask the visitor to WhatsApp 97411 97999.';
        }

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        });
      }

      continue;
    }

    return (assistantMessage.content || '').trim() || FALLBACK_REPLY;
  }

  return FALLBACK_REPLY;
}

async function runChat(history) {
  const latest = lastUserMessage(history);

  // STEP 1: Identify whether this is a lead conversation.
  const leadConversation = isLeadConversation(history);

  // STEP 2: Handle hardcoded responses.
  // Do not interrupt an ongoing lead conversation.
  if (!leadConversation) {
    const reply = quickReply(latest);

    if (reply !== null) {
      console.log('QUICK REPLY: No AI API call required.');
      return reply;
    }
  }

  // STEP 3: Check regional languages.
  // Kannada, Hindi and Marathi messages go to Groq.
  if (isRegionalLanguage(latest)) {
    console.log('GROQ: Regional language message.');
    return runAiChat(history);
  }

  // STEP 4: Use Groq for complex questions and lead conversations.
  console.log('GROQ: AI response required.');
  return runAiChat(history);
}

function cleanHistory(raw) {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }))
    .filter((m) => m.content.trim().length > 0)
    .slice(-20);
  while (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();
  if (!cleaned.length || cleaned[cleaned.length - 1].role !== 'user')
    return null;
  return cleaned;
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '50kb' }));
app.use(
  cors({
    origin(origin, cb) {
      if (
        !origin ||
        ALLOWED_ORIGINS.length === 0 ||
        ALLOWED_ORIGINS.includes(origin)
      )
        return cb(null, true);
      cb(new Error('Origin not allowed'));
    },
  })
);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) =>
  res.json({ ok: true, model: MODEL, mode: TEST_MODE ? 'test' : 'groq' })
);

app.post(
  '/api/chat',
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  async (req, res) => {
    const history = cleanHistory(req.body?.messages);
    if (!history)
      return res
        .status(400)
        .json({ error: 'Send a messages array ending with a user message.' });
    try {
      const reply = await runChat(history);
      res.json({ reply });
    } catch (err) {
      console.error('Chat error:', err?.status || '', err?.message || err);
      res.status(502).json({ reply: FALLBACK_REPLY });
    }
  }
);

// Local-only helper retained for testing lead-file writing without contacting Groq.
if (TEST_MODE) {
  app.post('/api/test-lead', (req, res) => {
    if (!['localhost', '127.0.0.1'].includes(req.hostname))
      return res.status(403).json({ error: 'Local testing only.' });
    const { name, phone, email, business, need, call_time } = req.body || {};
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof phone !== 'string' ||
      !phone.trim() ||
      typeof need !== 'string' ||
      !need.trim()
    ) {
      return res
        .status(400)
        .json({ error: 'Name, phone and need are required.' });
    }
    try {
      fs.appendFileSync(
        LEADS_FILE,
        JSON.stringify({
          receivedAt: new Date().toISOString(),
          name: name.trim(),
          phone: phone.trim(),
          email: typeof email === 'string' ? email.trim() : '',
          business: typeof business === 'string' ? business.trim() : '',
          need: need.trim(),
          call_time: typeof call_time === 'string' ? call_time.trim() : '',
        }) + '\n',
        'utf8'
      );
      res.json({ ok: true, message: 'Simulated test lead saved locally.' });
    } catch (err) {
      console.error('Test lead save failed:', err.message);
      res.status(500).json({ error: 'Could not save test lead.' });
    }
  });
}

app.use((err, _req, res, _next) => {
  if (err?.message === 'Origin not allowed')
    return res.status(403).json({ error: 'Origin not allowed' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(
    `Dreamy is running on http://localhost:${PORT} (model: ${MODEL})`
  );
  if (ALLOWED_ORIGINS.length === 0)
    console.warn(
      'ALLOWED_ORIGINS is empty: any website can call this API. Set it before going live.'
    );
});
