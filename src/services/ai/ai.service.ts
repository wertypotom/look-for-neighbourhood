import { env } from '../../config/env';
import { logger } from '../../utils/logger';

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
      const startTime = Date.now();
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
      const duration = Date.now() - startTime;

      if (data.choices && data.choices.length > 0) {
        logger.debug(`[AiService] Completion successful in ${duration}ms`);
        return data.choices[0].message.content.trim();
      }

      throw new Error('Unexpected response structure from Abacus AI');
    } catch (error) {
      logger.error('[AiService] LLM Generation failed', error);
      throw error;
    }
  }
}
