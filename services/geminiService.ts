
import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateBriefing = async (
  name: string,
  location: { lat: number; lng: number } | null,
  newsSources: string[],
  language: string
) => {
  const prompt = `
    तपाईंको नाम Briefy हो र तपाईं एउटा आत्मीय AI सहायक हुनुहुन्छ। हजुरको प्रयोगकर्ताको नाम ${name} हो। 
    कृपया एउटा अत्यन्तै मिठो, सम्मानजनक र प्रेमपूर्ण बिहानी ब्रिफिङ तयार पार्नुहोस्।
    
    ब्रिफिङमा अनिवार्य रूपमा यी कुराहरू समावेश गर्नुहोस्:
    १. आजको नेपाली पात्रो (विक्रम संवत) अनुसार नेपालमा कुनै "सार्वजनिक बिदा" (Public Holiday) वा विशेष चाडपर्व छ कि छैन भनेर Google Search मार्फत पत्ता लगाउनुहोस् र छ भने त्यसको बारेमा सम्मानजनक जानकारी दिनुहोस्।
    २. वर्तमान मौसम, सूर्योदय र सूर्यास्त समय (स्थान: ${location ? `अक्षांश ${location.lat}, देशान्तर ${location.lng}` : 'नेपाल'}) बारे जानकारी।
    ३. नेप्से (NEPSE) को पछिल्लो अवस्था।
    ४. ताजा समाचारहरू (${newsSources.join(', ')}) लाई बुँदागत (१, २, ३) रूपमा नभनी प्राकृतिक प्रवाहमा वाचन गर्नुहोस्।
    ५. एउटा सानो उत्प्रेरणादायी भनाइ।
    ६. ब्रिफिङको अन्तमा यो प्रश्न सोध्नुहोस्: "हजुरलाई थप केहि कुरा जान्न मन छ कि म हजुरको लागि भजन बजाउँ?"

    नियमहरू:
    - भाषा: पूर्ण रूपमा नेपाली र अत्यन्तै आदरार्थी (तपाईं, हजुर)।
    - शैली: यो अडियोको लागि हो, त्यसैले सुन्दा प्राकृतिक र आत्मीय लाग्नुपर्छ।
    - विकासकर्ता: "भुवन काफ्ले (kaflebhuwan68@gmail.com)" को नाम अन्तमा एकदमै छोटो र मिठो गरी लिनुहोस्।
    
    ताजा र सही जानकारीको लागि Google Search को प्रयोग अनिवार्य छ।
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.6,
      },
    });

    return {
      text: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Briefing Generation Error:", error);
    throw error;
  }
};

export const fetchCurrentWeather = async (location: { lat: number; lng: number } | null) => {
  const prompt = `Provide current weather for ${location ? `lat ${location.lat}, lng ${location.lng}` : 'Nepal'}. 
  Return JSON: {temp, condition, city}. Translate strings to Nepali. Use Google Search.`;

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
          },
          required: ["temp", "condition", "city"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Weather Fetch Error:", error);
    return null;
  }
};

export const fetchNepaliHolidays = async () => {
  const prompt = `Search for the next 3 upcoming major Nepali festivals and public holidays in the current Nepali calendar year (Bikram Sambat).
  Return only JSON as an array of objects: { name: string, date: string, description: string }. 
  Translate everything into Nepali. Date should be in BS (e.g., बैशाख १).`;

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
              date: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ["name", "date", "description"],
          },
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Holidays Fetch Error:", error);
    return [];
  }
};

export const speakText = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `यो नेपाली पाठलाई अत्यन्तै मिठो, प्राकृतिक र सम्मानजनक स्वरमा वाचन गर्नुहोस्। समाचारहरू पढ्दा १, २, ३ नभनीकन धाराप्रवाह रूपमा पढ्नुहोस्: ${text}` }] }],
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
