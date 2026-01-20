
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

const extractWeatherData = (text: string) => {
  const tempMatch = text.match(/(\d+)\s*(°C|C|degrees)/i);
  return {
    temp: tempMatch ? parseInt(tempMatch[1]) : "--",
    city: "Kathmandu",
    text: text
  };
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
    DO NOT use bullet points, numbered lists, or "firstly/secondly" markers.
    
    Incorporate: Greeting, Bikram Sambat Date, Festivals in Nepal, Current Weather summary, NEPSE status, News from ${newsSources.join(', ')}, a beautiful quote, and a caring closing question.
    Finish with "Created by Bhuwan Kafle".

    Tone: Extremely respectful and comforting.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        maxOutputTokens: 8192,
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

export const processVoiceCommand = async (audioBase64: string, language: string, mimeType: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const langName = getLanguageName(language);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: audioBase64
          }
        },
        { text: `The user said something in ${langName}. Please respond briefly and respectfully in ${langName}. If they want to play Bhajans, simply say "भजन बजाउँदैछु" or equivalent in their language.` }
      ],
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.7,
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Voice Processing Error:", error);
    return "Hajur, maile bujhina. Pheri bhannuhunchha ki?";
  }
};

export const fetchCurrentWeather = async (location: { lat: number; lng: number } | null, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const langName = getLanguageName(language);
  const prompt = `Search for current weather details for ${location ? `lat ${location.lat}, lng ${location.lng}` : 'Kathmandu, Nepal'}. Provide a brief summary including temperature in Celsius and city in ${langName}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    const data = extractWeatherData(text);
    if (location) data.city = "Current Location";
    
    return data;
  } catch (error) {
    console.error("Weather Fetch Error:", error);
    return null;
  }
};

export const fetchNepaliHolidays = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const langName = getLanguageName(language);
  const prompt = `Search for upcoming major festivals and public holidays in Nepal for the current month. Provide a list in ${langName}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return [{ text: response.text || "" }];
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
