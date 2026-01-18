
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
    Your name is Briefy. You are a respectful and loving AI assistant. User's name is ${name}.
    
    Current Location: ${location ? `Latitude ${location.lat}, Longitude ${location.lng}` : 'Kathmandu, Nepal'}.
    
    Please generate a morning briefing COMPLETELY in ${langName}.
    
    Structure:
    1. Greeting: Start with "Namaste ${name}, Good Morning!" followed by a very warm, loving message wishing them a wonderful day in ${langName}.
    2. Calendar & Holidays: 
       - State today's date (Bikram Sambat).
       - Use Google Search to check for any national public holidays in Nepal today.
       - IMPORTANT: Specifically check if there are any LOCAL or regional public holidays today in the area corresponding to ${location ? `lat ${location.lat}, lng ${location.lng}` : 'the user\'s location'}. Mention if today is a public holiday specifically for that district or region.
    3. Weather: Current weather and temperature for the current location.
    4. Stocks: Latest update on NEPSE (Nepal Stock Exchange).
    5. News: Summarize the latest news from ${newsSources.join(', ')} in a natural narrative flow.
    6. Motivation: A short, beautiful motivational quote.
    7. Closing: Ask "Do you want to know anything else or should I play some Bhajans for you?"
    8. Credit: Mention "Created by Bhuwan Kafle" with respect at the very end.

    Rules:
    - Language: Use ${langName} exclusively.
    - Tone: Extremely respectful (using "Hajur", "Tapai" equivalents).
    - Accuracy: If no local holiday is found, just mention the national ones or say it's a regular working day.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.7,
      },
    });

    if (!response || !response.text) {
      throw new Error("Empty response from Gemini API");
    }

    return {
      text: response.text,
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
  Provide JSON output with the following fields: 
  - temp (number, Celsius)
  - condition (string in ${langName})
  - city (string in ${langName})
  - humidity (string, e.g. "60%")
  - windSpeed (string, e.g. "12 km/h")
  - feelsLike (number, Celsius)`;

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

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Weather Fetch Error:", error);
    return null;
  }
};

export const fetchNepaliHolidays = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const langName = getLanguageName(language);
  const prompt = `Search for 3 upcoming major Nepali festivals and public holidays. 
  Return a simple list with dates in ${langName}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return [{ name: language === 'en' ? "Upcoming Events" : "आगामी बिदा/चाडपर्व", date: "-", description: response.text || "No info" }];
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
      contents: [{ parts: [{ text: `Speak this ${langName} text in a warm, natural, and respectful voice: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
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
