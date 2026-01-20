
import React, { useState, useEffect, useRef } from 'react';
import { generateBriefing, fetchCurrentWeather, speakText, fetchNepaliHolidays, processVoiceCommand } from './services/geminiService';
import { UserSettings, AppView } from './types';
import { 
  Sun, 
  Settings as SettingsIcon, 
  Mic, 
  Home, 
  Settings,
  Play, 
  Youtube,
  User,
  Heart,
  Loader2,
  X,
  Square,
  Volume2,
  Zap,
  Sparkles
} from 'lucide-react';

const LANGUAGES = [
  { code: 'ne', name: 'नेपाली', label: 'Nepali' },
  { code: 'en', name: 'English', label: 'English' },
  { code: 'hi', name: 'हिन्दी', label: 'Hindi' },
  { code: 'bho', name: 'भोजपुरी', label: 'Bhojpuri' },
  { code: 'new', name: 'नेपाल भाषा', label: 'Nepal Bhasa' },
] as const;

const TRANSLATIONS: Record<string, any> = {
  ne: { tagline: 'हजुरको सेवामा तत्पर', settings: 'सेटिङहरू', yourName: 'हजुरको शुभ नाम', namePlaceholder: 'नाम लेख्नुहोस्...', language: 'भाषा', appTheme: 'एप थिम', newsSources: 'समाचार स्रोत व्यवस्थापन', saveSettings: 'सुरक्षित गर्नुहोस्', startBriefing: 'ब्रिफिङ सुन्नुहोस्', speaking: 'सुनाउँदैछु...', listening: 'भन्नुहोस्, म सुन्दैछु...', thinking: 'सोच्दैछु...', stop: 'रोक्नुहोस्', home: 'गृह', profile: 'प्रोफाइल', autoListen: 'स्वचालित सुन्ने (Auto-Listen)', autoStart: 'सुरु गर्दा स्वतः ब्रिफिङ', loadingMsgs: ["खोज्दैछौँ...", "संकलन गर्दैछौँ...", "तयार पार्दैछौँ..."], preparing: "हजुरको ब्रिफिङ तयार हुँदैछ..." },
  en: { tagline: 'At your service', settings: 'Settings', yourName: 'Your Name', namePlaceholder: 'Enter name...', language: 'Language', appTheme: 'App Theme', newsSources: 'News Sources', saveSettings: 'Save Settings', startBriefing: 'Start Briefing', speaking: 'Speaking...', listening: 'I am listening...', thinking: 'Thinking...', stop: 'Stop', home: 'Home', profile: 'Profile', autoListen: 'Auto-Listening Mode', autoStart: 'Auto-Start Briefing', loadingMsgs: ["Fetching...", "Gathering...", "Crafting..."], preparing: "Preparing your briefing..." }
};

