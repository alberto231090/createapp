import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Code, Eye, Paperclip, RotateCcw, Download, Terminal,
  Settings, Sparkles, ChevronRight, Plus, Trash2, AlertCircle,
  Save, FolderOpen, X, UploadCloud, CheckCircle2, Loader2,
  Lightbulb, Info, ShieldCheck, Globe, PlusCircle, User,
  Database, FileUp, FileText, Cpu, Smartphone, Tablet,
  Monitor, Languages, Binary, Folder, ChevronDown, Menu,
  FileCode, File, Edit3
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc,
  onSnapshot, query, deleteDoc, serverTimestamp 
} from 'firebase/firestore';

// --- Configurazione Iniziale Firebase ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ai-app-creator-pro';

let app, auth, db;
if (firebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const apiKey = "AIzaSyCbKs15vkGVUxUuWA660sNYmzm803fXsog"; 

const TRANSLATIONS = {
  it: {
    appTitle: "AI App Creator",
    proEdition: "PRO EDITION",
    prompting: "Compositore",
    refinePrompt: "Ottimizza",
    composerPlaceholder: "Descrivi l'app o allega file di contesto...",
    cloudArchive: "Archivio Progetti",
    ready: "Sistema Pronto",
    working: "Generazione in corso...",
    preview: "Anteprima",
    code: "Sorgente",
    console: "Console",
    explainAi: "Analisi AI",
    settings: "Impostazioni",
    language: "Lingua",
    maintenance: "Sistema",
    clearSession: "Reset Sessione",
    save: "Salva",
    export: "Esporta",
    saveProject: "Salvataggio Cloud",
    projectName: "Nome progetto",
    folderName: "Cartella",
    defaultFolder: "Progetti AI",
    cancel: "Annulla",
    confirm: "Conferma",
    saving: "Salvataggio...",
    connecting: "Connessione al Cloud...",
    authError: "Sessione non valida. Riprova."
  },
  en: {
    appTitle: "AI App Creator",
    proEdition: "PRO EDITION",
    prompting: "Composer",
    refinePrompt: "Refine",
    composerPlaceholder: "Describe the app or attach context files...",
    cloudArchive: "Cloud Archive",
    ready: "System Ready",
    working: "Generating...",
    preview: "Preview",
    code: "Source",
    console: "Console",
    explainAi: "AI Analysis",
    settings: "Settings",
    language: "Language",
    maintenance: "System",
    clearSession: "Clear Session",
    save: "Save",
    export: "Export",
    saveProject: "Cloud Save",
    projectName: "Project Name",
    folderName: "Folder",
    defaultFolder: "AI Projects",
    cancel: "Cancel",
    confirm: "Confirm",
    saving: "Saving...",
    connecting: "Connecting to Cloud...",
    authError: "Invalid session. Please retry."
  }
};

const LANGUAGES_SUPPORTED = [
  { id: "html", name: "HTML5 / Tailwind", ext: "html", web: true },
  { id: "react", name: "React (Single File)", ext: "jsx", web: true },
  { id: "php", name: "PHP Script", ext: "php", web: false },
  { id: "python", name: "Python Script", ext: "py", web: false }
];

const SUPPORTED_MODEL = "gemini-2.5-flash-preview-09-2025";

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [lang, setLang] = useState('it');
  const [progLang, setProgLang] = useState('html');
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const [generatedCode, setGeneratedCode] = useState("");
  const [history, setHistory] = useState([]);
  const [savedProjects, setSavedProjects] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [error, setError] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectFolder, setProjectFolder] = useState("");
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const t = TRANSLATIONS[lang];

  const [previewSize, setPreviewSize] = useState("desktop");
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [attachedFiles, setAttachedFiles] = useState([]);

  const attachmentRef = useRef(null);
  const iframeRef = useRef(null);

  // RULE 3: Auth prima di ogni operazione.
  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { 
        console.error("Auth error", err); 
        setError(t.authError);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, [t.authError]);

  // Sincronizzazione Progetti (RULE 1 & RULE 3)
  useEffect(() => {
    if (!user || !db) return;
    
    // Path: /artifacts/{appId}/users/{userId}/projects
    const projectsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'projects');
    const unsubscribe = onSnapshot(projectsPath, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedProjects(projects);
      
      const folders = { ...expandedFolders };
      projects.forEach(p => {
        const folder = p.folder || t.defaultFolder;
        if (folders[folder] === undefined) folders[folder] = true;
      });
      setExpandedFolders(folders);
    }, (err) => {
      console.error(err);
      setError("Errore sincronizzazione Cloud.");
    });
    return () => unsubscribe();
  }, [user, t.defaultFolder]);

  // Bridge per Console
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'console') {
        const payload = typeof event.data.payload === 'object' ? JSON.stringify(event.data.payload) : String(event.data.payload);
        setConsoleLogs(prev => [...prev, { 
          method: event.data.method, 
          payload: payload, 
          time: new Date().toLocaleTimeString() 
        }].slice(-30));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const callGemini = async (systemPrompt, userQuery, context = []) => {
    const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/${SUPPORTED_MODEL}:generateContent?key=${apiKey}`;
    const contents = [...context, { role: "user", parts: [{ text: userQuery }] }];

    const response = await fetch(modelUrl, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ "google_search": {} }] 
      }) 
    });
    
    if (!response.ok) throw new Error("API Connection Failed");
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim() && attachedFiles.length === 0 || isGenerating) return;
    
    setIsGenerating(true); 
    setError(null); 
    setExplanation(""); 
    setConsoleLogs([]);
    setIsSidebarOpen(false); 

    try {
      const chatContext = history.slice(-2).map(item => ([
        { role: "user", parts: [{ text: item.prompt }] },
        { role: "model", parts: [{ text: item.code }] }
      ])).flat();
      
      let contextualPrompt = prompt;
      if (attachedFiles.length > 0) {
        const filesString = attachedFiles.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}`).join("\n\n---\n\n");
        contextualPrompt = `CONTESTO ALLEGATO:\n${filesString}\n\nRICHIESTA:\n${prompt}`;
      }

      const systemPrompt = `Sei uno sviluppatore senior esperto in ${progLang}. 
      Genera codice robusto, moderno e ben commentato in ${lang === 'it' ? 'Italiano' : 'Inglese'}.
      REGOLE:
      1. Se HTML, usa Tailwind CDN.
      2. Includi monitoraggio console nel head.
      3. Solo codice pulito, niente spiegazioni discorsive esterne.
      4. Se PHP, tag <?php obbligatorio.
      5. Se React, componente App auto-contenuto.`;

      const inputForAI = generatedCode ? `Codice attuale:\n${generatedCode}\n\nModifica richiesta: ${contextualPrompt}` : contextualPrompt;

      const res = await callGemini(systemPrompt, inputForAI, chatContext);
      const cleanCode = res.replace(/```[a-z]*|```/g, "").trim();
      
      setGeneratedCode(cleanCode);
      setHistory(prev => [...prev, { prompt: contextualPrompt, code: cleanCode, timestamp: new Date() }]);
      setPrompt("");
      setAttachedFiles([]); 
      setActiveTab("preview");
    } catch (err) { 
      setError("Errore IA: " + err.message); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  const refinePrompt = async () => {
    if (!prompt.trim() || isRefiningPrompt) return;
    setIsRefiningPrompt(true);
    try {
      const res = await callGemini(`Ottimizza questo prompt tecnico in ${lang === 'it' ? 'Italiano' : 'Inglese'}:`, prompt);
      if (res) setPrompt(res.trim());
    } catch (err) {} finally { setIsRefiningPrompt(false); }
  };

  const explainCode = async () => {
    if (!generatedCode || isExplaining) return;
    setIsExplaining(true);
    try {
      const res = await callGemini(`Analisi tecnica in ${lang === 'it' ? 'Italiano' : 'Inglese'}:`, generatedCode);
      setExplanation(res);
    } catch (err) {} finally { setIsExplaining(false); }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachedFiles(prev => [...prev, { name: file.name, content: ev.target.result }]);
      };
      reader.readAsText(file);
    });
    e.target.value = null; 
  };

  // Salvataggio Cloud (RULE 1 & RULE 3)
  const saveProject = async () => {
    if (!user) {
      setError("In attesa di autenticazione Cloud...");
      return;
    }
    if (!db || !generatedCode) return;

    setIsSaving(true);
    const id = currentProjectId || crypto.randomUUID();
    
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', id), {
        name: projectName || "Nuovo Progetto",
        folder: projectFolder || t.defaultFolder,
        code: generatedCode,
        progLang,
        lastUpdated: serverTimestamp()
      });
      setCurrentProjectId(id); 
      setShowSaveModal(false);
      setError(null);
    } catch (err) { 
      console.error("Save Error:", err);
      setError("Salvataggio fallito. Verifica la connessione."); 
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProject = async (e, id) => {
    e.stopPropagation();
    if (!user || !db) return;
    if (confirm(lang === 'it' ? 'Eliminare permanentemente?' : 'Delete?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', id));
        if (currentProjectId === id) setGeneratedCode("");
      } catch (err) {
        setError("Errore eliminazione.");
      }
    }
  };

  const groupedProjects = useMemo(() => {
    return savedProjects.reduce((acc, p) => {
      const folder = p.folder || t.defaultFolder;
      if (!acc[folder]) acc[folder] = [];
      acc[folder].push(p);
      return acc;
    }, {});
  }, [savedProjects, t.defaultFolder]);

  // Anteprima React/HTML
  useEffect(() => {
    if (activeTab === "preview" && generatedCode && iframeRef.current) {
      let content = generatedCode;
      
      if (progLang === 'react') {
        content = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
              <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
              <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>html, body, #root { height: 100%; margin: 0; padding: 0; }</style>
              <script>
                const originalLog = console.log;
                const originalError = console.error;
                console.log = (...args) => {
                  window.parent.postMessage({ type: 'console', method: 'log', payload: args }, '*');
                  originalLog(...args);
                };
                console.error = (...args) => {
                  window.parent.postMessage({ type: 'console', method: 'error', payload: args }, '*');
                  originalError(...args);
                };
              </script>
            </head>
            <body>
              <div id="root"></div>
              <script type="text/babel">
                const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext } = React;
                let source = \`${generatedCode.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
                source = source.replace(/export default/g, 'const App =');
                source = source.replace(/import .* from .*/g, '');
                try {
                  eval(Babel.transform(source + "\\n const root = ReactDOM.createRoot(document.getElementById('root')); root.render(<App />);", { presets: ['react'] }).code);
                } catch (err) {
                  console.error("Runtime Error:", err.message);
                }
              </script>
            </body>
          </html>
        `;
      }
      
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      iframeRef.current.src = url;
      return () => URL.revokeObjectURL(url);
    }
  }, [generatedCode, activeTab, progLang]);

  // Schermata di caricamento iniziale
  if (isAuthLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">{t.connecting}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 md:hidden text-slate-600 hover:bg-slate-100 rounded-lg">
            <Menu size={20} />
          </button>
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-100">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="font-black text-sm md:text-base leading-none text-slate-900 tracking-tight">{projectName || t.appTitle}</h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">{t.proEdition}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {generatedCode && (
            <div className="flex items-center gap-1.5 pr-2 md:pr-3 border-r border-slate-200 mr-2">
              <button onClick={() => setShowSaveModal(true)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title={t.save}><Save size={18}/></button>
              <button onClick={() => {
                const blob = new Blob([generatedCode], { type: 'text/plain' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `app.${LANGUAGES_SUPPORTED.find(l=>l.id===progLang)?.ext}`; a.click();
              }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title={t.export}><Download size={18}/></button>
            </div>
          )}
          <button onClick={() => setShowSettingsModal(true)} className="p-2 text-slate-400 hover:text-slate-900 rounded-lg"><Settings size={20} /></button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        
        {/* Sidebar */}
        <aside className={`
          absolute md:relative inset-y-0 left-0 z-40
          w-72 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="p-6 space-y-10 overflow-y-auto flex-1 custom-scrollbar">
            
            <section className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t.prompting}</label>
              <div className="space-y-4">
                <select value={progLang} onChange={e => setProgLang(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black focus:ring-4 focus:ring-indigo-50 outline-none transition-all cursor-pointer">
                  {LANGUAGES_SUPPORTED.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                
                <form onSubmit={handleGenerate} className="space-y-3">
                  <div className="relative group">
                    <textarea 
                      value={prompt} onChange={e => setPrompt(e.target.value)} 
                      placeholder={t.composerPlaceholder} 
                      className="w-full h-44 p-5 text-[13px] bg-slate-50 border border-slate-100 rounded-2xl focus:ring-8 focus:ring-indigo-50 focus:border-indigo-200 outline-none resize-none font-medium leading-relaxed transition-all shadow-inner" 
                    />
                    
                    {attachedFiles.length > 0 && (
                      <div className="absolute top-[-35px] left-0 flex flex-wrap gap-2 w-full">
                        {attachedFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-indigo-600 text-white px-2.5 py-1 rounded-full text-[9px] font-black animate-in fade-in">
                             <FileCode size={10} />
                             <span className="truncate max-w-[80px]">{f.name}</span>
                             <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-200"><X size={10}/></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button type="button" onClick={() => attachmentRef.current.click()} className="p-3 bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm">
                      <Paperclip size={20} />
                    </button>
                    <input type="file" ref={attachmentRef} onChange={handleFileChange} multiple className="hidden" />
                    
                    <button type="button" onClick={refinePrompt} className="p-3 bg-slate-100 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all shadow-sm">
                      {isRefiningPrompt ? <Loader2 size={20} className="animate-spin" /> : <Lightbulb size={20} />}
                    </button>
                    
                    <button type="submit" disabled={isGenerating || (!prompt.trim() && attachedFiles.length === 0)} className="flex-1 p-3 bg-slate-900 text-white font-black rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-600 disabled:opacity-20 transition-all shadow-xl active:scale-95">
                      {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                  </div>
                </form>
              </div>
            </section>

            <section className="space-y-4 pb-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t.cloudArchive}</label>
              <div className="space-y-2">
                {Object.keys(groupedProjects).map(folder => (
                  <div key={folder} className="space-y-1">
                    <button onClick={() => setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }))} className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition-all group">
                      <div className="flex items-center gap-3">
                        <Folder size={16} className={expandedFolders[folder] ? "text-indigo-500" : "text-slate-300"} />
                        <span className={`text-[11px] font-black ${expandedFolders[folder] ? 'text-slate-900' : 'text-slate-500'}`}>{folder}</span>
                      </div>
                      <ChevronDown size={14} className={`text-slate-300 transition-transform ${expandedFolders[folder] ? "rotate-180" : ""}`} />
                    </button>
                    {expandedFolders[folder] && (
                      <div className="ml-5 space-y-1 border-l-2 border-slate-100 pl-4 animate-in slide-in-from-left">
                        {groupedProjects[folder].map(p => (
                          <div key={p.id} onClick={() => loadProject(p)} className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${currentProjectId === p.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <span className="text-[11px] font-bold truncate flex-1">{p.name}</span>
                            <button onClick={e => deleteProject(e, p.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-md">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isGenerating ? t.working : t.ready}</span>
            <div className={`w-2.5 h-2.5 rounded-full ${isGenerating ? 'bg-indigo-500 animate-ping' : 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'}`}></div>
          </div>
        </aside>

        {/* Workspace */}
        <section className="flex-1 flex flex-col bg-[#f1f5f9] p-2 md:p-6 overflow-hidden relative">
          
          <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] shadow-2xl border border-slate-200/50 overflow-hidden relative">
            
            <div className="h-14 md:h-16 flex items-center justify-between px-6 bg-slate-50/50 border-b border-slate-100 shrink-0 backdrop-blur-sm">
              <div className="flex bg-slate-200/40 p-1 rounded-2xl gap-0.5">
                <button onClick={() => setActiveTab("preview")} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "preview" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{t.preview}</button>
                <button onClick={() => setActiveTab("code")} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "code" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{t.code}</button>
                <button onClick={() => setActiveTab("console")} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "console" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{t.console}</button>
              </div>
              
              {activeTab === "preview" && generatedCode && LANGUAGES_SUPPORTED.find(l=>l.id===progLang)?.web && (
                <div className="hidden md:flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
                  <button onClick={() => setPreviewSize("mobile")} className={`p-2 rounded-lg transition-all ${previewSize === "mobile" ? "text-indigo-600 bg-indigo-50" : "text-slate-300"}`}><Smartphone size={16}/></button>
                  <button onClick={() => setPreviewSize("tablet")} className={`p-2 rounded-lg transition-all ${previewSize === "tablet" ? "text-indigo-600 bg-indigo-50" : "text-slate-300"}`}><Tablet size={16}/></button>
                  <button onClick={() => setPreviewSize("desktop")} className={`p-2 rounded-lg transition-all ${previewSize === "desktop" ? "text-indigo-600 bg-indigo-50" : "text-slate-300"}`}><Monitor size={16}/></button>
                </div>
              )}
            </div>

            <div className="flex-1 relative overflow-hidden bg-slate-50/20">
              {isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-2xl z-[40] animate-in fade-in">
                  <Loader2 className="animate-spin text-indigo-600 mb-6" size={48} />
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{t.working}</h3>
                </div>
              ) : activeTab === "preview" ? (
                <div className="flex-1 h-full flex justify-center items-center overflow-auto p-4">
                  {!generatedCode ? (
                     <div className="text-center space-y-4 opacity-20">
                        <Binary size={72} className="mx-auto" strokeWidth={1}/>
                        <p className="text-[11px] font-black uppercase tracking-[0.5em]">System Idle</p>
                     </div>
                  ) : !LANGUAGES_SUPPORTED.find(l=>l.id===progLang)?.web ? (
                    <div className="text-center p-12 bg-white rounded-[3rem] border border-slate-100 shadow-2xl animate-in zoom-in">
                      <Terminal size={48} className="mx-auto text-indigo-500 mb-6" strokeWidth={1.5}/>
                      <h4 className="font-black text-slate-800 text-xl tracking-tight">Script Logico</h4>
                      <p className="text-sm text-slate-400 mt-4 leading-relaxed">Output visuale non disponibile per {progLang.toUpperCase()}.</p>
                    </div>
                  ) : (
                    <div 
                      className="bg-white shadow-2xl transition-all duration-700 ease-in-out border border-slate-200/50 overflow-hidden" 
                      style={{ 
                        width: previewSize === "mobile" ? "375px" : previewSize === "tablet" ? "768px" : "100%", 
                        height: previewSize === "desktop" ? "100%" : "667px",
                        borderRadius: previewSize === "desktop" ? "0" : "3rem",
                        border: previewSize === "desktop" ? "none" : "16px solid #0f172a"
                      }}
                    >
                      <iframe ref={iframeRef} className="w-full h-full border-none" title="Preview" sandbox="allow-scripts" />
                    </div>
                  )}
                </div>
              ) : activeTab === "code" ? (
                <div className="flex-1 h-full bg-[#0a0c10] flex flex-col relative overflow-hidden animate-in fade-in">
                   <div className="absolute top-6 right-8 flex gap-3 z-10 items-center">
                      <div className="px-3 py-1.5 bg-slate-800/50 rounded-lg text-[8px] font-black text-slate-500 uppercase flex items-center gap-2 border border-white/5">
                        <Edit3 size={10} /> Editor Attivo
                      </div>
                      <button onClick={explainCode} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 flex items-center gap-2 shadow-2xl">
                        {isExplaining ? <Loader2 size={14} className="animate-spin" /> : <Info size={14} />} {t.explainAi}
                      </button>
                   </div>
                   {explanation && (
                    <div className="m-6 p-6 bg-indigo-600 text-white rounded-[2rem] relative shadow-2xl animate-in slide-in-from-top-4 border border-white/10">
                      <button onClick={() => setExplanation("")} className="absolute top-5 right-5 text-white/40 hover:text-white"><X size={18}/></button>
                      <p className="text-sm font-medium leading-relaxed">{String(explanation)}</p>
                    </div>
                   )}
                   <textarea
                    value={generatedCode}
                    onChange={(e) => setGeneratedCode(e.target.value)}
                    spellCheck={false}
                    className="flex-1 overflow-auto p-10 bg-[#0a0c10] text-indigo-300 font-mono text-[13px] leading-relaxed custom-scrollbar selection:bg-indigo-500/30 outline-none border-none resize-none"
                   />
                </div>
              ) : (
                <div className="flex-1 h-full bg-[#0f172a] p-8 font-mono text-xs overflow-auto custom-scrollbar">
                  <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-5">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{t.console} Stream</span>
                    <button onClick={() => setConsoleLogs([])} className="text-[10px] text-red-400 font-black uppercase hover:text-red-300 transition-colors">Wipe Logs</button>
                  </div>
                  {consoleLogs.length === 0 ? (
                    <p className="text-slate-600 italic">Nessun log disponibile.</p>
                  ) : (
                    <div className="space-y-3">
                      {consoleLogs.map((log, i) => (
                        <div key={i} className="flex gap-6 text-[12px] border-b border-white/5 pb-3 group animate-in slide-in-from-left">
                          <span className="text-slate-600 shrink-0 font-black opacity-30">[{log.time}]</span>
                          <div className={`p-2 px-4 rounded-xl w-full border ${log.method === 'error' ? 'bg-red-500/5 text-red-400 border-red-500/10' : 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10'}`}>
                            <span className="font-black uppercase mr-3 opacity-30 text-[9px] tracking-tighter">{String(log.method)}</span>
                            <span className="font-medium whitespace-pre-wrap">{String(log.payload)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* --- Modali --- */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-10 md:p-14 w-full max-w-md shadow-2xl text-center border border-slate-100 relative overflow-hidden">
            <div className="bg-emerald-50 p-7 rounded-full inline-block mb-8 text-emerald-500 shadow-inner"><Save size={40}/></div>
            <h2 className="text-3xl font-black mb-3 text-slate-900 tracking-tight">{t.saveProject}</h2>
            <div className="space-y-4">
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-center text-lg focus:ring-8 focus:ring-emerald-50 transition-all shadow-inner" placeholder={t.projectName} />
              <input type="text" value={projectFolder} onChange={(e) => setProjectFolder(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-center text-lg focus:ring-8 focus:ring-emerald-50 transition-all shadow-inner" placeholder={t.folderName} />
            </div>
            <div className="flex gap-4 mt-12">
              <button onClick={() => setShowSaveModal(false)} className="flex-1 font-black text-slate-400 hover:text-slate-600 transition-colors uppercase text-xs tracking-widest">{t.cancel}</button>
              <button 
                onClick={saveProject} 
                disabled={isSaving}
                className="flex-[2] py-5 bg-slate-900 text-white font-black rounded-[1.5rem] shadow-2xl hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 size={20} className="animate-spin" /> : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6">
              <h2 className="text-2xl font-black tracking-tight">{t.settings}</h2>
              <button onClick={() => setShowSettingsModal(false)} className="p-3 hover:bg-slate-100 rounded-full transition-all"><X size={24}/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t.language}</label>
                <div className="flex gap-3">
                  <button onClick={() => setLang('it')} className={`flex-1 py-4 rounded-2xl border-2 font-black transition-all ${lang === 'it' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xl' : 'border-slate-100 text-slate-300 hover:text-slate-500'}`}>Italiano</button>
                  <button onClick={() => setLang('en')} className={`flex-1 py-4 rounded-2xl border-2 font-black transition-all ${lang === 'en' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xl' : 'border-slate-100 text-slate-300 hover:text-slate-500'}`}>English</button>
                </div>
              </div>
              <div className="space-y-5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t.maintenance}</label>
                <button onClick={() => { setHistory([]); setGeneratedCode(""); setPrompt(""); setShowSettingsModal(false); }} className="w-full py-4 bg-red-50 text-red-500 font-black rounded-2xl border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-md active:scale-95">Reset Sessione</button>
              </div>
            </div>
            <div className="mt-12 flex justify-end">
              <button onClick={() => setShowSettingsModal(false)} className="px-14 py-4 bg-slate-900 text-white font-black rounded-[1.5rem] shadow-xl hover:bg-indigo-600 transition-all active:scale-95">{t.confirm}</button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl text-white px-8 py-5 rounded-[1.75rem] shadow-2xl flex items-center gap-5 animate-in slide-in-from-bottom-6 z-[120] border border-white/10 w-[92%] md:w-auto">
          <div className="bg-red-500 p-2.5 rounded-xl shadow-lg shadow-red-500/40"><AlertCircle size={22} /></div>
          <p className="text-sm font-black tracking-tight flex-1">{String(error)}</p>
          <button onClick={() => setError(null)} className="p-1.5 hover:bg-white/10 rounded-full transition-all"><X size={18}/></button>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        @keyframes fade-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes slide-in-left { from { opacity: 0; transform: translateX(-15px); } to { opacity: 1; transform: translateX(0); } }
        .animate-in { animation: fade-in 0.3s ease-out forwards; }
        .slide-in-from-left { animation: slide-in-left 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
  
  function loadProject(p) {
    setGeneratedCode(p.code);
    setProgLang(p.progLang || 'html');
    setProjectName(p.name);
    setProjectFolder(p.folder);
    setCurrentProjectId(p.id);
    setActiveTab("preview");
    setExplanation("");
  }
}