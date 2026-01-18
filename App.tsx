
import React, { useState, useEffect, useRef } from 'react';
import { generateBriefing, fetchCurrentWeather, speakText, fetchNepaliHolidays } from './services/geminiService';
import { createLiveSession, encode, decode, decodeAudioData } from './services/liveService';
import { UserSettings, AppView } from './types';
import { 
  Sun, 
  Cloud,
  CloudRain,
  Settings as SettingsIcon, 
  Mic, 
  Home, 
  Music, 
  Play, 
  Youtube,
  User,
  Heart,
  MapPin,
  Loader2,
  Waves,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  X,
  Calendar,
  Languages,
  Sparkles,
  Wind,
  Droplets,
  Thermometer,
  Moon,
  Monitor,
  Info,
  Clock
} from 'lucide-react';

const LANGUAGES = [
  { code: 'ne', name: 'नेपाली', label: 'Nepali' },
  { code: 'en', name: 'English', label: 'English' },
  { code: 'hi', name: 'हिन्दी', label: 'Hindi' },
  { code: 'bho', name: 'भोजपुरी', label: 'Bhojpuri' },
  { code: 'new', name: 'नेपाल भाषा', label: 'Nepal Bhasa' },
] as const;

const THEMES = [
  { id: 'day', icon: Sun, label_en: 'Day', label_ne: 'दिन' },
  { id: 'night', icon: Moon, label_en: 'Night', label_ne: 'रात' },
  { id: 'system', icon: Monitor, label_en: 'System', label_ne: 'प्रणाली' },
] as const;

