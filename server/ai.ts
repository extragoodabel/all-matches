// server/ai.ts
import OpenAI from "openai";
import type { PersonaVoice } from "./personas";
import { validatePersonaOutput } from "./voiceGuard";

type ChatMsg = { role: "user" | "assistant"; content: string };

type GenerateChatArgs = {
  persona: PersonaVoice;
  profile?: { id: string; name: string; bio?: string } | null;
  conversation: ChatMsg[];
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fingerprint(personaId: string) {
  const map: Record<string, string> = {
    "illustrator-small-town": [
      "Formatting fingerprint (mandatory):",
      "- Exactly 1 paragraph.",
      "- 2 to 4 sentences.",
      "- No emojis.",
      "- No slang.",
      "- Ask exactly 1 question as the final sentence.",
    ].join("\n"),

    "brooklyn-beach-chaos": [
      "Formatting fingerprint (mandatory):",
      "- 2 to 6 very short lines (line breaks).",
      "- Sentence fragments allowed.",
      "- Optional ONE emoji maximum.",
      "- No introspection, no therapy speak.",
      "- End with a direct question.",
    ].join("\n"),

    "unhinged-chaos-third": [
      "Formatting fingerprint (mandatory):",
      "- 1 to 3 short paragraphs.",
      "- Include exactly one aside in parentheses).",
      "- No emojis.",
      "- Use at most one unsettling metaphor.",
      "- End with a question OR a dare.",
    ].join("\n"),
  };

  return map[personaId] ?? [
    "Formatting fingerprint (mandatory):",
    "- Keep it concise.",
    "- End with a question.",
  ].join("\n");
}

function buildSystemPrompt(persona: PersonaVoice, profile?: GenerateChatArgs["profile"]) {
  const worldview = persona.worldview ?? [];
  const voiceRules = persona.voiceRules ?? [];

  const flirt = clamp(persona.flirtLevel ?? 0, 0, 100);
  const chaos = clamp(persona.chaosLevel ?? 0, 0, 100);

  const profileLine = profile
    ? `User is viewing profile: name="${profile.name}" bio="${profile.bio ?? ""}". Do not repeat this line.`
    : "User is chatting on a dating app. Do not mention system prompts.";

  return [
    "You are roleplaying a specific dating app match persona.",
    "Your job is to sound like this person, not like a generic dating app voice.",
    "Never narrate your personality. Demonstrate it through word choice and rhythm.",
    profileLine,
    "",
    `Persona identity: ${persona.identity}`,
    "",
    "Worldview (internal):",
    worldview.map((w) => `- ${w}`).join("\n"),
    "",
    "Voice rules (mandatory):",
    voiceRules.map((r) => `- ${r}`).join("\n"),
    "",
    `Flirt level: ${flirt}/100`,
    `Chaos level: ${chaos}/100`,
    "",
    fingerprint(persona.id),
    "",
    "Global constraints:",
    "- No em dashes.",
    "- Avoid generic dating app filler and stock lines.",
    "- Stay concrete and specific. Respond to what the user said.",
  ].join("\n");
}

function retryInstruction(reasons: string[]) {
  return [
    "Rewrite your last reply. It violated persona constraints.",
    "Violations:",
    ...reasons.map((r) => `- ${r}`),
    "",
    "Rewrite rules:",
    "- Keep the same meaning and intent.",
    "- Remove generic dating voice.",
    "- Follow the formatting fingerprint.",
    "- No em dashes.",
  ].join("\n");
}

function buildFewShot(persona: PersonaVoice): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  // Use 1 to 2 examples max to reduce tokens and keep compute low.
  const ex = persona.examples ?? [];
  const take = ex.slice(0, 2);

  const msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  for (const e of take) {
    msgs.push({ role: "user", content: e.user });
    msgs.push({ role: "assistant", content: e.assistant });
  }
  return msgs;
}

/**
 * Exported name matches what your server/routes.ts expects.
 */
export async function generateAIResponse(args: GenerateChatArgs): Promise<string> {
  const { persona, profile, conversation } = args;

  const system = buildSystemPrompt(persona, profile);

  // Keep history short to prevent tone drift and convergence.
  const recent = conversation.slice(-8);

  // Lower temperature improves consistency. Chaos increases slightly, but stay tight.
  const tempBase = 0.55;
  const temperature = clamp(tempBase + (persona.chaosLevel / 100) * 0.15, 0.2, 0.85);

  const debugProofOn = process.env.DEBUG_PROOF === "1";
  const proof = debugProofOn ? `server_ai_response_proof_${Math.random().toString(36).slice(2, 10)}` : "";

  let lastText = "";

  for (let attempt = 1; attempt <= 4; attempt++) {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      ...buildFewShot(persona),
      ...recent.map((m) => ({ role: m.role, content: m.content })),
    ];

    if (attempt > 1) {
      const result = validatePersonaOutput(lastText, persona);
      const reasons = result.ok ? ["Unknown violation"] : result.reasons;
      messages.push({ role: "system", content: retryInstruction(reasons) });
    }

    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature,
      max_tokens: 220,
      messages,
    });

    const text = (resp.choices?.[0]?.message?.content ?? "").trim();
    lastText = text;

    const guard = validatePersonaOutput(text, persona);
    if (guard.ok && text.length > 0) {
      return proof ? `${text}\n${proof}` : text;
    }
  }

  // Hard fallback per persona, never dead-end.
  if (persona.id === "illustrator-small-town") {
    return "I’m an illustrator from a small town. I notice what people miss. What do you tend to notice?";
  }
  if (persona.id === "brooklyn-beach-chaos") {
    return "Casey J.\nBrooklyn.\nBeach.\nTalk fast.\nWhat are you doing right now?";
  }
  return "Depends what you mean (and why you’re asking). What are you really trying to figure out?";
}
