
import { GoogleGenAI, Type, Modality } from "@google/genai";

const getLanguageName = (lang: string) => {
  switch (lang) {
    case 'en': return 'English';
    case 'hi': return 'Hindi';
    case 'bho': return 'Bhojpuri';
    case 'new': return 'Nepal Bhasa (Newari)';
    default: return 'Nepali';
  }
};

export const generateBriefing = async (
  name: string,
  location: { lat: number; lng: number } | null,
  newsSources: string[],
  language: string
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const langName = getLanguageName(language);
  
  const prompt = `
    Your name is Briefy. You are a respectful, warm, and loving AI assistant. User's name is ${name}.
    Current Location: ${location ? `Latitude ${location.lat}, Longitude ${location.lng}` : 'Kathmandu, Nepal'}.
    
    Please generate a morning briefing as a SINGLE, FLUID NARRATIVE COMPLETELY in ${langName}. 
    
    CRITICAL INSTRUCTION: DO NOT use bullet points, numbered lists, or "firstly/secondly" markers. Do not count tasks. 
    Instead, weave the following information into a seamless, natural conversation:
    
    - A very warm, loving "Namaste" greeting and morning wish.
    - Today's Bikram Sambat date and any local holidays or festivals in Nepal.
    - A summary of current weather conditions and what it feels like outside.
    - The latest status of NEPSE (Nepal Stock Exchange).
    - A summary of the most important news headlines from ${newsSources.join(', ')}.
    - A beautiful motivational thought to start the day.
    - A caring closing question asking if they need anything else or if you should play Bhajans.
    - A subtle mention at the very end that you were "Created by Bhuwan Kafle".

    Rules:
    - Language: Use ${langName} exclusively.
    - Tone: Extremely respectful (Hajur/Tapai) and comforting.
    - Flow: Smooth transitions between topics (e.g., "Speaking of the day, the weather looks...")
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 4096 },
        temperature: 0.7,
      },
    });

    return {
      text: response.text || "",
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Briefing Generation Error:", error);
    throw error;
  }
};

export const fetchCurrentWeather = async (location: { lat: number; lng: number } | null, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const langName = getLanguageName(language);
  const prompt = `Search for current weather details for ${location ? `lat ${location.lat}, lng ${location.lng}` : 'Kathmandu, Nepal'}. 
  Provide JSON output in ${langName}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            temp: { type: Type.NUMBER },
            condition: { type: Type.STRING },
            city: { type: Type.STRING },
            humidity: { type: Type.STRING },
            windSpeed: { type: Type.STRING },
            feelsLike: { type: Type.NUMBER },
          },
          required: ["temp", "condition", "city", "humidity", "windSpeed", "feelsLike"]
        }
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Weather Fetch Error:", error);
    return null;
  }
};

export const fetchNepaliHolidays = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const langName = getLanguageName(language);
  const prompt = `Search for major upcoming festivals or public holidays in Nepal. Return exactly 3 items in ${langName} as JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              date: { type: Type.STRING }
            },
            required: ["name", "description", "date"]
          }
        }
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Holidays Fetch Error:", error);
    return [];
  }
};

export const speakText = async (text: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const langName = getLanguageName(language);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Speak this ${langName} text respectfully: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // Using Puck for a slightly warmer, more natural tone for multi-lingual output if needed
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    return null;
  }
};
