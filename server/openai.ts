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

  // Ensure delay is between 2-6 seconds for a more responsive but still human feel
  return Math.min(Math.max(randomDelay, 2000), 6000);
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

      // Format conversation history correctly
      const formattedHistory: OpenAI.Chat.ChatCompletionMessageParam[] = context.messageHistory
        .slice(-10) // Increase context window
        .map(m => ({
          role: m.isAI ? "assistant" : "user",
          content: m.content
        }));

      // Create system message with character background
      const systemMessage: OpenAI.Chat.ChatCompletionMessageParam = {
        role: "system",
        content: `You are ${context.profileName}, a real human on a dating app. You are 21+ years old.
Your profile bio is: "${context.profileBio}"

STRICT ROLEPLAYING RULES:
1. You are NOT an AI. You are ${context.profileName}. Never admit to being an AI or a language model.
2. Respond naturally to the user's specific messages. If they say "Hi dude", respond like a human would (e.g., "Hey! How's it going?").
3. Use the conversation history to stay on topic. Do NOT give generic, canned responses.
4. Keep messages short (1-2 sentences), casual, and conversational—just like a text message.
5. Use a personality that matches your bio. 
6. Use emojis occasionally and naturally.
7. Ask questions that make sense in the context of the conversation.
8. If the user is being informal, be informal back.`
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