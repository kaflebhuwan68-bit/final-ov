
import { GoogleGenAI, Type, Modality } from "@google/genai";

export const generateBriefing = async (
  name: string,
  location: { lat: number; lng: number } | null,
  newsSources: string[],
  language: string
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    तपाईंको नाम Briefy हो। हजुरको प्रयोगकर्ताको नाम ${name} हो। 
    
    कृपया ब्रिफिङ यसरी सुरु गर्नुहोस्: "नमस्ते ${name} हजुर, शुभ बिहानी! हजुरलाई धेरै धेरै माया अनि सम्झनाका साथ आजको दिन अत्यन्तै सुखद रहोस् भन्ने कामना गर्दछु।"
    
    ब्रिफिङमा अनिवार्य रूपमा यी कुराहरू समावेश गर्नुहोस्:
    १. आजको नेपाली पात्रो (विक्रम संवत) र आज नेपालमा कुनै "सार्वजनिक बिदा" वा विशेष उत्सव छ कि छैन (Google Search प्रयोग गर्नुहोस्)।
    २. वर्तमान मौसम र तापक्रम (स्थान: ${location ? `अक्षांश ${location.lat}, देशान्तर ${location.lng}` : 'Kathmandu, Nepal'})।
    ३. नेप्से (NEPSE) को पछिल्लो अपडेट।
    ४. ताजा समाचारहरू (${newsSources.join(', ')}) लाई प्राकृतिक रूपमा वाचन गर्नुहोस्।
    ५. एउटा सानो मीठो उत्प्रेरणादायी भनाइ।
    ६. अन्त्यमा: "हजुरलाई थप केहि जान्न मन छ कि म हजुरको लागि भजन बजाउँ?"

    नियमहरू:
    - पूर्ण रूपमा नेपाली र अत्यन्तै आदरार्थी (हजुर) भाषा प्रयोग गर्नुहोस्।
    - विकासकर्ताको नाम "भुवन काफ्ले" अन्तमा सम्मानका साथ लिनुहोस्।
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

export const fetchCurrentWeather = async (location: { lat: number; lng: number } | null) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Provide current weather for ${location ? `lat ${location.lat}, lng ${location.lng}` : 'Kathmandu, Nepal'}. 
  Give a very short summary in one sentence in Nepali (temp and condition).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return { 
      temp: 0, 
      condition: response.text || "मौसमको जानकारी उपलब्ध छैन", 
      city: location ? "हजुरको स्थान" : "नेपाल" 
    };
  } catch (error) {
    console.error("Weather Fetch Error:", error);
    return null;
  }
};

export const fetchNepaliHolidays = async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Search for 3 upcoming major Nepali festivals and public holidays. 
  Return a simple list with dates in Nepali.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return [{ name: "आगामी बिदा/चाडपर्व", date: "हालको", description: response.text || "जानकारी उपलब्ध छैन" }];
  } catch (error) {
    console.error("Holidays Fetch Error:", error);
    return [];
  }
};

export const speakText = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `यो नेपाली ब्रिफिङलाई आत्मीय र स्पष्ट स्वरमा वाचन गर्नुहोस्: ${text}` }] }],
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
