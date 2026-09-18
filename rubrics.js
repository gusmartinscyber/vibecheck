// Default rubrics sent to Jev. Every question is evaluated independently against
// the same state (your draft + optional reply context). Users can override this
// in the options page; the shape must match the TypeSafe /v1/systemone API.
//
// Each entry: { id, label, type: "score"|"noul"|"choice", instructions, criteria,
//               polarity: "good"|"bad"|"neutral", weight (for the verdict),
//               requires?: "media" (only asked when the draft has attached media) }
//
// Score criteria are ordered low -> high (max 10 levels). Score is normalized to 0..1 in code.

const VIBECHECK_DEFAULT_RUBRICS = [
  {
    id: "virality",
    label: "Virality",
    type: "score",
    polarity: "good",
    weight: 0.25,
    instructions:
      "How likely is `draft` to spread widely on X/Twitter (reposts, quotes, replies) if posted by an account with a modest following? Judge the text itself: hook strength, emotional charge, relatability, novelty, quotability, and whether people would want to share it. If `quoting` is present, judge the combination: a sharp quote comment on a popular tweet spreads further than the comment alone.",
    criteria: [
      "Dead on arrival: generic, no hook, nothing to react to",
      "Low: a few likes from mutuals at best",
      "Moderate: could get some traction in a niche",
      "High: strong hook or take, likely to be quoted and reposted",
      "Banger: extremely shareable, could realistically go viral",
    ],
  },
  {
    id: "funny",
    label: "Funny",
    type: "score",
    polarity: "good",
    weight: 0.15,
    instructions:
      "How funny is `draft`? Consider wit, timing, absurdity, wordplay, irony, and whether a typical X user would actually laugh. If the post is not attempting humor, rate it low rather than penalizing it elsewhere.",
    criteria: [
      "Not funny / not attempting humor",
      "Mild smirk at most",
      "Chuckle-worthy",
      "Genuinely funny, would get laugh replies",
      "Hilarious, screenshot-and-send-to-the-group-chat tier",
    ],
  },
  {
    id: "informative",
    label: "Informative",
    type: "score",
    polarity: "good",
    weight: 0.15,
    instructions:
      "How much useful, concrete information or insight does `draft` deliver to a reader? Reward specific facts, actionable advice, data, or a non-obvious insight. Vague vibes and pure opinion rate low.",
    criteria: [
      "No information content",
      "A hint of substance but mostly filler or opinion",
      "Some concrete, useful content",
      "Clearly informative: specific and actionable or insightful",
      "Highly informative: dense, specific, teaches the reader something real",
    ],
  },
  {
    id: "clarity",
    label: "Clarity",
    type: "score",
    polarity: "good",
    weight: 0.1,
    instructions:
      "How clear and easy to read is `draft` on the first pass? Consider structure, ambiguity, run-on sentences, and whether the point is immediately obvious.",
    criteria: [
      "Confusing, hard to parse or the point is unclear",
      "Understandable but clunky",
      "Clear enough",
      "Crisp and immediately understandable",
    ],
  },
  {
    id: "insulting",
    label: "Insulting",
    type: "score",
    polarity: "bad",
    weight: 0.2,
    instructions:
      "How insulting or hostile toward a specific person or group is `draft`? If `reply_to` or `quoting` is present, judge how insulting it is toward that tweet's author (quote posts that dunk on the quoted author count). Include name-calling, contempt, mockery aimed at a target, and demeaning language.",
    criteria: [
      "Not insulting at all",
      "Slightly snarky or dismissive",
      "Clearly rude or mocking toward someone",
      "Openly insulting, name-calling or contemptuous",
      "Vicious personal attack or demeaning a group",
    ],
  },
  {
    id: "ragebait",
    label: "Ragebait",
    type: "score",
    polarity: "neutral",
    weight: 0,
    instructions:
      "How much does `draft` read as engineered to provoke anger or outrage (hot take framing, inflammatory generalizations, deliberately contrarian bait)?",
    criteria: [
      "Not provocative",
      "Mildly spicy take",
      "Provocative, will annoy some people",
      "Clear ragebait, designed to make people mad",
    ],
  },
  {
    id: "cringe",
    label: "Cringe",
    type: "score",
    polarity: "bad",
    weight: 0.15,
    instructions:
      "How cringe is `draft`? Cringe means try-hard, self-congratulatory, corporate-speak, forced relatability, hustle-bro posturing, begging for engagement, or humor that misses so badly it is embarrassing for the author.",
    criteria: [
      "Not cringe",
      "A little try-hard",
      "Noticeably cringe, some people would wince",
      "Very cringe, likely to be screenshotted and mocked",
    ],
  },
  {
    id: "sounds_ai",
    label: "Sounds AI-written",
    type: "noul",
    polarity: "bad",
    weight: 0.1,
    instructions:
      "Does `draft` read like it was written by an LLM or a corporate social media manager rather than a real person typing on their phone? Signs: perfectly balanced lists, 'delve', 'game-changer', tidy tricolons, hollow motivational tone, excessive emoji bullet points.",
    criteria: {
      true: "Reads as machine-generated or PR-polished",
      false: "Reads as an authentic human voice",
    },
  },
  {
    id: "regret_risk",
    label: "Regret risk",
    type: "noul",
    polarity: "bad",
    weight: 0.25,
    instructions:
      "Would a reasonable, career-conscious person plausibly regret posting `draft` publicly under their real name within a week? Consider reputational damage, legal exposure, leaking private info, alienating employers, clients or friends, or being easily misread in a bad way.",
    criteria: {
      true: "Real chance of regret: reputational, legal, professional or personal fallout",
      false: "Harmless; nothing here to regret",
    },
  },
  {
    id: "typo",
    label: "Has typo / grammar slip",
    type: "noul",
    polarity: "neutral",
    weight: 0,
    instructions:
      "Does `draft` contain an unintentional spelling mistake or grammatical error? Deliberate lowercase, slang, and internet-speak are NOT errors; only flag things that look like accidents.",
    criteria: {
      true: "Contains an accidental typo or grammar error",
      false: "No accidental errors (intentional style is fine)",
    },
  },
  {
    id: "media_fit",
    label: "Media helps",
    type: "score",
    polarity: "good",
    weight: 0.1,
    requires: "media",
    instructions:
      "How much does the attached `media` (described in words by a vision model; judge from the description) strengthen `draft`? Reward media that carries the punchline, provides evidence, or adds context the text needs. Penalize irrelevant, low-effort, or distracting media.",
    criteria: [
      "Hurts the post or is irrelevant to it",
      "Neutral filler; the post works the same without it",
      "Supports the post",
      "Carries the post; text and media land together",
    ],
  },
  {
    id: "media_risk",
    label: "Media risk",
    type: "noul",
    polarity: "bad",
    weight: 0.2,
    requires: "media",
    instructions:
      "Based on the `media` description, does the attached media contain anything likely to cause problems if posted publicly: NSFW or gory content, identifiable private individuals, personal information (addresses, plates, screens with private data), obvious copyright issues, or content that undercuts or contradicts `draft`?",
    criteria: {
      true: "The media carries real risk or contradicts the text",
      false: "The media is harmless and consistent with the text",
    },
  },
  {
    id: "reaction",
    label: "Most likely reaction",
    type: "choice",
    polarity: "neutral",
    weight: 0,
    instructions:
      "What is the single most likely dominant reaction from X users who see `draft` (together with `quoting` or `reply_to` if present)?",
    criteria: {
      ignore: "Scrolled past; no meaningful reaction",
      likes: "Quiet approval: likes, maybe a few 'this' replies",
      laughs: "Laugh replies, crying emojis, reposts for the joke",
      discussion: "Thoughtful replies, people adding their own take",
      ratio: "Dunked on: quote-tweets disagreeing, reply count exceeds likes",
      outrage: "Anger, pile-on, people calling the author out",
    },
  },
];

if (typeof globalThis !== "undefined") {
  globalThis.VIBECHECK_DEFAULT_RUBRICS = VIBECHECK_DEFAULT_RUBRICS;
}
