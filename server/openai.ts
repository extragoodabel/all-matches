import OpenAI from "openai";

// Simulate typing delay based on message length
function calculateTypingDelay(message: string): number {
  // Average typing speed: ~40 words per minute
  const wordsPerMinute = 40;
  const wordCount = message.split(' ').length;
  const minutes = wordCount / wordsPerMinute;
  return Math.min(Math.max(minutes * 60 * 1000, 2000), 5000); // Between 2-5 seconds
}

export async function generateAIResponse(
  context: {
    profileName: string;
    profileBio: string;
    messageHistory: { content: string; isAI: boolean }[];
  },
  userMessage: string
): Promise<{ content: string; typingDelay: number }> {
  try {
    // If OpenAI API is available, use it
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const prompt = `You are ${context.profileName}, with this bio: "${context.profileBio}".
      You are chatting on a dating app. Keep these rules in mind:
      1. Stay in character according to your bio
      2. Keep responses conversational and natural, showing genuine interest
      3. Ask follow-up questions to keep the conversation going
      4. Reference previous messages for context
      5. Keep responses between 1-3 sentences
      6. Never be inappropriate or overly forward

      Previous messages:
      ${context.messageHistory.map(m => `${m.isAI ? context.profileName : 'User'}: ${m.content}`).join('\n')}

      User: ${userMessage}
      ${context.profileName}:`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.8,
      });

      const content = response.choices[0].message.content || getRandomResponse();
      const typingDelay = calculateTypingDelay(content);

      return { content, typingDelay };
    }

    // Fallback to mock responses if no API key
    const content = getRandomResponse();
    const typingDelay = calculateTypingDelay(content);
    return { content, typingDelay };
  } catch (error) {
    console.error("Error generating AI response:", error);
    const content = getRandomResponse();
    const typingDelay = calculateTypingDelay(content);
    return { content, typingDelay };
  }
}

const mockResponses = [
  "Hey there! How's your day going? 😊",
  "That's interesting! What made you decide to try this app?",
  "I love having deep conversations about shared interests! What kind of music are you into?",
  "That's really cool! I've been wanting to try that too. What would you recommend for a beginner?",
  "Wow, we have so much in common! Tell me more about your favorite experiences.",
  "I totally get what you mean! It's rare to find someone who understands that perspective.",
  "Your interests are fascinating! What inspired you to get into that?",
];

function getRandomResponse(): string {
  const randomIndex = Math.floor(Math.random() * mockResponses.length);
  return mockResponses[randomIndex];
}