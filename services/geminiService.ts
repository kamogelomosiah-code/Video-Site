import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: In a real environment, ensure the API key is secured via backend proxy or env variables
const apiKey = process.env.API_KEY || 'dummy_key';
const ai = new GoogleGenAI({ apiKey });

export const generateSmartTags = async (description: string): Promise<string[]> => {
  try {
    const model = 'gemini-2.5-flash';
    const response = await ai.models.generateContent({
      model,
      contents: `Generate 5 relevant, safe, and professional tags for a creative professional based on this bio: "${description}". Return only the tags as a comma-separated list.`,
    });
    
    const text = response.text || '';
    return text.split(',').map(tag => tag.trim());
  } catch (error) {
    console.error("Gemini API Error:", error);
    return ['Creative', 'Professional']; // Fallback
  }
};

export const analyzeSafety = async (content: string): Promise<boolean> => {
    // Mock safety check for compliance
    // In production, this would use the moderation API
    return true; 
}