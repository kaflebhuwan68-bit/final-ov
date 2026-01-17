
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from "@google/genai";

export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const playBhajansDeclaration: FunctionDeclaration = {
  name: 'playBhajans',
  parameters: {
    type: Type.OBJECT,
    description: 'Call this function if the user says they do not want to know anything else, or if they specifically ask to play bhajans.',
    properties: {},
  },
};

export const createLiveSession = async (
  onAudioData: (base64: string) => void,
  onInterrupted: () => void,
  onTranscription: (text: string, isUser: boolean) => void,
  onPlayBhajans: () => void
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    callbacks: {
      onopen: () => console.log("Live session opened"),
      onmessage: async (message: LiveServerMessage) => {
        if (message.toolCall) {
          for (const fc of message.toolCall.functionCalls) {
            if (fc.name === 'playBhajans') {
              onPlayBhajans();
              sessionPromise.then(s => s.sendToolResponse({
                functionResponses: { id: fc.id, name: fc.name, response: { result: "ok, playing bhajans" } }
              }));
            }
          }
        }
        if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
          onAudioData(message.serverContent.modelTurn.parts[0].inlineData.data);
        }
        if (message.serverContent?.interrupted) {
          onInterrupted();
        }
        if (message.serverContent?.inputTranscription) {
          onTranscription(message.serverContent.inputTranscription.text, true);
        }
        if (message.serverContent?.outputTranscription) {
          onTranscription(message.serverContent.outputTranscription.text, false);
        }
      },
      onerror: (e) => console.error("Live session error:", e),
      onclose: () => console.log("Live session closed"),
    },
    config: {
      responseModalities: [Modality.AUDIO],
      tools: [{ functionDeclarations: [playBhajansDeclaration] }],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
      systemInstruction: 'हजुर Briefy हुनुहुन्छ। हजुर अत्यन्तै सभ्य र आदरार्थी नेपाली बोल्नुहुन्छ। ब्रिफिङ पछि प्रयोगकर्ताले केहि जान्न चाहेमा उत्तर दिनुहोस्। यदि प्रयोगकर्ताले "केहि पर्दैन", "नाई", "भयो" वा भजन बजाउन भनेमा `playBhajans` फङ्सन कल गर्नुहोस्।',
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  });

  return sessionPromise;
};