const TRANSLATIONS: Record<string, any> = {
  ne: {
    tagline: 'हजुरको सेवामा तत्पर',
    settings: 'सेटिङहरू',
    yourName: 'हजुरको शुभ नाम',
    namePlaceholder: 'नाम लेख्नुहोस्...',
    language: 'भाषा',
    appTheme: 'एप थिम',
    newsSources: 'समाचार स्रोत व्यवस्थापन',
    newSourcePlaceholder: 'नयाँ स्रोत...',
    saveSettings: 'सुरक्षित गर्नुहोस्',
    stopListening: 'कुराकानी बन्द गर्नुहोस्',
    locating: 'खोज्दै...',
    syncing: 'अद्यावधिक गर्दै...',
    feelsLike: 'महसुस',
    humidity: 'आद्रता',
    wind: 'हावा',
    goodMorning: 'शुभ प्रभात हजुर!',
    dear: 'आदरणीय',
    briefingDesc: 'बिहानी ब्रिफिङ सुन्नुहोस् र त्यसपछि मलाई केहि सोध्नुहोस्।',
    startBriefing: 'ब्रिफिङ सुन्नुहोस्',
    speaking: 'सुनाउँदैछु...',
    preparingVoice: 'आवाज भर्दैछु...',
    holidays: 'चाडपर्व र बिदाहरू',
    today: 'आज',
    playBhajans: 'भजन बजाउनुहोस्',
    youtube: 'यूट्यूब खोल्नुहोस्',
    home: 'गृह',
    profile: 'प्रोफाइल',
    listening: 'हजुरको कुरा सुन्दैछु...',
    loadingMsgs: ["मौसमको जानकारी लिँदैछौँ...", "नेप्सेको ताजा अपडेट खोज्दैछौँ...", "मुख्य समाचारहरू संकलन गर्दैछौँ...", "हजुरको लागि ब्रिफिङ तयार पार्दैछौँ...", "मीठो आवाज भर्दैछौँ..."]
  },
  en: {
    tagline: 'At your service',
    settings: 'Settings',
    yourName: 'Your Name',
    namePlaceholder: 'Enter name...',
    language: 'Language',
    appTheme: 'App Theme',
    newsSources: 'News Sources',
    newSourcePlaceholder: 'New source...',
    saveSettings: 'Save Settings',
    stopListening: 'Stop Listening',
    locating: 'Locating...',
    syncing: 'Syncing...',
    feelsLike: 'Feels Like',
    humidity: 'Humidity',
    wind: 'Wind',
    goodMorning: 'Good Morning!',
    dear: 'Dear',
    briefingDesc: 'Listen to your morning briefing and ask me anything.',
    startBriefing: 'Start Briefing',
    speaking: 'Speaking...',
    preparingVoice: 'Preparing Voice...',
    holidays: 'Holidays & Events',
    today: 'Today',
    playBhajans: 'Play Bhajans',
    youtube: 'Open YouTube',
    home: 'Home',
    profile: 'Profile',
    listening: 'Listening...',
    loadingMsgs: ["Fetching weather...", "Checking NEPSE...", "Gathering headlines...", "Crafting briefing...", "Polishing audio..."]
  },
  hi: {
    tagline: 'आपकी सेवा में',
    settings: 'सेटिंग्स',
    yourName: 'आपका नाम',
    namePlaceholder: 'नाम दर्ज करें...',
    language: 'भाषा',
    appTheme: 'थीम',
    newsSources: 'समाचार स्रोत',
    newSourcePlaceholder: 'नया स्रोत...',
    saveSettings: 'सेटिंग्स सहेजें',
    stopListening: 'बातचीत बंद करें',
    locating: 'खोज रहे हैं...',
    syncing: 'सिंक हो रहा है...',
    feelsLike: 'महसूस',
    humidity: 'नमी',
    wind: 'हवा',
    goodMorning: 'शुभ प्रभात!',
    dear: 'प्रिय',
    briefingDesc: 'अपना सुबह का ब्रीफिंग सुनें और मुझसे कुछ भी पूछें।',
    startBriefing: 'ब्रीफिंग शुरू करें',
    speaking: 'बोल रहा हूँ...',
    preparingVoice: 'आवाज तैयार हो रही है...',
    holidays: 'त्यौहार और छुट्टियाँ',
    today: 'आज',
    playBhajans: 'भजन बजाएं',
    youtube: 'यूट्यूब खोलें',
    home: 'होम',
    profile: 'प्रोफ़ाइल',
    listening: 'सुन रहा हूँ...',
    loadingMsgs: ["मौसम की जानकारी...", "स्टॉक अपडेट...", "समाचार सुर्खियां...", "ब्रीफिंग तैयार...", "ऑडियो पॉलिश..."]
  },
  bho: {
    tagline: 'रउवा सेवा में',
    settings: 'सेटिंग्स',
    yourName: 'रउवा नाम',
    namePlaceholder: 'नाम लिखीं...',
    language: 'भाषा',
    appTheme: 'थीम',
    newsSources: 'समाचार स्रोत',
    newSourcePlaceholder: 'नया स्रोत...',
    saveSettings: 'सुरक्षित करीं',
    stopListening: 'बातचीत बंद करीं',
    locating: 'खोजत बानी...',
    syncing: 'सिंक हो रहल बा...',
    feelsLike: 'महसूस',
    humidity: 'नमी',
    wind: 'हवा',
    goodMorning: 'शुभ प्रभात!',
    dear: 'प्रिय',
    briefingDesc: 'सुबह के ब्रीफिंग सुनीं अउरी हमरा से कुछुओ पूछीं।',
    startBriefing: 'ब्रीफिंग शुरू करीं',
    speaking: 'बोलत बानी...',
    preparingVoice: 'आवाज तइयार हो रहल बा...',
    holidays: 'तिहुआर अउरी छुट्टी',
    today: 'आजु',
    playBhajans: 'भजन बजाईं',
    youtube: 'यूट्यूब खोलीं',
    home: 'होम',
    profile: 'प्रोफाइल',
    listening: 'सुनत बानी...',
    loadingMsgs: ["मौसम के जानकारी...", "स्टॉक अपडेट...", "खबर के सुर्खियां...", "ब्रीफिंग तइयार...", "ऑडियो पॉलिश..."]
  },
  new: {
    tagline: 'छिगु सेवाय्',
    settings: 'सेटिङत',
    yourName: 'छिगु नां',
    namePlaceholder: 'नां च्वयादिसँ...',
    language: 'भाय्',
    appTheme: 'थिम',
    newsSources: 'बुखँ मुनेगु',
    newSourcePlaceholder: 'न्हूगु बुखँ...',
    saveSettings: 'सुरक्षित याये',
    stopListening: 'खँ ल्हायेगु दिकी',
    locating: 'मालाच्वना...',
    syncing: 'मिले यानाच्वना...',
    feelsLike: 'महसुस',
    humidity: 'फय्‌या च्वापू',
    wind: 'फय्',
    goodMorning: 'भिं सुथ!',
    dear: 'मान्यवर',
    briefingDesc: 'सुथया ब्रिफिङ न्यनादिसँ अले जिथाय् छुं नं न्यनादिसँ।',
    startBriefing: 'ब्रिफिङ न्यने',
    speaking: 'ल्हानाच्वना...',
    preparingVoice: 'सः तयार यानाच्वना...',
    holidays: 'नखः चखः व बिदात',
    today: 'थौं',
    playBhajans: 'भजन थाये',
    youtube: 'यूट्यूब चायेके',
    home: 'छेँ',
    profile: 'प्रोफाइल',
    listening: 'न्यनाच्वना...',
    loadingMsgs: ["मौसमया जानकारी...", "स्टॉक अपडेट...", "बुखँया सुर्खीत...", "ब्रिफिङ तयार...", "सः मिलाच्वना..."]
  }
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [settings, setSettings] = useState<UserSettings>({
    name: 'User',
    language: 'ne',
    newsSources: ['OnlineKhabar', 'Kathmandu Post', 'Setopati'],
    autoPlayAudio: true,
    theme: 'system',
  });
  const [newSource, setNewSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentWeather, setCurrentWeather] = useState<{ 
    temp: number; 
    condition: string; 
    city: string;
    humidity: string;
    windSpeed: string;
    feelsLike: number;
    lastUpdated?: string;
  } | null>(null);
  const [holidays, setHolidays] = useState<{ name: string, date: string, description: string }[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [transcriptions, setTranscriptions] = useState<{ text: string, isUser: boolean }[]>([]);

  const t = TRANSLATIONS[settings.language] || TRANSLATIONS.ne;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Location access denied", err)
      );
    }
    const saved = localStorage.getItem('briefy_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!['ne', 'en', 'hi', 'bho', 'new'].includes(parsed.language)) parsed.language = 'ne';
      if (!['day', 'night', 'system'].includes(parsed.theme)) parsed.theme = 'system';
      setSettings(parsed);
    }
  }, []);

  useEffect(() => {
    fetchNepaliHolidays(settings.language).then(setHolidays).catch(e => console.error("Holidays failed", e));
  }, [settings.language]);

  useEffect(() => {
    if (location) {
      fetchCurrentWeather(location, settings.language).then(w => {
        if (w) setCurrentWeather({ ...w, lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      }).catch(e => console.error("Weather failed", e));
    }
  }, [location, settings.language]);

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (themeId: 'day' | 'night' | 'system') => {
      root.classList.remove('dark');
      if (themeId === 'night') {
        root.classList.add('dark');
      } else if (themeId === 'system') {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        }
      }
    };
    applyTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % 5);
      }, 2500);
    } else {
      setLoadingMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const stopAudio = () => {
    if (ttsSourceRef.current) {
      try { ttsSourceRef.current.stop(); } catch(e) {}
      ttsSourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const playBhajans = () => {
    window.open('https://www.youtube.com/results?search_query=nepali+bhajan+non+stop', '_blank');
    setIsListening(false);
    setView(AppView.DASHBOARD);
  };

  const startVoiceInteraction = async () => {
    if (isListening) return;
    stopAudio();
    setIsListening(true);
    setView(AppView.VOICE);
    setTranscriptions([]);

    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext({ sampleRate: 16000 });
      if (!outputAudioCtxRef.current) outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sessionPromise = createLiveSession(
        async (base64) => {
          if (!outputAudioCtxRef.current) return;
          const ctx = outputAudioCtxRef.current;
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
          const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.onended = () => sourcesRef.current.delete(source);
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
          sourcesRef.current.add(source);
        },
        () => {
          sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
        },
        (text, isUser) => setTranscriptions(prev => [...prev, { text, isUser }]),
        playBhajans
      );

      const session = await sessionPromise;
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      const processor = audioCtxRef.current.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!isListening) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
        session.sendRealtimeInput({
          media: {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000'
          }
        });
      };
      source.connect(processor);
      processor.connect(audioCtxRef.current.destination);
    } catch (err) {
      console.error("Voice interaction error:", err);
      setIsListening(false);
      setView(AppView.DASHBOARD);
    }
  };

  const playBriefingAudio = async (text: string) => {
    if (isPlaying) {
      stopAudio();
      return;
    }

    setAudioLoading(true);
    try {
      const base64 = await speakText(text, settings.language);
      if (base64) {
        if (!outputAudioCtxRef.current) outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
        const ctx = outputAudioCtxRef.current;
        const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
          setIsPlaying(false);
          ttsSourceRef.current = null;
          setTimeout(() => startVoiceInteraction(), 500);
        };
        
        ttsSourceRef.current = source;
        source.start();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error("Audio playback error:", e);
    } finally {
      setAudioLoading(false);
    }
  };

  const handleGenerateBriefing = async () => {
    setLoading(true);
    stopAudio();
    try {
      const result = await generateBriefing(
        settings.name,
        location,
        settings.newsSources,
        settings.language
      );
      await playBriefingAudio(result.text);
    } catch (error) {
      console.error("Briefing error:", error);
      alert(settings.language === 'en' ? "Failed to start briefing." : "ब्रिफिङ सुरु गर्न सकिएन।");
    } finally {
      setLoading(false);
    }
  };

  const addNewsSource = () => {
    if (newSource.trim() && !settings.newsSources.includes(newSource.trim())) {
      setSettings({
        ...settings,
        newsSources: [...settings.newsSources, newSource.trim()]
      });
      setNewSource('');
    }
  };

  const removeNewsSource = (index: number) => {
    const updated = [...settings.newsSources];
    updated.splice(index, 1);
    setSettings({ ...settings, newsSources: updated });
  };

  const moveNewsSource = (index: number, direction: 'up' | 'down') => {
    const updated = [...settings.newsSources];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target >= 0 && target < updated.length) {
      [updated[index], updated[target]] = [updated[target], updated[index]];
      setSettings({ ...settings, newsSources: updated });
    }
  };

  const WeatherIcon = ({ condition }: { condition: string }) => {
    const c = (condition || '').toLowerCase();
    if (c.includes('rain') || c.includes('पानी') || c.includes('बरसात')) return <CloudRain size={36} className="text-blue-400" />;
    if (c.includes('cloud') || c.includes('बादल') || c.includes('मेघ')) return <Cloud size={36} className="text-slate-400 dark:text-slate-500" />;
    return <Sun size={36} className="text-yellow-500" />;
  };

  const getWeatherRecommendation = () => {
    if (!currentWeather) return "";
    const c = currentWeather.condition.toLowerCase();
    
    if (c.includes('rain') || c.includes('पानी') || c.includes('बरसात')) return t.rainAdvice || (settings.language === 'en' ? "Better carry an umbrella." : "छाता बोक्न नभुल्नुहोला।");
    if (currentWeather.temp > 28) return settings.language === 'en' ? "Stay hydrated, it's warm." : "गर्मी छ, पानी प्रशस्त पिउनुहोला।";
    if (currentWeather.temp < 10) return settings.language === 'en' ? "Wear warm clothes." : "न्यानो लुगा लगाउनुहोला।";
    return settings.language === 'en' ? "Great weather for a walk!" : "घुमघामको लागि राम्रो मौसम छ!";
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl border-x border-slate-200 dark:border-slate-800 transition-colors duration-500">
      <header className="p-6 pt-12 pb-4 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic">Briefy</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{t.tagline}</p>
        </div>
        <button 
          onClick={() => setView(view === AppView.SETTINGS ? AppView.DASHBOARD : AppView.SETTINGS)}
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
        >
          {view === AppView.SETTINGS ? <X size={20} /> : <SettingsIcon size={20} />}
        </button>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-y-auto pb-32">
        {view === AppView.SETTINGS ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{t.settings}</h2>
            <div className="space-y-6">
              <label className="block bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 block">{t.yourName}</span>
                <input 
                  type="text" 
                  className="w-full text-lg font-bold text-slate-800 dark:text-white bg-transparent outline-none"
                  value={settings.name}
                  onChange={(e) => setSettings({...settings, name: e.target.value})}
                  placeholder={t.namePlaceholder}
                />
              </label>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Languages size={14} className="text-slate-400 dark:text-slate-500" />
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest block">{t.language}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setSettings({ ...settings, language: lang.code as any })}
                      className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all border ${
                        settings.language === lang.code 
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white shadow-lg' 
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span>{lang.name}</span>
                        <span className="text-[8px] opacity-60 font-black uppercase tracking-tighter">{lang.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor size={14} className="text-slate-400 dark:text-slate-500" />
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest block">{t.appTheme}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.map((theme) => {
                    const Icon = theme.icon;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => setSettings({ ...settings, theme: theme.id })}
                        className={`py-3 px-2 rounded-2xl text-[10px] font-bold transition-all border flex flex-col items-center gap-2 ${
                          settings.theme === theme.id 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg' 
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Icon size={18} />
                        <span>{settings.language === 'en' ? theme.label_en : theme.label_ne}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest block">{t.newsSources}</span>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold outline-none placeholder:font-medium dark:text-white"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    placeholder={t.newSourcePlaceholder}
                    onKeyPress={(e) => e.key === 'Enter' && addNewsSource()}
                  />
                  <button onClick={addNewsSource} className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100 dark:shadow-blue-900/20"><Plus size={20} /></button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {settings.newsSources.map((source, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{source}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveNewsSource(idx, 'up')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"><ChevronUp size={16} /></button>
                        <button onClick={() => moveNewsSource(idx, 'down')} disabled={idx === settings.newsSources.length - 1} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"><ChevronDown size={16} /></button>
                        <button onClick={() => removeNewsSource(idx)} className="p-1 text-slate-400 hover:text-red-500 ml-1"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <button 
                onClick={() => { localStorage.setItem('briefy_settings', JSON.stringify(settings)); setView(AppView.DASHBOARD); }}
                className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all"
              >
                {t.saveSettings}
              </button>
            </div>
          </div>
        ) : view === AppView.VOICE ? (
          <div className="flex flex-col h-full space-y-4 pt-4 animate-in zoom-in-95 duration-300">
             <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-[400px]">
                {transcriptions.map((tr, i) => (
                  <div key={i} className={`flex ${tr.isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-bold shadow-sm ${tr.isUser ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white rounded-tl-none'}`}>
                      {tr.text}
                    </div>
                  </div>
                ))}
                {transcriptions.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 space-y-6 opacity-60">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center animate-pulse border-4 border-white dark:border-slate-800 shadow-xl"><Mic size={40} /></div>
                    <p className="text-xs font-black uppercase tracking-[0.2em]">{t.listening}</p>
                  </div>
                )}
             </div>
             <button onClick={() => { setIsListening(false); setView(AppView.DASHBOARD); }} className="w-full py-5 bg-red-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">
              {t.stopListening}
             </button>
          </div>
        ) : (
          <>
            <div className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm flex flex-col gap-6 transition-all duration-500 ${!currentWeather ? 'animate-pulse' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-50 dark:border-slate-700 relative shadow-inner">
                    {!currentWeather && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 dark:via-slate-700/50 to-transparent animate-shimmer" />}
                    {currentWeather ? <WeatherIcon condition={currentWeather.condition} /> : <Sun size={24} className="text-slate-300 dark:text-slate-600 animate-spin-slow" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-1">
                      <MapPin size={10} /> {currentWeather?.city || t.locating}
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                      {currentWeather ? `${currentWeather.temp}°C` : '--°C'}
                    </div>
                  </div>
                </div>
                {currentWeather && (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                      {currentWeather.condition}
                    </span>
                    <div className="flex items-center gap-1 text-slate-400 text-[8px] font-bold">
                      <Clock size={8} /> {currentWeather.lastUpdated}
                    </div>
                  </div>
                )}
              </div>

              {currentWeather && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100/50 dark:border-slate-700/30">
                    <div className="flex flex-col items-center gap-1.5 group">
                      <Thermometer size={16} className="text-orange-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{t.feelsLike}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{currentWeather.feelsLike}°C</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 group border-x border-slate-200 dark:border-slate-700/50">
                      <Droplets size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{t.humidity}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{currentWeather.humidity}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 group">
                      <Wind size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{t.wind}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{currentWeather.windSpeed}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-2 py-1">
                    <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 dark:shadow-blue-900/20"><Info size={14} /></div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 italic">{getWeatherRecommendation()}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-900 dark:bg-blue-950 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden min-h-[320px] flex flex-col justify-between border border-slate-800 dark:border-blue-900/50">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center"><Heart size={14} className="text-blue-400 animate-pulse fill-blue-400" /></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">{t.dear} {settings.name}</span>
                </div>
                <h3 className="text-4xl font-black mb-4 leading-tight tracking-tighter">{t.goodMorning}</h3>
                <p className="text-slate-400 dark:text-blue-300 text-[10px] font-black leading-relaxed max-w-[85%] uppercase tracking-widest opacity-80">{t.briefingDesc}</p>
              </div>
              <div className="relative z-10 space-y-4">
                {loading && (
                  <div className="flex items-center gap-2 justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Sparkles size={14} className="text-blue-400 animate-bounce" />
                    <span className="text-[9px] font-black text-blue-400 dark:text-blue-300 uppercase tracking-[0.2em]">{t.loadingMsgs[loadingMessageIndex]}</span>
                  </div>
                )}
                <button 
                  onClick={handleGenerateBriefing} disabled={loading || isPlaying || audioLoading}
                  className="w-full py-6 bg-blue-600 dark:bg-blue-50 text-white dark:text-blue-900 rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 shadow-2xl shadow-blue-900/50 relative overflow-hidden"
                >
                  {loading ? <Loader2 size={24} className="animate-spin" /> : isPlaying ? <><Waves size={24} className="animate-bounce" />{t.speaking}</> : audioLoading ? <><Loader2 size={24} className="animate-spin" />{t.preparingVoice}</> : <><Play size={22} fill="currentColor" />{t.startBriefing}</>}
                </button>
              </div>
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] animate-pulse"></div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Calendar size={16} className="text-blue-600" />
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.holidays}</span>
              </div>
              <div className="space-y-3">
                {holidays.length > 0 ? (
                  holidays.map((h, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl group transition-colors animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${i * 150}ms` }}>
                      <div className="flex-shrink-0 w-10 h-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center font-black text-[10px] text-blue-600 dark:text-blue-400 border border-slate-100 dark:border-slate-600 shadow-sm">{t.today}</div>
                      <div className="flex-1">
                        <div className="text-xs font-black text-slate-800 dark:text-white">{h.name}</div>
                        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 line-clamp-2 uppercase tracking-wide">{h.description}</div>
                      </div>
                    </div>
                  ))
                ) : <div className="p-3 animate-pulse bg-slate-50/50 dark:bg-slate-800/50 h-16 rounded-2xl" />}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={playBhajans} className="flex flex-col gap-4 p-6 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-all group text-left">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform"><Music size={24} /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{t.playBhajans}</span>
              </button>
              <button onClick={() => window.open('https://youtube.com', '_blank')} className="flex flex-col gap-4 p-6 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-all group text-left">
                <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform"><Youtube size={24} /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{t.youtube}</span>
              </button>
            </div>
            <div className="pt-10 pb-6 opacity-30 text-center">
               <div className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-[0.4em] mb-1">Created By</div>
               <div className="text-[11px] font-black text-slate-900 dark:text-white tracking-tight">BHUWAN KAFLE</div>
            </div>
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-24 ios-glass dark:bg-slate-900/80 flex justify-around items-center px-10 border-t border-slate-100 dark:border-slate-800 z-20">
        <button onClick={() => setView(AppView.DASHBOARD)} className={`flex flex-col items-center gap-1 ${view === AppView.DASHBOARD ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}>
          <Home size={26} strokeWidth={3} /><span className="text-[9px] font-black uppercase tracking-widest">{t.home}</span>
        </button>
        <div className="relative -top-10">
          <button onClick={startVoiceInteraction} className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-900 dark:bg-white'} text-white dark:text-slate-900 border-[6px] border-white dark:border-slate-950`}><Mic size={34} /></button>
        </div>
        <button onClick={() => setView(AppView.SETTINGS)} className={`flex flex-col items-center gap-1 ${view === AppView.SETTINGS ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}>
          <User size={26} strokeWidth={3} /><span className="text-[9px] font-black uppercase tracking-widest">{t.profile}</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
