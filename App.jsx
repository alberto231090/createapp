
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { 
  Mail, Settings, Play, History, User, ShieldAlert, Volume2, VolumeX, 
  RotateCcw, ArrowRight, Send, Sparkles, Baby, ChevronUp, ChevronDown, 
  BrainCircuit, Lightbulb, Cpu, Zap, Target, Activity, Maximize2, 
  DownloadCloud, CheckCircle2, Image as ImageIcon, Loader2, Menu, X,
  MessageCircle, FileText, Mic, Eye, Cloud, Scale, Waves, Box,
  ZapOff, Activity as ActivityIcon, Gauge
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, query, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';

// --- CONFIGURAZIONE ---
const apiKey = ""; 
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const IMAGEN_MODEL = "imagen-4.0-generate-001";
const appId = typeof __app_id !== 'undefined' ? __app_id : 'city-babysitter-v8';
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- UTILITY AUDIO ---
const pcmToWav = (pcmData, sampleRate) => {
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);
  const writeString = (o, s) => { for (let i=0; i<s.length; i++) view.setUint8(o+i, s.charCodeAt(i)); };
  writeString(0, 'RIFF'); view.setUint32(4, 32 + pcmData.length, true); writeString(8, 'WAVE'); writeString(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeString(36, 'data'); view.setUint32(40, pcmData.length, true);
  const pcmItems = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);
  for (let i=0; i<pcmItems.length; i++) view.setInt16(44 + i * 2, pcmItems[i], true);
  return new Blob([buffer], { type: 'audio/wav' });
};

// --- UTILITY AI ---
const callGemini = async (prompt, systemInstruction, isJson = false, retries = 0) => {
  const payload = { 
    contents: [{ parts: [{ text: prompt }] }], 
    systemInstruction: { parts: [{ text: systemInstruction }] }, 
    generationConfig: isJson ? { responseMimeType: "application/json" } : {} 
  };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    const txt = await res.text();
    if (!res.ok) { 
      if (retries < 3) { await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000)); return callGemini(prompt, systemInstruction, isJson, retries+1); } 
      return ""; 
    }
    const data = JSON.parse(txt);
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (isJson) {
        try {
            const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch(e) { return { error: true }; }
    }
    return content;
  } catch (e) { return ""; }
};

