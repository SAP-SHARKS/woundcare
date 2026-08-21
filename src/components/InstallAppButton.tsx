import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null), [showIos, setShowIos] = useState(false);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', capture); return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);
  if (standalone || (!prompt && !ios)) return null;
  async function install() { if (prompt) { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === 'accepted') setPrompt(null); } else setShowIos(true); }
  return <><button onClick={() => void install()} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-stone-200 bg-white text-[11px] font-semibold text-stone-600 hover:bg-stone-50"><Download size={14}/><span className="hidden sm:inline">Install app</span></button>
    {showIos&&<div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={()=>setShowIos(false)}><div className="bg-[#fffefc] rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex justify-between gap-4"><h2 className="font-semibold">Add WoundTrack to your Home Screen</h2><button onClick={()=>setShowIos(false)}><X size={18}/></button></div><ol className="mt-4 text-sm text-stone-600 space-y-3"><li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[#eef4f3] text-[#1f6f6b] flex items-center justify-center text-xs font-bold">1</span><span>Tap the <b>Share</b> button in Safari. <Share size={15} className="inline text-[#1f6f6b]"/></span></li><li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[#eef4f3] text-[#1f6f6b] flex items-center justify-center text-xs font-bold">2</span><span>Scroll down and choose <b>Add to Home Screen</b>.</span></li><li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[#eef4f3] text-[#1f6f6b] flex items-center justify-center text-xs font-bold">3</span><span>Tap <b>Add</b>. WoundTrack will open like an app.</span></li></ol></div></div>}
  </>;
}
