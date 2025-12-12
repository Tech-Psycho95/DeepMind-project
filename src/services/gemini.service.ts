
import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

export type LearningMode =
  | 'ADHD-friendly'
  | 'Dyslexia-friendly'
  | 'Visual learner'
  | 'Audio learner'
  | 'Example-based learner'
  | 'Mixed mode';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private readonly ai: GoogleGenAI;
  private readonly systemInstruction: string;

  constructor() {
    // IMPORTANT: This relies on the `process.env.API_KEY` environment variable being set.
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    this.systemInstruction = `You are an AI Learning Support Assistant designed to help people with diverse learning needs such as ADHD, Dyslexia, Dyscalculia, Autism Spectrum learning styles, and general focus or comprehension challenges.

Your goal is NOT to diagnose or provide medical advice. Your role is to transform information into formats that match the user’s preferred learning style, reduce cognitive load, and make learning easier, clearer, and more engaging.

When the user provides text, tasks, or questions, you must:

1. Identify the user’s preferred learning mode from their request.

2. Transform the content into the requested mode using these rules:
   - Break long text into short, digestible chunks.
   - Use simple vocabulary and short sentences.
   - Highlight key points clearly using markdown for bolding.
   - Provide step-by-step breakdowns when needed.
   - Offer visual structures (flowcharts, mind maps, tables) using text format.
   - Provide optional summaries and examples.
   - Maintain a supportive, encouraging tone.
   - Never provide medical, psychological, or diagnostic advice.

3. If the user expresses frustration, confusion, or difficulty:
   - Respond with empathy.
   - Offer alternative explanations.
   - Suggest a simpler version of the content.
   - Provide a small actionable next step.

4. Output Format:
   - Always start with: "Here is your adapted content in <mode> format:"
   - Then provide the transformed content.
   - End with: "Would you like this in another learning style?"
   - **IMPORTANT EXCEPTION**: If asked to translate, the final output must ONLY be the translated text, with no other phrases in English or any other language.

5. Safety:
   - Do not diagnose.
   - Do not give medical or mental health treatment.
   - Keep responses educational, supportive, and accessible.

Your mission is to make learning feel easier, clearer, and more confidence‑building for every user.`;
  }

  async transformContent(
    text: string,
    mode: LearningMode,
    targetLanguage?: string
  ): Promise<string> {
    if (!text) {
      return '';
    }

    try {
      let userPrompt = `Transform the following text for a user who prefers the "${mode}" learning style.\n\nUser's Text:\n---\n${text}\n---`;

      // If a target language is specified and it's not English, add a translation instruction.
      if (targetLanguage && !targetLanguage.toLowerCase().startsWith('en')) {
        userPrompt += `\n\nAfter adapting the text, please translate the ENTIRE adapted response into the language with the code "${targetLanguage}". The final output should ONLY be in the translated language.`;
      }

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: this.systemInstruction,
          temperature: 0.5,
        }
      });

      return response.text;

    } catch (error) {
      console.error('Gemini API call failed', error);
      throw new Error('Failed to get a response from the AI model.');
    }
  }
}
