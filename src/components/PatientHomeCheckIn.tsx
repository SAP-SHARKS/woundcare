import { useRef, useState } from 'react';
import { Camera, CheckCircle, ArrowRight, ArrowLeft, Heart, ShieldAlert, Sparkles, Smile, Frown, Upload } from 'lucide-react';
import WoundCamera from './WoundCamera';

export default function PatientHomeCheckIn() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Questionnaire states
  const [painLevel, setPainLevel] = useState(3);
  const [increasedRedness, setIncreasedRedness] = useState<boolean | null>(null);
  const [increasedDrainage, setIncreasedDrainage] = useState<boolean | null>(null);
  const [odorNoticeable, setOdorNoticeable] = useState<boolean | null>(null);
  const [fever, setFever] = useState<boolean | null>(null);

  // Checklists
  const [prepCheck1, setPrepCheck1] = useState(false);
  const [prepCheck2, setPrepCheck2] = useState(false);

  const handleCameraCapture = (simulatedUrl: string) => {
    setPhotoPreview(simulatedUrl);
    setShowCamera(false);
    setStep(3); // go to questionnaire
  };

  const handleImageUpload = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') handleCameraCapture(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitCheckin = () => {
    setStep(4); // success step
  };

  const handleReset = () => {
    setStep(1);
    setPhotoPreview(null);
    setPainLevel(3);
    setIncreasedRedness(null);
    setIncreasedDrainage(null);
    setOdorNoticeable(null);
    setFever(null);
    setPrepCheck1(false);
    setPrepCheck2(false);
  };

  return (
    <div className="flex justify-center py-6 bg-slate-50 min-h-[600px]">
      {/* simulated mobile phone mockup container */}
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden border-4 border-slate-200 shadow-xl flex flex-col justify-between aspect-[9/16]">
        
        {/* Soft patient friendly header */}
        <div className="px-5 py-4 bg-teal-50 border-b border-teal-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-teal-650 text-white flex items-center justify-center">
              <Heart className="w-4 h-4 fill-white" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block">CareConnect Home</span>
              <span className="text-[9.5px] text-teal-700 font-medium">Remote Wound Check-in</span>
            </div>
          </div>
          <span className="text-[10px] bg-teal-600/10 text-teal-700 font-bold px-2 py-0.5 rounded-full">
            Step {step} of 3
          </span>
        </div>

        {/* Home check-in Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* STEP 1: Preparation checklist */}
          {step === 1 && (
            <div className="space-y-4 animate-slide-in">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Let's prepare your wound</h3>
                <p className="text-xs text-slate-550 leading-relaxed">Ensure you do the following steps before snapping the photograph to help your care team evaluate details correctly.</p>
              </div>

              <div className="space-y-2.5 pt-2">
                <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/50 transition">
                  <input
                    type="checkbox"
                    checked={prepCheck1}
                    onChange={e => setPrepCheck1(e.target.checked)}
                    className="w-5 h-5 rounded text-teal-600 border-slate-300 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">Clean & uncover wound</span>
                    <span className="text-[10.5px] text-slate-400 leading-normal block mt-0.5">Remove the dressing gently and wipe any residue with saline wipes.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/50 transition">
                  <input
                    type="checkbox"
                    checked={prepCheck2}
                    onChange={e => setPrepCheck2(e.target.checked)}
                    className="w-5 h-5 rounded text-teal-600 border-slate-300 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">Position marker</span>
                    <span className="text-[10.5px] text-slate-400 leading-normal block mt-0.5">Place the paper calibration marker 1 inch away from the wound margin.</span>
                  </div>
                </label>
              </div>

              {/* Reassurance Banner */}
              <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-xl p-3.5 flex items-start gap-2.5 text-[10px] leading-relaxed shadow-sm">
                <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5 fill-blue-500/10" />
                <span>
                  Your clinical photographs are encrypted and sent securely only to your treating clinic. They are never shared publicly.
                </span>
              </div>

              <button
                type="button"
                disabled={!prepCheck1 || !prepCheck2}
                onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-1.5 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                Proceed to Camera <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Photo Capture Trigger */}
          {step === 2 && (
            <div className="space-y-4 text-center py-6 animate-slide-in">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Wound Photography</h3>
                <p className="text-xs text-slate-550 leading-relaxed px-2">Hold your smartphone directly above the wound. Keep it flat, steady, and in good lighting.</p>
              </div>

              <div className="border border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50/50">
                <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-650 flex items-center justify-center mb-3 border border-teal-100 shadow-sm">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                  <button type="button" onClick={() => setShowCamera(true)} className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-xl shadow hover:bg-teal-700 transition">
                    <Camera className="w-4 h-4"/> Take photo
                  </button>
                  <button type="button" onClick={() => uploadRef.current?.click()} className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-teal-300 text-teal-700 text-xs font-bold rounded-xl hover:bg-teal-50 transition">
                    <Upload className="w-4 h-4"/> Upload image
                  </button>
                </div>
                <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { handleImageUpload(event.target.files?.[0]); event.currentTarget.value = ''; }}/>
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-semibold mx-auto transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to prep checklist
              </button>
            </div>
          )}

          {/* STEP 3: Simple Symptom Questionnaire */}
          {step === 3 && (
            <div className="space-y-5 animate-slide-in">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Quick Symptoms check</h3>
                <p className="text-xs text-slate-550 leading-relaxed">Tell us how the wound feels today compared to yesterday.</p>
              </div>

              {/* Pain scale (Emoji friendly) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>How is your pain level?</span>
                  <span className="text-teal-700">{painLevel} / 10</span>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <Smile className={`w-5 h-5 ${painLevel <= 3 ? 'text-emerald-500 fill-emerald-50' : 'text-slate-400'}`} />
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={painLevel}
                    onChange={e => setPainLevel(Number(e.target.value))}
                    className="flex-1 accent-teal-650 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <Frown className={`w-5 h-5 ${painLevel >= 7 ? 'text-red-500 fill-red-50' : 'text-slate-400'}`} />
                </div>
              </div>

              {/* Yes/No questions */}
              <div className="space-y-3.5">
                {[
                  { label: 'Is the skin around the wound redder than before?', val: increasedRedness, setter: setIncreasedRedness },
                  { label: 'Do you notice more fluid or drainage leaking?', val: increasedDrainage, setter: setIncreasedDrainage },
                  { label: 'Does the wound have a noticeable bad odor?', val: odorNoticeable, setter: setOdorNoticeable },
                  { label: 'Have you had a fever or chills today?', val: fever, setter: setFever }
                ].map((q, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700 block">{q.label}</span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => q.setter(true)}
                        className={`py-2 text-xs font-semibold rounded-lg border transition ${
                          q.val === true
                            ? 'bg-teal-50 border-teal-500 text-teal-700'
                            : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => q.setter(false)}
                        className={`py-2 text-xs font-semibold rounded-lg border transition ${
                          q.val === false
                            ? 'bg-slate-50 border-slate-400 text-slate-750'
                            : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold rounded-xl transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmitCheckin}
                  className="flex-1 py-3 bg-teal-650 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  Submit Check-in
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success confirmation */}
          {step === 4 && (
            <div className="space-y-5 text-center py-6 animate-scale-in">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-8 h-8" />
              </div>
              
              {photoPreview && (
                <div className="w-28 h-28 mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <img src={photoPreview} alt="Check-in captured evidence" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Check-in Completed!</h3>
                <p className="text-xs text-slate-550 leading-relaxed px-2">Your wound photograph and symptoms summary have been sent safely to your clinic care team.</p>
              </div>

              {/* Warning guidance */}
              <div className="bg-red-50 border border-red-100 text-red-800 rounded-xl p-3.5 text-[10px] leading-relaxed text-left flex items-start gap-2.5">
                <ShieldAlert className="w-4.5 h-4.5 text-red-650 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-red-950 block mb-0.5">When to seek urgent care:</span>
                  If you develop a fever above 38.5°C (101.3°F), feel throbbing pain, notice red streaks moving up your limb, or feel chills, please go to the nearest emergency clinic immediately. Do not wait for our review.
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Start New Check-in
              </button>
            </div>
          )}
        </div>

        {/* Soft caregiver helpline footer */}
        <div className="px-5 py-3 border-t border-slate-100 text-[9px] text-slate-400 bg-slate-50 text-center leading-normal">
          Need assistance? Call your Clinic Care team at 9200-WOUNDS or message support via CareConnect.
        </div>

        {/* Camera Modal Overlay */}
        {showCamera && (
          <WoundCamera
            onClose={() => setShowCamera(false)}
            onCapture={handleCameraCapture}
          />
        )}
      </div>
    </div>
  );
}
