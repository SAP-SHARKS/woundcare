import { useEffect, useState } from 'react';
import { Activity, Download, Share, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'woundtrack-install-dismissed-at';
const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    const timestamp = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return timestamp > 0 && Date.now() - timestamp < REMIND_AFTER_MS;
  });
  const [installed, setInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const complete = () => {
      setInstalled(true);
      setInstallPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', complete);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', complete);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setInstallPrompt(null);
      } else {
        dismiss();
      }
      return;
    }
    setShowIosInstructions(true);
  }

  if (installed || dismissed || (!installPrompt && !ios)) return null;

  return <>
    <aside role="dialog" aria-label="Install WoundTrack" className="fixed z-[70] left-3 right-3 bottom-3 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[390px] rounded-2xl border border-teal-200 bg-[#fffefc] p-4 shadow-2xl">
      <button onClick={dismiss} aria-label="Dismiss install reminder" className="absolute right-3 top-3 rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"><X size={17}/></button>
      <div className="flex gap-3 pr-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1f6f6b] text-white"><Activity size={23}/></span>
        <div><h2 className="text-sm font-bold text-stone-900">Install WoundTrack</h2><p className="mt-1 text-xs leading-5 text-stone-600">Add it to your Home Screen for faster access and an app-like full-screen experience.</p></div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={dismiss} className="wt-button flex-1 justify-center">Not now</button>
        <button onClick={() => void install()} className="wt-button primary flex-1 justify-center"><Download size={15}/>{ios ? 'Show me how' : 'Install app'}</button>
      </div>
    </aside>

    {showIosInstructions && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center" onClick={() => setShowIosInstructions(false)}>
      <div className="w-full max-w-sm rounded-2xl bg-[#fffefc] p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex justify-between gap-4"><h2 className="font-semibold">Add WoundTrack to your Home Screen</h2><button onClick={() => setShowIosInstructions(false)}><X size={18}/></button></div>
        <ol className="mt-4 space-y-3 text-sm text-stone-600">
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eef4f3] text-xs font-bold text-[#1f6f6b]">1</span><span>Tap the <b>Share</b> button in Safari. <Share size={15} className="inline text-[#1f6f6b]"/></span></li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eef4f3] text-xs font-bold text-[#1f6f6b]">2</span><span>Scroll down and choose <b>Add to Home Screen</b>.</span></li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eef4f3] text-xs font-bold text-[#1f6f6b]">3</span><span>Tap <b>Add</b>. WoundTrack will then open like an app.</span></li>
        </ol>
      </div>
    </div>}
  </>;
}
