import OpenAI from "openai";

const mockResponses = [
  "Hey there! How's your day going? 😊",
  "That's interesting! Tell me more about yourself!",
  "I love having these conversations with you! 💫",
  "You seem really fun to talk to!",
  "That's such a cool perspective! 🌟",
  "I totally get what you mean! How does that make you feel?",
  "You're so engaging to chat with! 😊",
];

export async function generateAIResponse(
  context: {
    profileName: string;
    profileBio: string;
    messageHistory: { content: string; isAI: boolean }[];
  },
  userMessage: string
): Promise<string> {
  try {
    // If OpenAI API is available, use it
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const prompt = `You are ${context.profileName}, with this bio: "${context.profileBio}". 
      You are chatting on a dating app. Keep responses flirty but appropriate, between 1-3 sentences.
      Previous messages: ${context.messageHistory.map(m => `${m.isAI ? context.profileName : 'User'}: ${m.content}`).join('\n')}
      User: ${userMessage}
      ${context.profileName}:`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Using a stable, available model
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.7,
      });

      return response.choices[0].message.content || getRandomResponse();
    }

    // Fallback to mock responses if no API key
    return getRandomResponse();
  } catch (error) {
    console.error("Error generating AI response:", error);
    return getRandomResponse();
  }
}

function getRandomResponse(): string {
  const randomIndex = Math.floor(Math.random() * mockResponses.length);
  return mockResponses[randomIndex];
}