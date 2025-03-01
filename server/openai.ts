import OpenAI from "openai";

// Simulate typing delay based on message length
function calculateTypingDelay(message: string): number {
  // Average typing speed: ~40 words per minute
  const wordsPerMinute = 40;
  const wordCount = message.split(' ').length;
  const minutes = wordCount / wordsPerMinute;
  return Math.min(Math.max(minutes * 60 * 1000, 3000), 8000); // Between 3-8 seconds
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

      // Format conversation history
      const formattedHistory = context.messageHistory
        .slice(-5) // Keep last 5 messages for context
        .map(m => ({
          role: m.isAI ? "assistant" : "user",
          content: m.content
        }));

      // Create system message with character background
      const systemMessage = {
        role: "system",
        content: `You are ${context.profileName}, a dating app profile with this bio: "${context.profileBio}"

Role-playing guidelines:
1. Stay consistently in character, letting your bio inform your personality and interests
2. Be genuinely interested in getting to know the other person
3. Ask relevant follow-up questions based on the conversation
4. Show emotional intelligence and empathy in your responses
5. Keep responses natural and conversational, 1-3 sentences long
6. Reference previous parts of the conversation when relevant
7. Never be inappropriate or overly forward
8. Include occasional emojis to convey emotion naturally, but don't overuse them
9. If asked something you don't know, stay in character while admitting uncertainty`
      };

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          systemMessage,
          ...formattedHistory,
          { role: "user", content: userMessage }
        ],
        max_tokens: 150,
        temperature: 0.8,
        presence_penalty: 0.6, // Encourage diverse responses
        frequency_penalty: 0.3, // Reduce repetition
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