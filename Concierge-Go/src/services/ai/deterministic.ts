import {
  CATEGORY_NAMES,
  type InterpretTaskInput,
  type TaskComplexity,
  type TaskInterpretation,
  type TaskInterpreter,
} from './types'

/**
 * Deterministic interpreter — the default, and the fallback whenever a model
 * call fails.
 *
 * It is a keyword-and-signal scorer, not a language model, and it is honest
 * about that: confidence reflects how much evidence it actually found. It runs
 * offline, costs nothing, and gives operations a useful starting point.
 */

interface CategorySignals {
  slug: string
  /** Weighted keywords. Multi-word phrases score higher — they are specific. */
  keywords: Array<[string, number]>
  actions: string[]
  baseComplexity: TaskComplexity
}

const CATEGORY_SIGNALS: CategorySignals[] = [
  {
    slug: 'documents-administration',
    keywords: [
      ['certificate', 4], ['transcript', 4], ['affidavit', 4], ['waec', 4], ['neco', 4],
      ['jamb', 4], ['nysc', 4], ['birth certificate', 5], ['result', 3], ['admission', 3],
      ['document', 3], ['documents', 3], ['file', 2], ['form', 2], ['application', 3],
      ['submit', 2], ['submission', 3], ['register', 2], ['registration', 2],
      ['ministry', 3], ['secretariat', 3], ['court', 3], ['immigration', 3], ['passport', 3],
      ['school', 2], ['university', 2], ['polytechnic', 2], ['registrar', 3], ['bursary', 3],
      ['collect', 2], ['pick up my', 2], ['follow up', 2], ['sign', 1], ['stamp', 2],
      ['licence', 3], ['license', 3], ['permit', 3], ['cac', 4],
    ],
    actions: ['Collection', 'Submission', 'Transportation'],
    baseComplexity: 'medium',
  },
  {
    slug: 'shopping-sourcing',
    keywords: [
      ['buy', 4], ['purchase', 4], ['shop', 3], ['shopping', 4], ['market', 3],
      ['watt market', 5], ['marian market', 5], ['supermarket', 3], ['store', 2],
      ['price', 3], ['prices', 3], ['compare', 3], ['cheapest', 3], ['vendor', 3],
      ['seller', 2], ['order', 2], ['item', 2], ['spare part', 4], ['fabric', 3],
      ['groceries', 4], ['food stuff', 4], ['foodstuff', 4], ['phone', 2], ['laptop', 2],
      ['negotiate', 3], ['source', 3], ['get me', 3], ['pay for', 2],
    ],
    actions: ['Sourcing', 'Verification', 'Purchase on your behalf', 'Delivery'],
    baseComplexity: 'medium',
  },
  {
    slug: 'personal-errands',
    keywords: [
      ['errand', 4], ['queue', 3], ['on my behalf', 3], ['drop off', 3], ['drop-off', 3],
      ['deliver to my', 3], ['pay a bill', 4], ['bill', 2], ['nepa', 3], ['electricity', 3],
      ['water bill', 4], ['bank', 2], ['relative', 2], ['family', 2], ['mother', 2],
      ['father', 2], ['sister', 2], ['brother', 2], ['repair', 3], ['tailor', 3],
      ['laundry', 3], ['collect from', 2], ['personal', 3], ['hospital', 2], ['pharmacy', 3],
      ['medication', 3], ['drugs', 2],
    ],
    actions: ['Errand', 'Transportation', 'Confirmation'],
    baseComplexity: 'low',
  },
  {
    slug: 'business-tasks',
    keywords: [
      ['business', 4], ['company', 3], ['client', 3], ['supplier', 4], ['office', 2],
      ['invoice', 4], ['contract', 3], ['delivery to client', 4], ['stock', 3],
      ['inventory', 4], ['branch', 2], ['staff', 2], ['bank run', 4], ['cheque', 4],
      ['cheque deposit', 5], ['deposit', 2], ['customer payment', 4], ['receipt from', 3],
      ['tin', 3], ['tax', 3], ['firs', 4], ['corporate', 3],
    ],
    actions: ['Business errand', 'Delivery', 'Verification', 'Reporting'],
    baseComplexity: 'medium',
  },
  {
    slug: 'property-verification',
    keywords: [
      ['property', 5], ['apartment', 5], ['flat', 4], ['house', 4], ['land', 4],
      ['inspect', 5], ['inspection', 5], ['verify the property', 6], ['viewing', 4],
      ['landlord', 4], ['agent fee', 3], ['rent', 4], ['rental', 4], ['self contain', 5],
      ['self-contain', 5], ['duplex', 4], ['bungalow', 4], ['shop space', 4],
      ['before i pay', 4], ['scam', 3], ['exists', 3], ['condition of', 3], ['plot', 3],
      ['survey', 3], ['caretaker', 4],
    ],
    actions: ['Site visit', 'Photography', 'Condition report'],
    baseComplexity: 'high',
  },
  {
    slug: 'events',
    keywords: [
      ['event', 5], ['wedding', 5], ['birthday', 4], ['party', 4], ['ceremony', 4],
      ['venue', 5], ['hall', 3], ['catering', 4], ['caterer', 4], ['decorator', 4],
      ['cake', 4], ['invitation', 4], ['invite', 2], ['guest', 3], ['programme', 3],
      ['burial', 4], ['reception', 3], ['dj', 3], ['photographer', 3], ['booking', 3],
    ],
    actions: ['Vendor confirmation', 'Collection', 'Delivery', 'On-site check'],
    baseComplexity: 'medium',
  },
]

