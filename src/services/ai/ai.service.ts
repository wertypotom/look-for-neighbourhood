import { env } from '../../config/env';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiService {
  /**
   * Calls the Abacus AI chat completion endpoint (OpenAI compatible API).
   * @param messages The system and user prompts
   * @param temperature Lower is more deterministic
   * @returns The string response from the LLM
   */
  static async generateCompletion(
    messages: LLMMessage[],
    temperature = 0.2,
  ): Promise<string> {
    try {
      // Assuming Abacus AI allows an OpenAI-compatible /chat/completions route with their proxy
      // The model name 'llama-3-70b' is a placeholder depending on Abacus's hosted models
      const response = await fetch(`${env.ABACUS_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.ABACUS_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-5',
          messages,
          temperature,
          max_tokens: 300, // Force it to stay extremely brief
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Abacus API Error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
      }

      throw new Error('Unexpected response structure from Abacus AI');
    } catch (error) {
      console.error('[AiService] LLM Generation failed:', error);
      throw error;
    }
  }
}
