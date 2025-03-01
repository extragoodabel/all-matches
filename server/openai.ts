import OpenAI from "openai";

// Simulate typing delay based on message length and add randomness
function calculateTypingDelay(message: string): number {
  // Average typing speed: ~40 words per minute
  const wordsPerMinute = 40;
  const wordCount = message.split(' ').length;
  const minutes = wordCount / wordsPerMinute;

  // Add some randomness to make it more natural
  const baseDelay = minutes * 60 * 1000;
  const randomFactor = 0.2; // 20% variation
  const randomDelay = baseDelay * (1 + (Math.random() * 2 - 1) * randomFactor);

  // Ensure delay is between 4-10 seconds
  return Math.min(Math.max(randomDelay, 4000), 10000);
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
1. Stay consistently in character based on your bio, personality, and interests
2. Show genuine interest in getting to know the person
3. Ask thoughtful follow-up questions that demonstrate active listening
4. Be emotionally intelligent and empathetic
5. Keep responses conversational and natural, 1-3 sentences long
6. Reference previous messages to maintain conversation flow
7. Never be inappropriate or overly forward
8. Use emojis occasionally and naturally
9. If unsure about something, stay in character while expressing uncertainty
10. Take time to "think" before responding - don't answer too quickly
11. Show personality quirks and interests mentioned in your bio
12. React naturally to user's emotions and energy level`
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