/** Signals that the task involves handling the customer's money. */
const MONEY_SIGNALS = [
  'pay', 'payment', 'buy', 'purchase', 'cash', 'transfer', 'deposit', 'naira', '₦',
  'money', 'fee', 'bill', 'settle',
]

/** Signals that raise complexity regardless of category. */
const COMPLEXITY_SIGNALS = [
  'multiple', 'several', 'different', 'compare', 'negotiate', 'follow up', 'follow-up',
  'if not', 'otherwise', 'then go', 'after that', 'also', 'and then', 'first', 'second',
  'urgent', 'court', 'ministry', 'government', 'lawyer', 'legal',
]

const URGENCY_SIGNALS: Array<[string, 'priority' | 'urgent']> = [
  ['today', 'urgent'],
  ['right now', 'urgent'],
  ['immediately', 'urgent'],
  ['asap', 'urgent'],
  ['as soon as possible', 'urgent'],
  ['emergency', 'urgent'],
  ['this morning', 'urgent'],
  ['before 12', 'urgent'],
  ['deadline', 'urgent'],
  ['tomorrow', 'priority'],
  ['this week', 'priority'],
  ['quickly', 'priority'],
  ['soon', 'priority'],
  ['before friday', 'priority'],
]

/** Verbs that map to a concrete real-world action. */
const ACTION_VERBS: Array<[RegExp, string]> = [
  [/\b(collect|pick ?up|get|retrieve|obtain)\b/i, 'Collection'],
  [/\b(deliver|bring|drop ?off|take it to|send to)\b/i, 'Transportation'],
  [/\b(submit|hand in|deposit|lodge|file)\b/i, 'Submission'],
  [/\b(buy|purchase|pay for|shop)\b/i, 'Purchase on your behalf'],
  [/\b(inspect|check|verify|confirm|look at|view)\b/i, 'Verification'],
  [/\b(photograph|take pictures?|take photos?|record|video)\b/i, 'Photography'],
  [/\b(queue|wait|line up|stand in)\b/i, 'Queuing'],
  [/\b(negotiate|bargain|price|compare)\b/i, 'Price comparison'],
  [/\b(follow ?up|chase|remind)\b/i, 'Follow-up'],
  [/\b(meet|speak (to|with)|talk to)\b/i, 'In-person meeting'],
]

