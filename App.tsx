
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
  Volume2,
  VolumeX,
  Loader2,
  Waves,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  X,
  Calendar
} from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [settings, setSettings] = useState<UserSettings>({
    name: 'User',
    language: 'ne',
    newsSources: ['OnlineKhabar', 'Kathmandu Post', 'Setopati'],
    autoPlayAudio: true,
  });
  const [newSource, setNewSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentWeather, setCurrentWeather] = useState<{ temp: number; condition: string; city: string } | null>(null);
  const [holidays, setHolidays] = useState<{ name: string, date: string, description: string }[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [transcriptions, setTranscriptions] = useState<{ text: string, isUser: boolean }[]>([]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Location access denied", err)
      );
    }
    const saved = localStorage.getItem('briefy_settings');
    if (saved) setSettings(JSON.parse(saved));

    fetchNepaliHolidays().then(setHolidays).catch(e => console.error("Holidays failed", e));
  }, []);

  useEffect(() => {
    if (location) {
      fetchCurrentWeather(location).then(w => w && setCurrentWeather(w)).catch(e => console.error("Weather failed", e));
    }
  }, [location]);

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
      const base64 = await speakText(text);
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
      alert("माफ गर्नुहोस्, ब्रिफिङ सुरु गर्न सकिएन। कृपया इन्टरनेट जडान वा API कुञ्जी जाँच गर्नुहोस्।");
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
    if (c.includes('rain') || c.includes('पानी')) return <CloudRain size={24} className="text-blue-400" />;
    if (c.includes('cloud') || c.includes('बादल')) return <Cloud size={24} className="text-slate-400" />;
    return <Sun size={24} className="text-yellow-500" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl border-x border-slate-200">
      <header className="p-6 pt-12 pb-4 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic">Briefy</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">हजुरको सेवामा तत्पर</p>
        </div>
        <button 
          onClick={() => setView(view === AppView.SETTINGS ? AppView.DASHBOARD : AppView.SETTINGS)}
          className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-50 transition-all"
        >
          {view === AppView.SETTINGS ? <X size={20} /> : <SettingsIcon size={20} />}
        </button>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-y-auto pb-32">
        {view === AppView.SETTINGS ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">सेटिङहरू</h2>
            <div className="space-y-6">
              <label className="block bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 block">हजुरको शुभ नाम</span>
                <input 
                  type="text" 
                  className="w-full text-lg font-bold text-slate-800 outline-none"
                  value={settings.name}
                  onChange={(e) => setSettings({...settings, name: e.target.value})}
                  placeholder="नाम लेख्नुहोस्..."
                />
              </label>

              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block">समाचार स्रोत व्यवस्थापन</span>
                
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold outline-none placeholder:font-medium"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    placeholder="नयाँ स्रोत (उदा. OnlineKhabar)"
                    onKeyPress={(e) => e.key === 'Enter' && addNewsSource()}
                  />
                  <button 
                    onClick={addNewsSource}
                    className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {settings.newsSources.map((source, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <span className="text-sm font-bold text-slate-700">{source}</span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => moveNewsSource(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button 
                          onClick={() => moveNewsSource(idx, 'down')}
                          disabled={idx === settings.newsSources.length - 1}
                          className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button 
                          onClick={() => removeNewsSource(idx)}
                          className="p-1 text-slate-400 hover:text-red-500 ml-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {settings.newsSources.length === 0 && (
                    <p className="text-[10px] text-center text-slate-400 font-bold uppercase py-4">कुनै स्रोतहरू छैनन्</p>
                  )}
                </div>
              </div>
              
              <button 
                onClick={() => {
                  localStorage.setItem('briefy_settings', JSON.stringify(settings));
                  setView(AppView.DASHBOARD);
                }}
                className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all"
              >
                सुरक्षित गर्नुहोस्
              </button>
            </div>
          </div>
        ) : view === AppView.VOICE ? (
          <div className="flex flex-col h-full space-y-4 pt-4 animate-in zoom-in-95 duration-300">
             <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-[400px]">
                {transcriptions.map((t, i) => (
                  <div key={i} className={`flex ${t.isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-bold shadow-sm ${t.isUser ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                      {t.text}
                    </div>
                  </div>
                ))}
                {transcriptions.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-6 opacity-60">
                    <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center animate-pulse border-4 border-white shadow-xl">
                      <Mic size={40} />
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.2em]">हजुरको कुरा सुन्दैछु...</p>
                  </div>
                )}
             </div>
             <button 
              onClick={() => { setIsListening(false); setView(AppView.DASHBOARD); }}
              className="w-full py-5 bg-red-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all"
            >
              कुराकानी बन्द गर्नुहोस्
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-50">
                  {currentWeather ? <WeatherIcon condition={currentWeather.condition} /> : <Sun size={24} className="text-yellow-400 animate-spin-slow" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                    <MapPin size={10} /> {currentWeather?.city || 'खोज्दै...'}
                  </div>
                  <div className="text-sm font-bold text-slate-900 tracking-tight line-clamp-2">
                    {currentWeather ? currentWeather.condition : 'जानकारी लिदैछु...'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden min-h-[320px] flex flex-col justify-between border border-slate-800">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Heart size={14} className="text-blue-400 animate-pulse fill-blue-400" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">आदरणीय {settings.name}</span>
                </div>
                <h3 className="text-4xl font-black mb-4 leading-tight tracking-tighter">शुभ प्रभात हजुर!</h3>
                <p className="text-slate-400 text-[10px] font-black leading-relaxed max-w-[85%] uppercase tracking-widest opacity-80">
                  बिहानी ब्रिफिङ सुन्नुहोस् र त्यसपछि मलाई केहि सोध्नुहोस्।
                </p>
              </div>
              
              <div className="relative z-10">
                <button 
                  onClick={handleGenerateBriefing}
                  disabled={loading || isPlaying || audioLoading}
                  className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50 shadow-2xl shadow-blue-900/50"
                >
                  {loading ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : isPlaying ? (
                    <>
                      <Waves size={24} className="animate-bounce" />
                      सुनाउँदैछु...
                    </>
                  ) : audioLoading ? (
                    <>
                      <Loader2 size={24} className="animate-spin" />
                      तयार पार्दैछु...
                    </>
                  ) : (
                    <>
                      <Play size={22} fill="currentColor" />
                      ब्रिफिङ सुन्नुहोस्
                    </>
                  )}
                </button>
              </div>

              <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px]"></div>
              <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-[80px]"></div>
            </div>

            {holidays.length > 0 && (
              <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Calendar size={16} className="text-blue-600" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">चाडपर्व र बिदाहरू</span>
                </div>
                <div className="space-y-3">
                  {holidays.map((h, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl group hover:bg-blue-50/50 transition-colors">
                      <div className="flex-shrink-0 w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-[10px] text-blue-600 border border-slate-100 shadow-sm">
                        {h.date.split(' ')[0] || 'आज'}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-black text-slate-800">{h.name}</div>
                        <div className="text-[9px] font-bold text-slate-400 line-clamp-2 uppercase tracking-wide">{h.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button onClick={playBhajans} className="flex flex-col gap-4 p-6 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm hover:border-emerald-100 transition-all group text-left">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Music size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">भजन बजाउनुहोस्</span>
              </button>
              <button onClick={() => window.open('https://youtube.com', '_blank')} className="flex flex-col gap-4 p-6 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm hover:border-red-100 transition-all group text-left">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Youtube size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">यूट्यूब खोल्नुहोस्</span>
              </button>
            </div>

            <div className="pt-10 pb-6 opacity-30 text-center">
               <div className="text-[9px] font-black text-slate-900 uppercase tracking-[0.4em] mb-1">Created By</div>
               <div className="text-[11px] font-black text-slate-900 tracking-tight">BHUWAN KAFLE</div>
               <div className="text-[8px] text-slate-500 font-bold lowercase tracking-wider">kaflebhuwan68@gmail.com</div>
            </div>
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-24 ios-glass flex justify-around items-center px-10 border-t border-slate-100 z-20">
        <button 
          onClick={() => setView(AppView.DASHBOARD)}
          className={`flex flex-col items-center gap-1 transition-all ${view === AppView.DASHBOARD ? 'text-blue-600' : 'text-slate-300'}`}
        >
          <Home size={26} strokeWidth={3} />
          <span className="text-[9px] font-black uppercase tracking-widest">गृह</span>
        </button>
        <div className="relative -top-10">
          <button 
            onClick={startVoiceInteraction}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all ${isListening ? 'bg-red-500 scale-110 shadow-red-200' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-300'} text-white border-[6px] border-white`}
          >
            <Mic size={34} />
          </button>
        </div>
        <button 
          onClick={() => setView(AppView.SETTINGS)}
          className={`flex flex-col items-center gap-1 transition-all ${view === AppView.SETTINGS ? 'text-blue-600' : 'text-slate-300'}`}
        >
          <User size={26} strokeWidth={3} />
          <span className="text-[9px] font-black uppercase tracking-widest">प्रोफाइल</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
