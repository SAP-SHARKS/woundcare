import { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, CheckCircle, ShieldAlert, Sparkles } from 'lucide-react';

interface Props {
  onCapture: (simulatedImgUrl: string) => void;
  onClose: () => void;
}

export default function WoundCamera({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  // Guidance simulation states
  const [distance, setDistance] = useState<'too_far' | 'correct' | 'too_close'>('too_far');
  const [angle, setAngle] = useState<'tilted' | 'aligned'>('tilted');
  const [markerDetected, setMarkerDetected] = useState(false);
  const [focus, setFocus] = useState<'blurry' | 'sharp'>('blurry');
  const [lighting, setLighting] = useState<'low' | 'good'>('low');

  const [captured, setCaptured] = useState(false);
  const [simulatedPhoto, setSimulatedPhoto] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function startCamera() {
      setCameraError('');
      setCameraReady(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Live camera is not supported in this browser. Use the device camera option below.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (!active) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (videoRef.current.videoWidth && videoRef.current.videoHeight) setCameraReady(true);
        }
      } catch (error) {
        const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
        setCameraError(denied ? 'Camera permission was denied. Allow camera access or use the device camera option.' : 'The camera could not be started. It requires HTTPS or localhost.');
      }
    }
    void startCamera();
    return () => { active = false; streamRef.current?.getTracks().forEach(track => track.stop()); };
  }, [cameraAttempt]);

  // Auto-calibrate guides over time to simulate aligning the camera
  useEffect(() => {
    const timers = [
      setTimeout(() => setLighting('good'), 1000),
      setTimeout(() => setDistance('correct'), 2000),
      setTimeout(() => setMarkerDetected(true), 3500),
      setTimeout(() => {
        setAngle('aligned');
        setFocus('sharp');
      }, 5000)
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) { setCameraError('The camera is still starting. Please wait a moment and try again.'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setSimulatedPhoto(canvas.toDataURL('image/jpeg', 0.9));
    setCaptured(true);
  };

  const handleUsePhoto = () => {
    if (simulatedPhoto) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      onCapture(simulatedPhoto);
    }
  };

  const handleFallbackFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') { setSimulatedPhoto(reader.result); setCaptured(true); setCameraError(''); } };
    reader.readAsDataURL(file);
  };

  const closeCamera = () => { streamRef.current?.getTracks().forEach(track => track.stop()); onClose(); };

  const handleRetake = () => {
    setCaptured(false);
    setSimulatedPhoto(null);
    setDistance('too_far');
    setAngle('tilted');
    setMarkerDetected(false);
    setFocus('blurry');
  };

  const isReadyToCapture = distance === 'correct' && angle === 'aligned' && markerDetected && focus === 'sharp' && lighting === 'good';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4">
      {/* Mobile Frame Simulation Container */}
      <div className="relative w-full max-w-sm aspect-[9/16] bg-slate-900 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl flex flex-col justify-between">
        
        {/* Top Header Indicators */}
        <div className="px-4 py-3 bg-slate-950/60 backdrop-blur-md flex items-center justify-between text-xs z-15">
          <span className="font-semibold text-slate-100 flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-teal-400" /> Standardized Camera
          </span>
          <button onClick={closeCamera} className="text-slate-400 hover:text-slate-200 font-medium">Cancel</button>
        </div>

        {/* Live Camera View Simulation */}
        <div className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden">
          
          {captured && simulatedPhoto ? (
            <img src={simulatedPhoto} alt="Captured clinical evidence" className="w-full h-full object-cover" />
          ) : (
            // Camera grid overlay
            <><video ref={videoRef} playsInline muted onCanPlay={() => { setCameraReady(true); setCameraError(''); }} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 border border-slate-800/40 grid grid-cols-3 grid-rows-3 z-10 pointer-events-none">
              <div className="border-r border-b border-slate-700/20" />
              <div className="border-r border-b border-slate-700/20" />
              <div className="border-b border-slate-700/20" />
              <div className="border-r border-b border-slate-700/20" />
              <div className="border-r border-b border-slate-700/20" />
              <div className="border-b border-slate-700/20" />
              <div className="border-r border-slate-700/20" />
              <div className="border-r border-slate-700/20" />
              <div className="bg-transparent" />
            </div></>
          )}

          {/* Target Boundary Guide Box */}
          {!captured && (
            <div className={`absolute w-52 h-52 border-2 rounded-2xl flex items-center justify-center z-10 transition-all ${
              isReadyToCapture ? 'border-emerald-500 bg-emerald-500/5' : 'border-teal-400/40 bg-teal-450/5'
            }`}>
              {/* Simulated visual target marker */}
              <div className={`w-10 h-10 border-2 rounded-full flex items-center justify-center transition-all ${
                markerDetected ? 'border-emerald-500 bg-emerald-500/20 text-emerald-450' : 'border-teal-400/30 text-teal-400/40'
              }`}>
                <Sparkles className="w-4 h-4" />
              </div>

              {/* Target bracket corners */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/70" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/70" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/70" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/70" />
            </div>
          )}

          {/* Active Alignment Status Badges */}
          {!captured && (
            <div className="absolute top-4 left-4 right-4 flex flex-col gap-1.5 z-10">
              <div className="flex gap-1.5 flex-wrap">
                {/* Distance Indicator */}
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border transition ${
                  distance === 'correct' ? 'bg-emerald-950/80 text-emerald-350 border-emerald-900' : 'bg-red-950/80 text-red-350 border-red-900'
                }`}>
                  {distance === 'correct' ? 'Distance: Good' : 'Move Closer'}
                </span>
                
                {/* Lighting Indicator */}
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border transition ${
                  lighting === 'good' ? 'bg-emerald-950/80 text-emerald-350 border-emerald-900' : 'bg-red-950/80 text-red-350 border-red-900'
                }`}>
                  {lighting === 'good' ? 'Lighting: Ideal' : 'Low Light Warning'}
                </span>

                {/* Focus Indicator */}
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border transition ${
                  focus === 'sharp' ? 'bg-emerald-950/80 text-emerald-350 border-emerald-900' : 'bg-red-950/80 text-red-350 border-red-900'
                }`}>
                  {focus === 'sharp' ? 'Focus: Sharp' : 'Refocusing...'}
                </span>
              </div>

              {/* Marker detected banner */}
              <div className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border transition mt-1 flex items-center gap-1.5 ${
                markerDetected ? 'bg-emerald-950/90 text-emerald-300 border-emerald-850' : 'bg-slate-900/90 text-slate-350 border-slate-800'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${markerDetected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                {markerDetected ? 'Calibration marker recognized' : 'Position calibration marker in frame'}
              </div>
            </div>
          )}
        </div>

        {/* Bottom controls panel */}
        <div className="px-4 py-5 bg-slate-950 flex flex-col items-center gap-3.5 z-15">
          {captured ? (
            <div className="w-full flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Retake
              </button>
              <button
                type="button"
                onClick={handleUsePhoto}
                className="flex-1 py-2.5 bg-teal-650 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
              >
                <CheckCircle className="w-3.5 h-3.5 inline mr-1" /> Use Photograph
              </button>
            </div>
          ) : (
            <>
              {cameraError && <div className="w-full bg-red-950/80 border border-red-900 text-red-200 rounded-xl px-3 py-2 text-[10px] leading-relaxed">{cameraError}</div>}
              {cameraError && (
                <div className="w-full grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setCameraAttempt(value => value + 1)} className="py-2 rounded-lg border border-teal-700 text-teal-200 text-[11px] font-semibold hover:bg-teal-950">Try camera again</button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="py-2 rounded-lg border border-slate-700 text-slate-200 text-[11px] font-semibold hover:bg-slate-900">Choose image</button>
                </div>
              )}
              {/* Correction instruction warning banner */}
              {!isReadyToCapture && (
                <div className="w-full bg-amber-950/80 border border-amber-900 text-amber-300 rounded-xl px-3 py-2 flex items-start gap-2 text-[10px] leading-relaxed">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-500 mt-0.5" />
                  <span>
                    {!markerDetected ? 'Hold camera flat over the wound, alignment marker must be detected to auto-calculate dimensions.' : 'Hold steady. Camera adjusting focus & distance angles.'}
                  </span>
                </div>
              )}

              {/* Capture Trigger */}
              <button
                type="button"
                onClick={handleCapture}
                disabled={!cameraReady}
                aria-label={cameraReady ? 'Capture wound photograph' : 'Camera is not ready'}
                className="w-16 h-16 rounded-full border-4 border-slate-700 p-1 bg-white hover:bg-slate-100 transition active:scale-95 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <div className="w-full h-full rounded-full bg-teal-600 hover:bg-teal-700" />
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] font-semibold text-teal-300 hover:text-teal-200">Upload an existing image instead</button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { handleFallbackFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