const callImagen = async (promptText) => {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${apiKey}`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ instances: [{ prompt: promptText }], parameters: { sampleCount: 1 } }) 
    });
    const txt = await res.text();
    if (!res.ok) return null;
    const result = JSON.parse(txt);
    if (result.predictions?.[0]?.bytesBase64Encoded) return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
  } catch (e) { console.error(e); }
  return null;
};

const callGeminiTTS = async (text, voiceName = "Zephyr") => {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        contents: [{ parts: [{ text }] }], 
        generationConfig: { 
          responseModalities: ["AUDIO"], 
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } 
        } 
      }) 
    });
    const txt = await res.text();
    if (!res.ok) return null;
    const data = JSON.parse(txt);
    const part = data.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData) {
      const pcm = atob(part.inlineData.data);
      const arr = new Uint8Array(pcm.length);
      for(let i=0; i<pcm.length; i++) arr[i] = pcm.charCodeAt(i);
      return pcmToWav(arr, 24000);
    }
  } catch (e) { return null; }
  return null;
};

// --- STILI ---
const TECH_FRAME = "bg-neutral-900/90 backdrop-blur-lg border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] relative overflow-hidden";
const TECH_BORDER = "before:absolute before:top-0 before:left-0 before:w-3 before:h-3 before:border-t-2 before:border-l-2 before:border-cyan-400 after:absolute after:bottom-0 after:right-0 after:w-3 after:h-3 after:border-b-2 after:border-r-2 after:border-cyan-400";
const BUTTON_TECH = "bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-400 font-mono text-[11px] md:text-[12px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-30 p-3 md:p-4 rounded";
const BUTTON_ACTION = "bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest transition-all shadow-[0_0_25px_rgba(245,158,11,0.4)] touch-manipulation p-4 md:p-6";

export default function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState('splash');
  const [selectedChild, setSelectedChild] = useState(null);
  const [redness, setRedness] = useState(0);
  const [config, setConfig] = useState({ location: 'ufficio', room: 'letto', mode: 'solo' });
  const [email, setEmail] = useState("");
  const [report, setReport] = useState("");
  const [tapCount, setTapCount] = useState(0);
  const [spankPos, setSpankPos] = useState('otk');
  const [power, setPower] = useState(50);
  const [bubbles, setBubbles] = useState({ sitter: "", child: "", thought: "" });
  const [isGeneratingAvatars, setIsGeneratingAvatars] = useState(false);
  const [childAvatar, setChildAvatar] = useState(null);
  const [sitterAvatar, setSitterAvatar] = useState(null);
  const [dialogueBuffer, setDialogueBuffer] = useState([]);
  const [isPreloading, setIsPreloading] = useState(false);
  const [isGeneratingExcuse, setIsGeneratingExcuse] = useState(false);
  const [psychAnalysis, setPsychAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingCase, setIsGeneratingCase] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [tacticalAdvice, setTacticalAdvice] = useState("");
  const [isGettingAdvice, setIsGettingAdvice] = useState(false);
  const [isGettingThought, setIsGettingThought] = useState(false);
  const [ambientLog, setAmbientLog] = useState("");
  const [isGeneratingAmbient, setIsGeneratingAmbient] = useState(false);
  const [coherenceScore, setCoherenceScore] = useState(null);
  const [isAnalyzingCoherence, setIsAnalyzingCoherence] = useState(false);

  // --- FLOW STATE ---
  const [flow, setFlow] = useState(0);
  const [isFlowActive, setIsFlowActive] = useState(false);
  const lastSpankTime = useRef(0);

  useEffect(() => {
    const initAuth = async () => { if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token); else await signInAnonymously(auth); };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (flow >= 100) {
        setIsFlowActive(true);
    } else if (flow <= 0) {
        setIsFlowActive(false);
    }
  }, [flow]);

  // Decadimento naturale del Flow
  useEffect(() => {
      const interval = setInterval(() => {
          setFlow(prev => Math.max(0, prev - (isFlowActive ? 2 : 1)));
      }, 500);
      return () => clearInterval(interval);
  }, [isFlowActive]);

  const defaultChildren = useMemo(() => [
    { 
      name: "Luca", age: 10, crime: "Ha rotto il vaso antico.", consistency: "sodo",
      visuals: { hair: "#8B4513", skin: "#eac086", shirtColor: "#1a237e", pantsColor: "#F5F5DC", desc: "brown messy hair, wearing a navy blue t-shirt" }
    },
    { 
      name: "Marco", age: 6, crime: "Ha disegnato sul muro.", consistency: "morbido",
      visuals: { hair: "#E6BE8A", skin: "#ffdbac", shirtColor: "#b71c1c", pantsColor: "#212121", desc: "blonde short hair, wearing a red polo shirt" }
    }
  ], []);

  const startSession = async (child = null) => {
    setGameState('inbox');
    setChildAvatar(null); setSitterAvatar(null); setDialogueBuffer([]); setPsychAnalysis(""); setChatInput(""); setTacticalAdvice(""); setBubbles({sitter:"",child:"",thought:""}); setAmbientLog(""); setCoherenceScore(null); setFlow(0); setIsFlowActive(false);
    const target = child || defaultChildren[Math.floor(Math.random() * defaultChildren.length)];
    setSelectedChild(target);
    const emailText = await callGemini(`Mail breve da papà di ${target.name}. Capriccio: ${target.crime}.`, "Sei un genitore molto severo ed esigente.");
    setEmail(typeof emailText === 'string' ? emailText : "");
  };

  const generateRandomCase = async () => {
    setIsGeneratingCase(true);
    const prompt = `Genera un profilo JSON per un bambino immaginario (età 6-13) che deve essere punito. 
    Campi richiesti (JSON puro): 
    {
      "name": "Nome italiano",
      "age": numero,
      "crime": "Frase breve sul guaio fatto",
      "consistency": "Aggettivo (es. morbido, sodo, resistente)",
      "visuals": { 
         "hair": "colore hex", 
         "skin": "colore hex", 
         "shirtColor": "colore hex", 
         "pantsColor": "colore hex", 
         "desc": "descrizione fisica breve in inglese per prompt immagine" 
      }
    }`;
    const data = await callGemini(prompt, "Sei un generatore di dati JSON. Rispondi SOLO con il JSON.", true);
    if (data && !data.error && data.name) startSession(data);
    setIsGeneratingCase(false);
  };

  const generateAvatars = async () => {
    setIsGeneratingAvatars(true);
    const cPrompt = `Hyper-realistic portrait of a ${selectedChild.age} year old italian boy named ${selectedChild.name}, ${selectedChild.visuals.desc}, looking guilty, front view, flat lighting, white background.`;
    const sPrompt = `Hyper-realistic portrait of a tall muscular blond male, strict expression, black uniform shirt, front view, professional lighting, white background.`;
    const [c, s] = await Promise.all([callImagen(cPrompt), callImagen(sPrompt)]);
    setChildAvatar(c);
    setSitterAvatar(s);
    setIsGeneratingAvatars(false);
  };

  const preloadDialogues = async () => {
    setIsPreloading(true);
    const script = await callGemini(`Script sculacciata ${selectedChild.name}.`, "Array JSON: [{role: 'sitter'|'child', text: string}]", true);
    if(Array.isArray(script)) {
        const buff = [];
        for(let line of script) {
            const wav = await callGeminiTTS(line.text, line.role==='sitter'?"Zephyr":"Fenrir");
            if(wav) buff.push({...line, url: URL.createObjectURL(wav)});
        }
        setDialogueBuffer(buff);
    }
    setIsPreloading(false);
  };

  const generateAmbientLog = async () => {
    setIsGeneratingAmbient(true);
    const prompt = `Descrivi l'atmosfera della stanza '${config.room}' nella location '${config.location}' prima di una sessione di disciplina per ${selectedChild.name}. Usa un tono freddo, tecnico, descrivendo luci, suoni e odori in max 2 righe.`;
    const log = await callGemini(prompt, "Sei un sensore ambientale di un terminale di sicurezza.");
    setAmbientLog(typeof log === 'string' ? log : "");
    setIsGeneratingAmbient(false);
  };

  const analyzeEducationalCoherence = async () => {
    setIsAnalyzingCoherence(true);
    const prompt = `Analizza la coerenza educativa: Il bambino ${selectedChild.name} (${selectedChild.age} anni) ha commesso: ${selectedChild.crime}. Punizione: ${tapCount} colpi con arrossamento al ${Math.floor(redness*100)}%. Fornisci un punteggio da 1 a 10 e una breve motivazione tecnica.`;
    const result = await callGemini(prompt, "Sei un supervisore disciplinare imparziale. Rispondi in modo professionale.");
    setCoherenceScore(typeof result === 'string' ? result : "");
    setIsAnalyzingCoherence(false);
  };

  // --- FIX: DEFINITA analyzeBehavior ---
  const analyzeBehavior = async () => {
    setIsAnalyzing(true);
    const prompt = `Analisi clinica severa per ${selectedChild.name}, ${selectedChild.age} anni. Crimine: ${selectedChild.crime}. Punizione somministrata: ${tapCount} colpi. Intensità finale rossore: ${Math.floor(redness*100)}%. Predici il comportamento futuro con tono scientifico, distaccato e professionale.`;
    const analysis = await callGemini(prompt, "Sei uno psicologo comportamentale esperto in disciplina.");
    setPsychAnalysis(typeof analysis === 'string' ? analysis : "");
    setIsAnalyzing(false);
  };

  const generateDynamicExcuse = async () => {
    if (isGeneratingExcuse) return;
    setIsGeneratingExcuse(true);
    const prompt = `Frase brevissima (max 6 parole) e disperata in italiano di un bambino di ${selectedChild.age} anni punito per ${selectedChild.crime}.`;
    const text = await callGemini(prompt, "Sei un bambino che piange.");
    if (text) {
        const sanitized = typeof text === 'string' ? text : "";
        setBubbles(prev => ({ ...prev, child: sanitized }));
        const wav = await callGeminiTTS(sanitized, "Fenrir");
        if (wav) new Audio(URL.createObjectURL(wav)).play();
        setTimeout(() => setBubbles(prev => ({ ...prev, child: "" })), 4000);
    }
    setIsGeneratingExcuse(false);
  };

  const handleChat = async () => {
      if(!chatInput.trim() || isSendingChat) return;
      setIsSendingChat(true);
      setBubbles(prev => ({...prev, sitter: chatInput}));
      const userText = chatInput;
      setChatInput("");
      const response = await callGemini(`Sei ${selectedChild.name}. Rispondi brevemente (8 parole) a: ${userText}`, "Roleplay bambino punito.");
      if(response) {
          const sanitized = typeof response === 'string' ? response : "";
          setBubbles(prev => ({...prev, child: sanitized}));
          const wav = await callGeminiTTS(sanitized, "Fenrir");
          if(wav) new Audio(URL.createObjectURL(wav)).play();
          setTimeout(() => setBubbles({sitter:"", child:"", thought:""}), 4000);
      }
      setIsSendingChat(false);
  };

  const getTacticalAdvice = async () => {
      setIsGettingAdvice(true);
      const advice = await callGemini(`Strategia disciplinare per ${selectedChild.name}, consistenza ${selectedChild.consistency}.`, "Strategia fredda in 1 frase.");
      setTacticalAdvice(typeof advice === 'string' ? advice : "");
      setIsGettingAdvice(false);
  };

  const revealInnerThought = async () => {
      setIsGettingThought(true);
      const thought = await callGemini(`Cosa pensa segretamente ${selectedChild.name} mentre viene punito? Max 8 parole.`, "Pensiero interno del bambino.");
      const sanitized = typeof thought === 'string' ? thought : "";
      setBubbles(prev => ({...prev, thought: sanitized}));
      setTimeout(() => setBubbles(prev => ({...prev, thought: ""})), 5000);
      setIsGettingThought(false);
  };

  const performSpank = () => {
      const now = Date.now();
      const deltaTime = now - lastSpankTime.current;
      lastSpankTime.current = now;

      if (deltaTime > 350 && deltaTime < 850) {
          setFlow(prev => Math.min(100, prev + 15));
      } else {
          setFlow(prev => Math.max(0, prev - 10));
      }

      const spankPowerMultiplier = isFlowActive ? 1.5 : 1;
      setTapCount(c => c+1);
      setRedness(r => Math.min(1, r + (0.05 * spankPowerMultiplier)));

      if(tapCount % 6 === 0 && dialogueBuffer.length > 0) {
          const line = dialogueBuffer.shift();
          setBubbles({sitter: line.role==='sitter'?line.text:"", child: line.role==='child'?line.text:"", thought:""});
          new Audio(line.url).play();
          setDialogueBuffer([...dialogueBuffer]);
          setTimeout(() => setBubbles({sitter:"",child:"", thought:""}), 3000);
      }
  };

  const finishSession = async () => {
      setGameState('report');
      const rep = await callGemini(`Report breve per ${selectedChild.name}.`, "Formale, ringrazia il babysitter per la precisione.");
      setReport(typeof rep === 'string' ? rep : "");
  };

  return (
    <div className="relative h-screen w-screen bg-black text-cyan-400 overflow-hidden font-mono select-none flex flex-col">
      {gameState === 'session' && (
        <div className="absolute inset-0 z-0">
           <ThreeScene child={selectedChild} redness={redness} spankPos={spankPos} childAvatar={childAvatar} sitterAvatar={sitterAvatar} tapCount={tapCount} isFlowActive={isFlowActive} />
        </div>
      )}

      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col p-4">
         {gameState === 'splash' && (
             <div className="pointer-events-auto h-full flex flex-col items-center justify-center">
                 <ShieldAlert size={80} className="text-amber-500 animate-pulse mb-8"/>
                 <h1 className="text-6xl font-black text-white italic mb-2">CITY <span className="text-cyan-500">BABYSITTER</span></h1>
                 <p className="text-xs uppercase tracking-[0.4em] mb-8 opacity-70">Disciplinary Unit v8.7</p>
                 <button onClick={() => startSession()} className={BUTTON_ACTION}>ACCEDI AL SISTEMA</button>
             </div>
         )}

         {gameState === 'inbox' && (
             <div className="pointer-events-auto h-full flex items-center justify-center overflow-y-auto py-10">
                 <div className={`w-full max-w-4xl p-8 ${TECH_FRAME} ${TECH_BORDER}`}>
                     <div className="flex justify-between items-center border-b border-cyan-500/30 pb-4 mb-4">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Mail className="text-amber-500"/> COMUNICAZIONE IN USCITA</h2>
                        <span className="text-xs font-bold text-neutral-500">CODICE CASO: {selectedChild?.name.toUpperCase()}</span>
                     </div>
                     <div className="bg-black/40 p-4 border-l-2 border-amber-500 text-sm text-neutral-300 italic mb-6 shadow-inner">{email || "Decrittazione in corso..."}</div>
                     
                     <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="space-y-2 text-center">
                            <span className="text-[10px] uppercase font-bold text-cyan-500">Profilo Soggetto</span>
                            <div className="aspect-[3/4] max-h-64 mx-auto bg-neutral-900 rounded border border-cyan-500/20 overflow-hidden relative shadow-2xl">
                                {childAvatar ? <img src={childAvatar} className="w-full h-full object-cover" alt="Soggetto" /> : <div className="absolute inset-0 flex items-center justify-center opacity-20"><ImageIcon size={40}/></div>}
                                {isGeneratingAvatars && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400"/></div>}
                            </div>
                        </div>
                         <div className="space-y-2 text-center">
                            <span className="text-[10px] uppercase font-bold text-cyan-500">Profilo Operatore</span>
                            <div className="aspect-[3/4] max-h-64 mx-auto bg-neutral-900 rounded border border-cyan-500/20 overflow-hidden relative shadow-2xl">
                                {sitterAvatar ? <img src={sitterAvatar} className="w-full h-full object-cover" alt="Operatore" /> : <div className="absolute inset-0 flex items-center justify-center opacity-20"><ImageIcon size={40}/></div>}
                            </div>
                        </div>
                     </div>

                     <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <button onClick={generateAvatars} disabled={isGeneratingAvatars || !!childAvatar} className={`flex-1 ${BUTTON_TECH} flex justify-center gap-2`}>
                                <ImageIcon size={14}/> GENERA IDENTITÀ
                            </button>
                            <button onClick={preloadDialogues} disabled={isPreloading || dialogueBuffer.length>0} className={`flex-1 ${BUTTON_TECH} flex justify-center gap-2`}>
                                <DownloadCloud size={14}/> CARICA VOCI
                            </button>
                        </div>
                         <div className="flex gap-2">
                             <button onClick={generateRandomCase} disabled={isGeneratingCase} className={`flex-1 ${BUTTON_TECH} flex justify-center gap-2 border-cyan-500/60 bg-cyan-500/20 text-white`}>
                                <Sparkles size={14}/> ✨ NUOVO CASO (AI)
                             </button>
                             <button onClick={() => setGameState('session')} className={`flex-[2] ${BUTTON_ACTION}`}>START</button>
                         </div>
                     </div>
                 </div>
             </div>
         )}

         {gameState === 'session' && (
             <div className="h-full flex flex-col justify-between">
                 <div className={`pointer-events-auto p-4 rounded w-72 ${TECH_FRAME} ${TECH_BORDER}`}>
                     <div className="flex gap-3 items-center mb-3">
                         <div className="w-12 h-12 bg-neutral-800 rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                             {childAvatar && <img src={childAvatar} className="w-full h-full object-cover" alt="Mini Avatar" />}
                         </div>
                         <div className="min-w-0">
                             <h3 className="font-bold text-white leading-none truncate uppercase tracking-tighter">{selectedChild.name}</h3>
                             <span className="text-[9px] text-amber-500 font-bold block truncate opacity-70 italic">{selectedChild.crime}</span>
                         </div>
                     </div>
                     <div className="space-y-2">
                         <div className="space-y-1">
                            <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-white/50"><span>Trauma Termico</span><span>{Math.floor(redness*100)}%</span></div>
                            <div className="h-1 bg-neutral-800 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-red-500 transition-all duration-300 shadow-[0_0_10px_rgba(239,68,68,0.8)]" style={{width: `${redness*100}%`}}/></div>
                         </div>

                         <div className="space-y-1 pt-1">
                            <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-cyan-400"><span>Educational Flow</span><span>{flow}%</span></div>
                            <div className="h-1 bg-neutral-900 rounded-full overflow-hidden border border-cyan-500/20">
                                <div className={`h-full transition-all duration-200 ${isFlowActive ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)] animate-pulse' : 'bg-cyan-700 opacity-60'}`} style={{width: `${flow}%`}}/>
                            </div>
                            {isFlowActive && <div className="text-[7px] text-cyan-300 animate-pulse font-black text-center uppercase tracking-tighter">Flow Mode Active: Efficiency x1.5</div>}
                         </div>
                         
                         <div className="grid grid-cols-2 gap-2 mt-2">
                             <button onClick={generateDynamicExcuse} disabled={isGeneratingExcuse} className={`py-1.5 ${BUTTON_TECH} text-[9px] border-amber-500/30 text-amber-500`}>✨ SCUSA</button>
                             <button onClick={revealInnerThought} disabled={isGettingThought} className={`py-1.5 ${BUTTON_TECH} text-[9px] border-purple-500/30 text-purple-400`}>✨ PENSIERO</button>
                         </div>
                         
                         <button onClick={getTacticalAdvice} disabled={isGettingAdvice} className={`w-full py-1.5 ${BUTTON_TECH} text-[9px] border-cyan-500/30`}>🧠 ANALISI TATTICA (AI)</button>
                         {tacticalAdvice && <div className="text-[8px] text-cyan-300 bg-cyan-900/40 p-2 rounded border-l-2 border-cyan-500 italic shadow-inner">{String(tacticalAdvice)}</div>}
                         
                         <div className="flex gap-2">
                            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Comunica con il soggetto..." className="flex-1 bg-black/50 border border-cyan-500/30 rounded px-2 py-1 text-[10px] text-white focus:outline-none" onKeyDown={(e) => e.key === 'Enter' && handleChat()}/>
                            <button onClick={handleChat} className="bg-cyan-500/20 px-2 rounded hover:bg-cyan-500/40"><Send size={10}/></button>
                         </div>
                     </div>
                 </div>

                 <div className="self-center w-full max-w-lg mb-4 pointer-events-auto">
                    {!ambientLog ? (
                        <button onClick={generateAmbientLog} disabled={isGeneratingAmbient} className={`w-full py-2 ${BUTTON_TECH} border-cyan-500/20 opacity-50 hover:opacity-100 flex items-center justify-center gap-2`}>
                            {isGeneratingAmbient ? <Loader2 size={12} className="animate-spin"/> : <Waves size={12}/>} ✨ ATTIVA REGISTRO AMBIENTALE
                        </button>
                    ) : (
                        <div className={`${TECH_FRAME} p-3 text-[9px] text-cyan-500/80 italic text-center border-none bg-black/40 animate-in fade-in`}>
                            <Cpu size={12} className="inline mr-2 opacity-50"/> {String(ambientLog)}
                        </div>
                    )}
                 </div>

                 <div className={`pointer-events-auto w-full max-w-xl self-center p-4 rounded-t-xl ${TECH_FRAME} ${TECH_BORDER}`}>
                     <div className="flex justify-center gap-2 mb-4">
                         {['letto', 'otk', 'braccio'].map(p => (
                             <button key={p} onClick={() => setSpankPos(p)} className={`px-6 py-2 ${BUTTON_TECH} ${spankPos===p?'bg-cyan-500/40 text-white border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]':''}`}>{p.toUpperCase()}</button>
                         ))}
                     </div>
                     <div className="flex items-center gap-4">
                         <div className="flex-1 flex flex-col gap-1">
                            <div className="flex justify-between text-[8px] font-bold text-neutral-500 uppercase tracking-widest"><span>Input Power</span><span>{power}%</span></div>
                            <input type="range" min="0" max="100" value={power} onChange={e=>setPower(e.target.value)} className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"/>
                         </div>
                         <button onMouseDown={performSpank} className={`w-20 h-20 rounded-full transition-all duration-300 border-4 border-black/20 flex items-center justify-center font-black ${isFlowActive ? 'bg-cyan-500 text-white shadow-[0_0_35px_rgba(34,211,238,0.8)]' : 'bg-amber-500 text-black shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:bg-amber-400'} active:scale-90`}>
                             {isFlowActive ? <Zap size={32}/> : <Baby size={32}/>}
                         </button>
                     </div>
                     <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                         <span className="text-[9px] text-neutral-500 uppercase tracking-tighter">Log Eventi: {tapCount} strikes</span>
                         <button onClick={finishSession} className="text-[9px] text-red-500 font-bold hover:text-red-400 transition-colors uppercase">ARCHIVIA &gt;</button>
                     </div>
                 </div>
             </div>
         )}

         {gameState === 'report' && (
             <div className="pointer-events-auto h-full flex items-center justify-center overflow-y-auto py-10">
                 <div className={`w-full max-w-2xl p-8 ${TECH_FRAME} ${TECH_BORDER} shadow-2xl`}>
                     <div className="flex justify-between items-center border-b border-cyan-500/30 pb-4 mb-4">
                        <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="text-amber-500"/> RAPPORTO DI CHIUSURA</h2>
                        <button onClick={() => setGameState('splash')} className="text-xs text-neutral-500 hover:text-white flex items-center gap-1"><RotateCcw size={16}/> RIAVVIA</button>
                     </div>
                     <div className="space-y-4">
                         <div className="bg-black/40 p-4 border-l-2 border-cyan-500 text-sm text-neutral-300 shadow-inner">{String(report) || "Compilazione dati in corso..."}</div>
                         
                         {!coherenceScore ? (
                             <button onClick={analyzeEducationalCoherence} disabled={isAnalyzingCoherence} className={`w-full ${BUTTON_TECH} py-4 flex items-center justify-center gap-2 border-emerald-500/50 text-emerald-400 bg-emerald-500/5`}>
                                 {isAnalyzingCoherence ? <Loader2 className="animate-spin"/> : <Scale size={16}/>} ✨ ANALISI COERENZA EDUCATIVA (AI)
                             </button>
                         ) : (
                            <div className="mt-4 p-4 bg-emerald-950/20 border border-emerald-500/30 rounded animate-in fade-in slide-in-from-bottom-2">
                                <h3 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-2 uppercase"><CheckCircle2 size={14}/> Valutazione Imparziale</h3>
                                <div className="text-xs leading-relaxed text-emerald-100/80 font-serif italic">
                                    {String(coherenceScore)}
                                </div>
                            </div>
                         )}

                         {!psychAnalysis ? (
                             <button onClick={analyzeBehavior} disabled={isAnalyzing} className={`w-full ${BUTTON_TECH} py-4 flex items-center justify-center gap-2 border-amber-500/50 text-amber-500 bg-amber-500/5`}>
                                 {isAnalyzing ? <Loader2 className="animate-spin"/> : <BrainCircuit size={16}/>} ✨ PROFILO PSICO-COMPORTAMENTALE (AI)
                             </button>
                         ) : (
                             <div className="mt-4 animate-in fade-in slide-in-from-bottom-4">
                                 <h3 className="text-xs font-bold text-amber-500 mb-2 flex items-center gap-2 uppercase tracking-widest"><Target size={14}/> Previsione Riabilitativa</h3>
                                 <div className="bg-amber-950/20 p-4 rounded border border-amber-500/30 text-xs leading-relaxed text-amber-100/80 font-serif">
                                     {String(psychAnalysis)}
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
         )}
         
         {/* BUBBLES */}
         {bubbles.sitter && <div className="fixed top-1/4 left-10 p-4 bg-cyan-500 text-black font-bold text-[11px] rounded border-l-4 border-black shadow-2xl z-50 animate-in slide-in-from-left-4 max-w-[200px]">{String(bubbles.sitter).toUpperCase()}</div>}
         {bubbles.child && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 p-4 bg-white text-red-600 font-black italic text-[11px] rounded-lg shadow-[0_0_40px_rgba(255,255,255,0.3)] z-50 border-2 border-red-500 animate-in zoom-in max-w-[250px]">{String(bubbles.child).toUpperCase()}</div>}
         {bubbles.thought && <div className="fixed top-[45%] left-1/2 -translate-x-1/2 p-4 bg-black/60 backdrop-blur border border-purple-400/50 text-purple-200 font-serif italic text-[11px] rounded-full z-50 flex items-center gap-2 shadow-purple-500/20 shadow-2xl animate-pulse max-w-[300px]"><Cloud size={16}/> {String(bubbles.thought)}</div>}
      </div>
    </div>
  );
}

// --- ENGINE 3D AVANZATO ---
function ThreeScene({ child, redness, spankPos, childAvatar, sitterAvatar, tapCount, isFlowActive }) {
    const containerRef = useRef();
    const sceneRef = useRef();
    const rendererRef = useRef();
    const cameraRef = useRef();
    const sitterRef = useRef();
    const childModelsRef = useRef([]);
    const flowParticlesRef = useRef([]);
  
    useEffect(() => {
      if (!containerRef.current || !child) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x010101);
      sceneRef.current = scene;
      
      const camera = new THREE.PerspectiveCamera(40, width/height, 0.1, 1000);
      camera.position.set(0, 5, 13); camera.lookAt(0, 1, 0);
      cameraRef.current = camera;
      
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      
      scene.add(new THREE.HemisphereLight(0x00ffff, 0x000000, 0.5));
      const mainLight = new THREE.PointLight(0xffffff, 1.5, 50);
      mainLight.position.set(5, 10, 5);
      scene.add(mainLight);

      const floorGeo = new THREE.PlaneGeometry(50, 50);
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.8 });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      const grid = new THREE.GridHelper(50, 50, 0x00ffff, 0x002222);
      grid.position.y = 0.01;
      scene.add(grid);

      const createFlowParticle = () => {
          const geo = new THREE.BoxGeometry(0.02, 0.02, Math.random() * 2 + 1);
          const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });
          const particle = new THREE.Mesh(geo, mat);
          particle.position.set(Math.random() * 40 - 20, 0.02, Math.random() * 40 - 20);
          particle.visible = false;
          scene.add(particle);
          return particle;
      };
      flowParticlesRef.current = Array.from({length: 40}, createFlowParticle);

      const bedGroup = new THREE.Group();
      const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 2.5), new THREE.MeshStandardMaterial({color: 0x111111}));
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.4, 2.3), new THREE.MeshStandardMaterial({color: 0x333333}));
      mattress.position.y = 0.45; bedGroup.add(bedFrame, mattress);
      bedGroup.position.set(-4, 0.25, 0); scene.add(bedGroup);

      const stoolGroup = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16), new THREE.MeshStandardMaterial({color: 0x111111}));
      const stoolBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), new THREE.MeshStandardMaterial({color: 0x444444}));
      seat.position.y = 0.85; stoolBase.position.y = 0.4;
      stoolGroup.add(seat, stoolBase); stoolGroup.position.set(0, 0, 0.5); scene.add(stoolGroup);

      const consoleGroup = new THREE.Group();
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1), new THREE.MeshStandardMaterial({color: 0x111111}));
      consoleGroup.add(desk); consoleGroup.position.set(4, 0.5, 0); scene.add(consoleGroup);

      const createHumanoid = (type, visuals, avatarUrl) => {
          const group = new THREE.Group();
          const isSitter = type === 'sitter';
          const h = isSitter ? 1.85 : 1.1;
          const scale = isSitter ? 1 : 0.6;
          const skinMat = new THREE.MeshStandardMaterial({ color: visuals.skin, roughness: 0.7 });
          const shirtMat = new THREE.MeshStandardMaterial({ color: visuals.shirtColor, roughness: 0.9 });
          const pantsMat = new THREE.MeshStandardMaterial({ color: visuals.pantsColor, roughness: 1 });

          const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25 * scale, 0.5 * scale, 4, 8), shirtMat);
          torso.position.y = h * 0.5; group.add(torso);
          const legGeo = new THREE.CylinderGeometry(0.08 * scale, 0.06 * scale, 0.5 * scale, 8);
          const legL = new THREE.Mesh(legGeo, pantsMat); legL.position.set(-0.12 * scale, h * 0.25, 0);
          const legR = new THREE.Mesh(legGeo, pantsMat); legR.position.set(0.12 * scale, h * 0.25, 0);
          group.add(legL, legR);

          const headGroup = new THREE.Group();
          headGroup.position.y = h * 0.85;
          const headRadius = 0.18 * scale;
          const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 32, 16), skinMat);
          headGroup.add(head);

          if(avatarUrl) {
              const loader = new THREE.TextureLoader();
              loader.load(avatarUrl, (tex) => {
                  tex.colorSpace = THREE.SRGBColorSpace;
                  const faceGeo = new THREE.SphereGeometry(headRadius + 0.005, 32, 16, -Math.PI/4, Math.PI/2, Math.PI/3, Math.PI/3);
                  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
                  const face = new THREE.Mesh(faceGeo, faceMat);
                  face.rotation.y = Math.PI/2;
                  headGroup.add(face);
              });
          }
          const hair = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: visuals.hair }));
          hair.rotation.x = Math.PI; headGroup.add(hair);
          group.add(headGroup);

          if(!isSitter) {
              const bL = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 16, 16), skinMat.clone());
              const bR = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 16, 16), skinMat.clone());
              bL.position.set(-0.08 * scale, h * 0.4, -0.05 * scale);
              bR.position.set(0.08 * scale, h * 0.4, -0.05 * scale);
              bL.scale.z = 0.7; bR.scale.z = 0.7;
              group.add(bL, bR); group.userData.butts = [bL, bR]; group.userData.baseSkin = new THREE.Color(visuals.skin);
          }

          if(isSitter) {
              const shoulder = new THREE.Group(); shoulder.position.set(0.3, h * 0.7, 0);
              const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.4, 8), skinMat);
              armR.position.y = -0.2; shoulder.add(armR);
              group.add(shoulder); group.userData.armR = shoulder;
              const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.4, 8), skinMat);
              armL.position.set(-0.3, h * 0.55, 0); group.add(armL);
          }
          return group;
      };

      const sitter = createHumanoid('sitter', { skin: "#e0ac69", hair: "#f1c27d", shirtColor: "#111111", pantsColor: "#000000" }, sitterAvatar);
      sitter.position.set(0, 0, 2.5); sitterRef.current = sitter; scene.add(sitter);

      const bChild = createHumanoid('child', child.visuals, childAvatar);
      bChild.position.set(-4, 0.8, 0); bChild.rotation.set(Math.PI/2, 0, Math.PI/2); scene.add(bChild);
      const oChild = createHumanoid('child', child.visuals, childAvatar);
      oChild.position.set(0, 1.35, 0.5); oChild.rotation.x = Math.PI/2; scene.add(oChild);
      const aChild = createHumanoid('child', child.visuals, childAvatar);
      aChild.position.set(4, 1.45, 0); aChild.rotation.set(Math.PI/3, 0, 0); scene.add(aChild);
      childModelsRef.current = [bChild, oChild, aChild];

      const animate = () => {
          requestAnimationFrame(animate);
          
          flowParticlesRef.current.forEach(p => {
              if (isFlowActive) {
                  p.visible = true;
                  p.position.z += 0.2;
                  if (p.position.z > 20) p.position.z = -20;
              } else {
                  p.visible = false;
              }
          });

          if(sitterRef.current?.userData?.isSpanking) {
              const u = sitterRef.current.userData;
              u.prog = (u.prog || 0) + 0.15;
              if(u.prog < 1) {
                  const angle = u.prog < 0.3 ? -1.2 : (u.prog < 0.5 ? 0.9 : 0);
                  u.armR.rotation.x = THREE.MathUtils.lerp(u.armR.rotation.x, angle, 0.6);
              } else {
                  u.isSpanking = false; u.prog = 0; u.armR.rotation.x = 0;
              }
          }
          renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        if (!containerRef.current) return;
        camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      };
      window.addEventListener('resize', handleResize);
      return () => { window.removeEventListener('resize', handleResize); renderer.dispose(); };
    }, [child, childAvatar, sitterAvatar, isFlowActive]); 
  
    useEffect(() => {
       const redColor = new THREE.Color(0xff0000);
       childModelsRef.current.forEach(m => {
           if(m.userData.butts) {
               m.userData.butts.forEach(b => b.material.color.lerpColors(m.userData.baseSkin, redColor, redness));
           }
       });
    }, [redness]);
  
    useEffect(() => {
        if(!sitterRef.current) return;
        const targets = { letto: [-4,0,2.5], otk: [0,0,2.5], braccio: [4,0,2.5] };
        const t = targets[spankPos] || targets.otk;
        sitterRef.current.position.set(t[0], t[1], t[2]);
        sitterRef.current.lookAt(t[0], 1, 0);
    }, [spankPos]);
  
    useEffect(() => { if(tapCount > 0 && sitterRef.current) sitterRef.current.userData.isSpanking = true; }, [tapCount]);
  
    return <div ref={containerRef} className="w-full h-full"/>;
}