function countOccurrences(haystack: string, needle: string) {
  if (!needle) return 0
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

function scoreCategories(text: string) {
  return CATEGORY_SIGNALS.map((signals) => {
    let score = 0
    const matched: string[] = []

    for (const [keyword, weight] of signals.keywords) {
      const hits = countOccurrences(text, keyword)
      if (hits > 0) {
        // Diminishing returns: repeating a word is weak evidence.
        score += weight * (1 + Math.min(hits - 1, 2) * 0.3)
        matched.push(keyword)
      }
    }

    return { slug: signals.slug, score, matched, signals }
  }).sort((a, b) => b.score - a.score)
}

function deriveActions(text: string, fallback: string[]) {
  const actions = new Set<string>()
  for (const [pattern, action] of ACTION_VERBS) {
    if (pattern.test(text)) actions.add(action)
  }
  if (actions.size === 0) fallback.forEach((action) => actions.add(action))
  return Array.from(actions).slice(0, 5)
}

function deriveComplexity(text: string, base: TaskComplexity): TaskComplexity {
  const hits = COMPLEXITY_SIGNALS.filter((signal) => text.includes(signal)).length
  const sentences = text.split(/[.!?]+/).filter((part) => part.trim().length > 12).length
  const longRequest = text.length > 400

  let level = base === 'high' ? 2 : base === 'medium' ? 1 : 0
  if (hits >= 3 || sentences >= 5 || longRequest) level += 1
  if (hits >= 6) level += 1
  if (text.length < 90 && hits === 0 && sentences <= 1) level -= 1

  const clamped = Math.max(0, Math.min(2, level))
  return clamped === 0 ? 'low' : clamped === 1 ? 'medium' : 'high'
}

function deriveUrgency(text: string) {
  let urgency: 'standard' | 'priority' | 'urgent' = 'standard'
  for (const [signal, level] of URGENCY_SIGNALS) {
    if (text.includes(signal)) {
      if (level === 'urgent') return 'urgent' as const
      urgency = 'priority'
    }
  }
  return urgency
}

/** A short noun-phrase restatement, e.g. "Certificate collection". */
function summarise(text: string, actions: string[], categorySlug: string) {
  const subjects: Array<[RegExp, string]> = [
    [/\bcertificate\b/i, 'Certificate'],
    [/\btranscript\b/i, 'Transcript'],
    [/\bresults?\b/i, 'Results'],
    [/\bpassport\b/i, 'Passport'],
    [/\bdocuments?\b/i, 'Document'],
    [/\bform\b/i, 'Form'],
    [/\bapplication\b/i, 'Application'],
    [/\bapartment|flat|self.?contain\b/i, 'Apartment'],
    [/\bproperty|land|plot\b/i, 'Property'],
    [/\bhouse|bungalow|duplex\b/i, 'Property'],
    [/\bparcel|package|item\b/i, 'Item'],
    [/\bcake\b/i, 'Cake'],
    [/\bvenue\b/i, 'Venue'],
    [/\binvoice\b/i, 'Invoice'],
    [/\bcheque\b/i, 'Cheque'],
    [/\bbill\b/i, 'Bill'],
    [/\bgroceries|food ?stuff\b/i, 'Groceries'],
    [/\bspare part\b/i, 'Spare part'],
  ]

  const subject = subjects.find(([pattern]) => pattern.test(text))?.[1]
  const primaryAction = actions[0] ?? 'Errand'

  if (subject) {
    const actionWord = primaryAction.toLowerCase().replace(' on your behalf', '')
    return `${subject} ${actionWord}`
  }

  return `${CATEGORY_NAMES[categorySlug] ?? 'General'} request`
}

export const deterministicInterpreter: TaskInterpreter = {
  name: 'deterministic',

  async interpret(input: InterpretTaskInput): Promise<TaskInterpretation> {
    const raw = `${input.title ?? ''} ${input.description}`.trim()
    const text = raw.toLowerCase()

    const ranked = scoreCategories(text)
    const best = ranked[0]
    const runnerUp = ranked[1]

    // The customer's own choice wins unless they left it on "other" and the
    // text points somewhere specific.
    const customerChoice = input.categorySlug && input.categorySlug !== 'other'
      ? input.categorySlug
      : null

    const detectedSlug = best && best.score >= 4 ? best.slug : 'other'
    const categorySlug = customerChoice ?? detectedSlug

    const signals = CATEGORY_SIGNALS.find((entry) => entry.slug === categorySlug)
    const actions = deriveActions(text, signals?.actions ?? ['Errand'])
    const complexity = deriveComplexity(text, signals?.baseComplexity ?? 'medium')
    const suggestedUrgency = deriveUrgency(text)

    // Confidence: margin over the runner-up, tempered by how much text we had.
    let confidence = 0.3
    if (best && best.score > 0) {
      const margin = best.score - (runnerUp?.score ?? 0)
      confidence = Math.min(0.95, 0.35 + best.score * 0.03 + margin * 0.04)
    }
    if (customerChoice) confidence = Math.max(confidence, 0.8)
    if (raw.length < 60) confidence = Math.min(confidence, 0.55)
    if (categorySlug === 'other') confidence = Math.min(confidence, 0.45)

    const notes: string[] = []
    const handlesMoney = MONEY_SIGNALS.some((signal) => text.includes(signal))
    if (handlesMoney) {
      notes.push('Involves handling the customer’s money — confirm the spend limit in the quote.')
    }
    if (raw.length < 80) {
      notes.push('Short description. Ask the customer for the exact address, name and timing.')
    }
    if (complexity === 'high') {
      notes.push('Multi-step or high-stakes task. Consider a senior agent and a wider time window.')
    }
    if (!input.city) {
      notes.push('No city on the request — confirm the operating area before quoting.')
    }
    if (categorySlug === 'other' && !customerChoice) {
      notes.push('Category could not be determined from the description. Needs a human read.')
    }

    // Proof is the default. It is only relaxed for simple, money-free errands.
    const requiresProof = !(complexity === 'low' && !handlesMoney && categorySlug === 'personal-errands')

    return {
      provider: 'deterministic',
      categorySlug,
      categoryName: CATEGORY_NAMES[categorySlug] ?? 'Other',
      taskSummary: summarise(raw, actions, categorySlug),
      suggestedActions: actions,
      complexity,
      requiresProof,
      suggestedUrgency,
      confidence: Number(confidence.toFixed(2)),
      notes,
      generatedAt: new Date().toISOString(),
    }
  },
}