export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [settings, setSettings] = useState<UserSettings>({
    name: 'User',
    language: 'ne',
    newsSources: ['OnlineKhabar', 'Setopati'],
    autoPlayAudio: true,
    theme: 'system',
    autoListen: true,
    autoStartBriefing: false,
  });
  const [loading, setLoading] = useState(false);
  const [isAutoStarting, setIsAutoStarting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentWeather, setCurrentWeather] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcriptions, setTranscriptions] = useState<{ text: string, isUser: boolean }[]>([]);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const viewRef = useRef<AppView>(view);
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const t = TRANSLATIONS[settings.language] || TRANSLATIONS.ne;

  // Load settings and check for Shortcut trigger
  useEffect(() => {
    const saved = localStorage.getItem('briefy_settings');
    let currentSettings = settings;
    if (saved) {
      const parsed = JSON.parse(saved);
      currentSettings = { ...settings, ...parsed };
      setSettings(currentSettings);
    }

    const params = new URLSearchParams(window.location.search);
    const urlAutoStart = params.get('autostart') === 'true';

    if ((urlAutoStart || currentSettings.autoStartBriefing) && !hasAutoStarted.current) {
      setIsAutoStarting(true);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          console.warn("Location denied", err);
          // Fallback to Kathmandu for weather if location is denied
          setLocation({ lat: 27.7172, lng: 85.3240 });
        }
      );
    } else {
      setLocation({ lat: 27.7172, lng: 85.3240 });
    }
  }, []);

  useEffect(() => {
    if (location) {
      fetchCurrentWeather(location, settings.language).then(setCurrentWeather);
    }
  }, [location, settings.language]);

  const initAudioCtx = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
      audioSourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const playAudio = async (base64: string) => {
    stopAudio();
    const ctx = await initAudioCtx();
    const audioData = decode(base64);
    
    const dataInt16 = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 2);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    source.onended = () => {
      setIsPlaying(false);
      if (viewRef.current === AppView.VOICE && settings.autoListen) {
        startRecording();
      }
    };
    
    audioSourceRef.current = source;
    source.start();
    setIsPlaying(true);
  };

  const startRecording = async () => {
    stopAudio();
    await initAudioCtx();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setLoading(true);
          const responseText = await processVoiceCommand(base64, settings.language, mimeType);
          setTranscriptions(prev => [...prev, { text: responseText, isUser: false }]);
          const audio = await speakText(responseText, settings.language);
          if (audio) await playAudio(audio);
          setLoading(false);
        };
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
      setView(AppView.VOICE);
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleGenerateBriefing = async () => {
    if (hasAutoStarted.current && isAutoStarting) return;
    setLoading(true);
    setIsAutoStarting(false);
    hasAutoStarted.current = true;
    stopAudio();
    await initAudioCtx();
    try {
      const result = await generateBriefing(settings.name, location, settings.newsSources, settings.language);
      const audio = await speakText(result.text, settings.language);
      if (audio) await playAudio(audio);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl transition-colors duration-500 pb-[env(safe-area-inset-bottom)]">
      {/* Shortcut Auto-Start Splash Overlay */}
      {isAutoStarting && (
        <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl animate-bounce">
            <Sparkles className="text-white" size={40} />
          </div>
          <h2 className="text-white text-2xl font-black mb-4 tracking-tighter italic">Briefy</h2>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-12 animate-pulse">{t.preparing}</p>
          <button 
            onClick={handleGenerateBriefing}
            className="w-full py-6 bg-white text-slate-900 rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-2xl"
          >
            <Play size={20} fill="currentColor" /> Tap to Start
          </button>
          <button onClick={() => setIsAutoStarting(false)} className="mt-8 text-slate-500 text-xs font-bold uppercase tracking-widest underline decoration-2 underline-offset-4">Cancel</button>
        </div>
      )}

      <header className="p-6 pt-12 pb-4 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 safe-pt">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic">Briefy</h1>
        <button onClick={() => setView(view === AppView.SETTINGS ? AppView.DASHBOARD : AppView.SETTINGS)} className="p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 active:scale-90 transition-transform">
          {view === AppView.SETTINGS ? <X size={20} /> : <SettingsIcon size={20} />}
        </button>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-y-auto pb-32">
        {view === AppView.SETTINGS ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
               <span className="text-[10px] font-black uppercase text-slate-400 block mb-2">{t.yourName}</span>
               <input type="text" className="w-full text-lg font-bold bg-transparent outline-none dark:text-white" value={settings.name} onChange={(e) => setSettings({...settings, name: e.target.value})} />
             </div>
             
             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
               <span className="text-[10px] font-black uppercase text-slate-400 block mb-2">{t.language}</span>
               <select className="w-full text-lg font-bold bg-transparent outline-none dark:text-white" value={settings.language} onChange={(e) => setSettings({...settings, language: e.target.value as any})}>
                 {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name} ({l.label})</option>)}
               </select>
             </div>

             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Mic size={18} className="text-blue-500" />
                 <span className="text-sm font-bold dark:text-white">{t.autoListen}</span>
               </div>
               <button onClick={() => setSettings({...settings, autoListen: !settings.autoListen})} className={`w-12 h-6 rounded-full transition-colors relative ${settings.autoListen ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.autoListen ? 'left-7' : 'left-1'}`} />
               </button>
             </div>

             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Zap size={18} className="text-yellow-500" />
                 <span className="text-sm font-bold dark:text-white">{t.autoStart}</span>
               </div>
               <button onClick={() => setSettings({...settings, autoStartBriefing: !settings.autoStartBriefing})} className={`w-12 h-6 rounded-full transition-colors relative ${settings.autoStartBriefing ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.autoStartBriefing ? 'left-7' : 'left-1'}`} />
               </button>
             </div>

             <button onClick={() => { localStorage.setItem('briefy_settings', JSON.stringify(settings)); setView(AppView.DASHBOARD); }} className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-transform">{t.saveSettings}</button>
          </div>
        ) : view === AppView.VOICE ? (
          <div className="flex flex-col h-full space-y-4">
            <div className="flex-1 overflow-y-auto space-y-4 min-h-[400px] pb-10">
              {transcriptions.map((tr, i) => (
                <div key={i} className={`flex ${tr.isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-bold shadow-sm ${tr.isUser ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 dark:text-white border border-slate-100 dark:border-slate-800'}`}>{tr.text}</div>
                </div>
              ))}
              {isRecording && (
                <div className="flex flex-col items-center justify-center space-y-4 py-20">
                  <div className="relative w-24 h-24 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full flex items-center justify-center border-4 border-blue-100 dark:border-blue-900/50 animate-pulse shadow-lg"><Mic size={48} /></div>
                  <p className="text-xs font-black uppercase tracking-widest text-blue-600">{t.listening}</p>
                </div>
              )}
              {isPlaying && (
                <div className="flex flex-col items-center justify-center space-y-4 py-10 opacity-60">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => <div key={i} className="w-1 bg-blue-500 rounded-full animate-bounce" style={{ height: `${20 + i * 4}px`, animationDelay: `${i * 0.1}s` }}></div>)}
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest">{t.speaking}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setView(AppView.DASHBOARD)} className="py-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-sm active:scale-95 transition-transform dark:text-white">Exit</button>
              <button onClick={isRecording ? stopRecording : () => setTranscriptions([])} className={`py-5 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-transform ${isRecording ? 'bg-red-500' : 'bg-slate-900 dark:bg-white dark:text-slate-900'}`}>
                {isRecording ? t.stop : "Clear Chat"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm flex items-center gap-4">
               <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-yellow-500"><Sun /></div>
               <div>
                 <div className="text-xs font-black text-slate-400 uppercase tracking-widest">{currentWeather?.city || "Locating..."}</div>
                 <div className="text-3xl font-black dark:text-white">{currentWeather?.temp || "--"}°C</div>
               </div>
            </div>

            <div className="bg-slate-900 dark:bg-blue-950 rounded-[3rem] p-8 text-white shadow-2xl min-h-[280px] flex flex-col justify-between border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
              <div className="space-y-4 relative z-10">
                <Heart size={20} className="text-blue-400 fill-blue-400" />
                <h3 className="text-4xl font-black leading-tight tracking-tighter">Namaste, {settings.name}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ready for your briefing?</p>
              </div>
              <button onClick={handleGenerateBriefing} disabled={loading} className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-2xl relative z-10 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" /> : <><Play size={20} fill="currentColor" /> {t.startBriefing}</>}
              </button>
            </div>

            {isPlaying && (
              <button onClick={stopAudio} className="w-full py-5 bg-white dark:bg-slate-900 border-2 border-blue-500/30 text-blue-600 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                <Volume2 size={18} /> {t.speaking} - {t.stop}
              </button>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => window.open('https://youtube.com', '_blank')} className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3 active:scale-95 transition-transform text-red-600">
                <Youtube />
                <span className="text-[10px] font-black uppercase tracking-widest dark:text-white">YouTube</span>
              </button>
              <button onClick={() => setView(AppView.SETTINGS)} className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3 active:scale-95 transition-transform text-slate-500">
                <Settings />
                <span className="text-[10px] font-black uppercase tracking-widest dark:text-white">{t.settings}</span>
              </button>
            </div>
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto safe-pb ios-glass dark:bg-slate-900/80 flex justify-around items-center px-10 border-t border-slate-100 dark:border-slate-800 z-20">
        <button onClick={() => setView(AppView.DASHBOARD)} className={`p-2 transition-colors ${view === AppView.DASHBOARD ? 'text-blue-600' : 'text-slate-300'}`}><Home size={28} /></button>
        <button 
          onClick={() => isRecording ? stopRecording() : startRecording()} 
          className={`-top-10 relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl border-[6px] border-white dark:border-slate-950 transition-all active:scale-90 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'}`}
        >
          <Mic size={32} />
        </button>
        <button onClick={() => setView(AppView.SETTINGS)} className={`p-2 transition-colors ${view === AppView.SETTINGS ? 'text-blue-600' : 'text-slate-300'}`}><User size={28} /></button>
      </nav>
    </div>
  );
};

export default App;
