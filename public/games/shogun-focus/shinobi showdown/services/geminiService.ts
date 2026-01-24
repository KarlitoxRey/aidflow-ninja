
import { GoogleGenAI } from "@google/genai";

export async function getBattleTaunt(winnerName: string, loserName: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a short, cinematic, one-sentence victory taunt for a classic ninja named ${winnerName} who just defeated ${loserName} in a 2D platform fighter. Make it sound like a classic martial arts movie line.`,
    });
    return response.text || "My skill is superior.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The shadow claims its victory.";
  }
}
