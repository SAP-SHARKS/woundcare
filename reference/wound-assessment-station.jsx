import React, { useState, useRef } from "react";

/* ------------------------------------------------------------------
   Kera — Wound Assessment Station
   Applies the wound-image-assessment skill to uploaded photographs.
   Design thesis: absent data is displayed with the same visual
   weight as present data.
------------------------------------------------------------------ */

const SKILL_SYSTEM_PROMPT = `You are a wound care specialist (CWOCN-level) performing structured assessment of a wound photograph. You produce DOCUMENTATION SUPPORT, not diagnosis.

THREE GOVERNING RULES:
1. Describe what is visible. Propose what is inferable. Name what is unknowable.
2. A photograph cannot assess a wound. Depth, undermining, tunneling, induration, temperature, odor, pain and blanchability are physically unobtainable from an image. Always list them as undeterminable.
3. When ambiguous, state low confidence and give a differential. A stated uncertainty beats a confident guess.

THE SCALE RULE (most important):
If no ruler, fiducial marker or known-size object is visibly in frame and coplanar with the wound, you MUST NOT report measurements in centimetres — not as estimates, not hedged, not "approximately". Set scaleAvailable=false, all cm fields null, and report aspectRatio only. Fabricated measurements get charted and poison trend data.

CAPTURE QUALITY GRADE:
A = scale in frame, perpendicular, even light, wound cleansed, margins + 4cm periwound visible
B = usable, one or two limitations
C = marginal, several findings unreliable
D = not assessable

TISSUE: percentages in 10% increments summing to 100% of the WOUND BED ONLY. Granulation (quality: healthy/pale/dusky/friable/hypergranulation), slough (yellow-tan-gray, stringy, fibrinous), eschar (black-brown, note stable=dry+adherent vs unstable=boggy+draining), epithelial (pink, pearly, advancing from margins). Note exposed fascia/muscle/tendon/bone.

EDGES: attached, unattached, epibole (rolled under — epithelialization has stopped), macerated, hyperkeratotic/callused, fibrotic, punched-out, sloping, everted. Look specifically for epibole and everted edges.

PERIWOUND (4cm margin): erythema with extent, maceration, excoriation, callus, hemosiderin staining, atrophie blanche, lipodermatosclerosis, dryness, hair loss, satellite lesions.

INFECTION: screen NERDS (Non-healing, Exudate, Red friable granulation, Debris, Smell) and STONEES (Size increasing, Temperature, Os/probe-to-bone, New breakdown, Exudate/Erythema/Edema, Smell). Mark which criteria are image-assessable. NEVER assert infection — say "features associated with infection; clinical correlation indicated".

ETIOLOGY by morphology + site: pressure (bony prominence), venous (gaiter/medial malleolus, shallow, irregular, ruddy, hemosiderin), arterial (distal, punched-out, pale dry base, minimal exudate), diabetic/neuropathic (plantar, metatarsal heads, callus rim), moisture-associated (perineum, diffuse, denuded), skin tear, surgical.

HARD RULES — these override pattern matching:
- Never reverse-stage. A healing Stage 4 stays "healing Stage 4".
- Never stage a non-pressure wound. Set stagingApplicable=false for venous/arterial/diabetic/skin tear/moisture wounds.
- Slough or eschar obscuring the bed = Unstageable. No depth-based stage.
- Never recommend debriding dry, stable, intact heel eschar — protect and offload.
- Never recommend debridement when pyoderma gangrenosum is in the differential (violaceous undermined border, rapid expansion, disproportionate pain) — pathergy worsens it.
- Never assert biofilm; it is not visually confirmable.
- Never state Stage 1 or DTPI as established from colour alone.

PIGMENTED SKIN: on Fitzpatrick IV-VI, erythema and deep tissue injury present as purple, maroon, blue or subtle darkening relative to surrounding tissue — NOT red. Compare against adjacent unaffected skin on the same patient. Never let absence of red hue count as evidence against inflammation. Raise stated uncertainty for erythema-dependent findings.

ESCALATION FLAGS (level: emergency/urgent/refer): dusky-purple skin with bullae or rapid spread (necrotizing infection, EMERGENCY); exposed or probeable bone (osteomyelitis); violaceous undermined border (pyoderma gangrenosum, do not debride); retiform purpura in dialysis patient (calciphylaxis); heaped everted friable edges non-healing >3 months (malignancy, biopsy); new deep tissue injury; dry gangrene of digit (do not debride).

CONFOUNDERS to consider before classifying: silver/charcoal dressing residue mimics eschar; iodine mimics slough; gentian violet mimics necrosis; dried blood mimics eschar; cavity shadow mimics necrosis; subcutaneous fat mimics slough; maceration (white) vs epithelialisation (pearly pink); callus vs slough; dependent rubor vs cellulitis; bruising vs DTPI.

OUTPUT DISCIPLINE — the response is length-capped, so brevity is mandatory. Every prose field must be under 15 words. No array may exceed 4 items. Use short phrases, not sentences. Omit hedging language; the confidence fields already carry uncertainty.

Respond ONLY with valid JSON — no preamble, no markdown fences, no trailing commentary.`;

/* Split into two calls: one response cannot hold the whole schema within the
   token cap, and a truncated object is worse than two complete halves. */

const SURVEY_SCHEMA = `
Report the VISUAL SURVEY only. Schema:
{
 "imageQuality":{"grade":"A|B|C|D","scaleReference":bool,"limitations":[str],"privacyConcerns":[str]},
 "measurement":{"scaleAvailable":bool,"lengthCm":num|null,"widthCm":num|null,"areaCm2":num|null,"aspectRatio":str,"note":str},
 "tissue":{"granulation":num,"granulationQuality":str,"slough":num,"eschar":num,"escharState":"stable|unstable|n/a","epithelial":num,"exposedStructures":[str],"note":str},
 "edges":{"findings":[str],"note":str},
 "periwound":{"findings":[str],"erythemaExtentCm":num|null,"note":str},
 "moisture":{"state":"desiccated|moist|wet|saturated","note":str}
}`;

const INTERPRET_SCHEMA = `
Report the CLINICAL INTERPRETATION only. Schema:
{
 "flags":[{"level":"emergency|urgent|refer","finding":str,"action":str}],
 "infection":{"nerdsPresent":[str],"stoneesPresent":[str],"assessment":str},
 "classification":{"etiology":str,"etiologyConfidence":"low|moderate|high","differential":[str],"stagingApplicable":bool,"stage":str|null,"stageConfidence":str|null,"rationale":str},
 "cannotDetermine":[str],
 "push":{"computable":bool,"score":num|null,"missingInputs":[str]},
 "nextCapture":[str]
}`;

const COMPARE_SYSTEM_PROMPT = `You are a wound care specialist comparing two serial photographs of the same wound. Image 1 is the EARLIER capture, image 2 is the LATER capture.

First verify comparability: same wound, similar orientation, similar lighting. If they are not comparable, say so plainly — that is the correct output, not a spurious trend.

Apply the 4-week benchmark: less than 40-50% area reduction at four weeks predicts failure to heal by week twelve across venous, diabetic and pressure ulcers.

Report tissue composition shift as well as area — a wound can be static in area while converting slough to granulation, which is real progress the area figure hides.

If neither image contains a scale reference, report relative area change only and set absoluteMeasurement=false. Never fabricate centimetres.

Respond ONLY with valid JSON, no markdown fences. Keep prose fields under 30 words. Schema:
{
 "comparable":bool,
 "comparabilityNote":str,
 "absoluteMeasurement":bool,
 "areaChangePercent":num|null,
 "areaDirection":"reduced|enlarged|static|indeterminate",
 "tissueShift":str,
 "belowHealingThreshold":bool|null,
 "thresholdNote":str,
 "interpretation":str,
 "recommendedActions":[str]
}`;

const BODY_SITES = ["Sacrum / coccyx", "Ischium", "Heel", "Trochanter", "Occiput", "Lower leg — gaiter", "Medial malleolus", "Lateral malleolus", "Plantar forefoot", "Toe", "Perineum / gluteal cleft", "Forearm / shin", "Surgical incision", "Other / unspecified"];
const SKIN_TONES = [{ v: "I–II", l: "Fitzpatrick I–II" }, { v: "III–IV", l: "Fitzpatrick III–IV" }, { v: "V–VI", l: "Fitzpatrick V–VI" }, { v: "unknown", l: "Not recorded" }];
const EXUDATE = ["Not recorded", "None", "Light", "Moderate", "Heavy"];

const TISSUE_COLORS = { granulation: "#9E3A31", slough: "#C7A55E", eschar: "#241C18", epithelial: "#E3AE9F" };

export default function WoundAssessmentStation() {
  const [images, setImages] = useState([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [comparing, setComparing] = useState(false);
  const fileRef = useRef(null);

  const current = images[active];

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setError(null);
    const loaded = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () =>
              resolve({
                name: file.name,
                mediaType: file.type,
                dataUrl: r.result,
                base64: r.result.split(",")[1],
                context: { site: "Other / unspecified", tone: "unknown", exudate: "Not recorded", days: "" },
                result: null,
              });
            r.onerror = () => reject(new Error("Could not read " + file.name));
            r.readAsDataURL(file);
          })
      )
    ).catch((e) => { setError(e.message); return []; });
    if (!loaded.length) return;
    setImages((prev) => { const next = [...prev, ...loaded]; setActive(prev.length); return next; });
    setCompareResult(null);
  }

  function updateContext(key, value) {
    setImages((prev) => prev.map((im, i) => (i === active ? { ...im, context: { ...im.context, [key]: value } } : im)));
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setActive((a) => (idx < a ? a - 1 : Math.max(0, Math.min(a, images.length - 2))));
    setCompareResult(null);
  }

  /* Responses are length-capped, so a reply can end mid-object. Rather than
     discarding the whole assessment, rewind to the last point where a value
     completed cleanly and close the open brackets there. */
  function parseJson(data) {
    if (data?.error) throw new Error(data.error.message || "The service rejected the request.");
    const text = (data.content || []).map((c) => (c.type === "text" ? c.text : "")).filter(Boolean).join("\n");
    let s = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = s.indexOf("{");
    if (start === -1) throw new Error("No structured data in the response.");
    s = s.slice(start);

    try { return { data: JSON.parse(s), partial: false }; } catch (_) { /* fall through to repair */ }

    const cuts = [];
    const stack = [];
    let inStr = false, esc = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { if (inStr) esc = true; continue; }
      if (c === '"') {
        inStr = !inStr;
        if (!inStr) cuts.push({ at: i + 1, close: [...stack].reverse().join("") });
        continue;
      }
      if (inStr) continue;
      if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if (c === "}" || c === "]") {
        stack.pop();
        cuts.push({ at: i + 1, close: [...stack].reverse().join("") });
      } else if (c === ",") {
        cuts.push({ at: i, close: [...stack].reverse().join("") });
      }
    }

    for (let k = cuts.length - 1; k >= 0; k--) {
      const candidate = s.slice(0, cuts[k].at).replace(/,\s*$/, "") + cuts[k].close;
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length) {
          return { data: parsed, partial: true };
        }
      } catch (_) { /* keep rewinding */ }
    }
    throw new Error("The response could not be read as structured data.");
  }

  async function assess() {
    if (!current) return;
    setBusy(true); setError(null);
    const c = current.context;
    const contextLine = `Clinician-supplied context — Body site: ${c.site}. Skin tone: ${c.tone === "unknown" ? "not recorded (raise uncertainty on erythema-dependent findings)" : "Fitzpatrick " + c.tone}. Exudate amount: ${c.exudate}. Days since baseline: ${c.days || "not recorded"}.`;
    const callPass = async (schema) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SKILL_SYSTEM_PROMPT + schema,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: current.mediaType, data: current.base64 } },
            { type: "text", text: contextLine + "\n\nAssess this wound photograph. Return only the JSON object." },
          ] }],
        }),
      });
      return parseJson(await res.json());
    };

    try {
      const [survey, interp] = await Promise.allSettled([callPass(SURVEY_SCHEMA), callPass(INTERPRET_SCHEMA)]);
      if (survey.status === "rejected" && interp.status === "rejected") throw survey.reason;

      const merged = {
        ...(survey.status === "fulfilled" ? survey.value.data : {}),
        ...(interp.status === "fulfilled" ? interp.value.data : {}),
      };
      merged._partial =
        (survey.status === "fulfilled" && survey.value.partial) ||
        (interp.status === "fulfilled" && interp.value.partial) ||
        survey.status === "rejected" || interp.status === "rejected";

      setImages((prev) => prev.map((im, i) => (i === active ? { ...im, result: merged } : im)));
    } catch (e) {
      setError("Assessment failed — " + e.message + " Re-run the assessment to try again.");
    } finally { setBusy(false); }
  }

  async function compare() {
    if (images.length < 2) return;
    setComparing(true); setError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: COMPARE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: [
            { type: "text", text: "Image 1 — earlier capture:" },
            { type: "image", source: { type: "base64", media_type: images[0].mediaType, data: images[0].base64 } },
            { type: "text", text: "Image 2 — later capture:" },
            { type: "image", source: { type: "base64", media_type: images[1].mediaType, data: images[1].base64 } },
            { type: "text", text: `Days between captures: ${images[1].context.days || "not recorded"}. Body site: ${images[0].context.site}. Return only the JSON object.` },
          ] }],
        }),
      });
      const data = await res.json();
      setCompareResult(parseJson(data).data);
    } catch (e) {
      setError("Comparison failed — " + e.message);
    } finally { setComparing(false); }
  }

  return (
    <div className="kera-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

        .kera-root{
          --ink:#0E1A16; --pine:#1C4A3C; --moss:#3E7A63; --haze:#A8BDB2;
          --line:#CBD8CF; --paper:#EDF1EC; --card:#FFFFFF; --steel:#2C5A78;
          --brass:#9A7B3F; --mute:#5C7268;
          background:var(--paper); color:var(--ink);
          font-family:'IBM Plex Sans',system-ui,sans-serif;
          min-height:100%; padding:28px 22px 60px;
        }
        .kera-root *{box-sizing:border-box;}
        .mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;}
        .disp{font-family:'Archivo',system-ui,sans-serif;letter-spacing:-0.02em;}

        .eyebrow{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;
          text-transform:uppercase;color:var(--mute);}

        .shell{max-width:1220px;margin:0 auto;}
        .masthead{border-bottom:1.5px solid var(--pine);padding-bottom:14px;margin-bottom:22px;
          display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;}
        .masthead h1{font-family:'Archivo';font-weight:700;font-size:23px;margin:0;letter-spacing:-0.03em;}
        .masthead h1 span{color:var(--moss);font-weight:500;}
        .rule-brass{height:2px;width:34px;background:var(--brass);margin-bottom:9px;}

        .grid{display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:22px;align-items:start;}
        @media(max-width:900px){.grid{grid-template-columns:1fr;}}

        .card{background:var(--card);border:1px solid var(--line);border-radius:3px;}
        .card-h{padding:11px 14px;border-bottom:1px solid var(--line);display:flex;
          justify-content:space-between;align-items:center;gap:10px;}
        .card-b{padding:14px;}

        .drop{border:1.5px dashed var(--haze);border-radius:3px;background:var(--card);
          padding:34px 20px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;position:relative;overflow:hidden;}
        .drop:hover{border-color:var(--moss);background:#F7FAF8;}
        .drop-inner{position:relative;z-index:1;}
        .tess{position:absolute;inset:0;opacity:.05;z-index:0;}

        .strip{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px;}
        .thumb{width:56px;height:56px;border-radius:2px;overflow:hidden;border:1.5px solid var(--line);
          cursor:pointer;position:relative;padding:0;background:none;}
        .thumb.on{border-color:var(--pine);box-shadow:0 0 0 2px rgba(28,74,60,.16);}
        .thumb img{width:100%;height:100%;object-fit:cover;display:block;}
        .thumb .dot{position:absolute;bottom:2px;right:2px;width:7px;height:7px;border-radius:50%;
          background:var(--moss);border:1.5px solid #fff;}
        .thumb-x{position:absolute;top:1px;right:1px;background:rgba(14,26,22,.78);color:#fff;
          border:none;width:15px;height:15px;border-radius:2px;font-size:10px;line-height:1;cursor:pointer;padding:0;}

        .preview{width:100%;border-radius:2px;border:1px solid var(--line);display:block;background:#0E1A16;}

        label.f{display:block;margin-bottom:11px;}
        label.f .lb{display:block;font-family:'IBM Plex Mono',monospace;font-size:10px;
          letter-spacing:.11em;text-transform:uppercase;color:var(--mute);margin-bottom:4px;}
        select,input[type=text]{width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:2px;
          font-family:'IBM Plex Sans';font-size:13px;background:#fff;color:var(--ink);}
        select:focus,input:focus{outline:2px solid var(--moss);outline-offset:-1px;}
        .two{display:grid;grid-template-columns:1fr 1fr;gap:10px;}

        button.act{width:100%;padding:11px;background:var(--pine);color:#F2F7F4;border:none;border-radius:2px;
          font-family:'Archivo';font-weight:600;font-size:13px;letter-spacing:.02em;cursor:pointer;transition:background .15s;}
        button.act:hover:not(:disabled){background:#153B30;}
        button.act:disabled{background:var(--haze);cursor:not-allowed;}
        button.ghost{width:100%;padding:9px;background:transparent;color:var(--steel);
          border:1px solid var(--steel);border-radius:2px;font-family:'Archivo';font-weight:600;font-size:12px;
          cursor:pointer;margin-top:8px;}
        button.ghost:disabled{opacity:.4;cursor:not-allowed;}

        .grade{display:inline-flex;align-items:center;gap:7px;}
        .grade b{font-family:'Archivo';font-weight:700;font-size:19px;width:29px;height:29px;
          display:flex;align-items:center;justify-content:center;border-radius:2px;color:#fff;}

        .flag{border-left:3px solid var(--ink);background:#F4F7F5;padding:9px 11px;margin-bottom:7px;}
        .flag .lv{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.15em;
          text-transform:uppercase;color:var(--ink);font-weight:600;}
        .flag.emergency{border-left-color:#1B1035;background:#EFEDF4;}
        .flag.urgent{border-left-color:var(--steel);background:#EDF2F5;}
        .flag.refer{border-left-color:var(--moss);background:#EFF5F1;}

        .sec{padding:13px 0;border-top:1px solid var(--line);}
        .sec:first-child{border-top:none;padding-top:0;}
        .sec h3{font-family:'Archivo';font-weight:600;font-size:12px;letter-spacing:.05em;
          text-transform:uppercase;margin:0 0 8px;color:var(--pine);}

        .bar{display:flex;height:26px;border-radius:2px;overflow:hidden;border:1px solid var(--line);margin-bottom:8px;}
        .bar div{display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;
          font-size:10px;font-weight:600;color:#fff;min-width:0;}
        .legend{display:flex;flex-wrap:wrap;gap:12px;}
        .legend span{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mute);}
        .legend i{width:9px;height:9px;border-radius:1px;display:block;}

        .kv{display:flex;gap:10px;padding:4px 0;font-size:13px;border-bottom:1px dotted var(--line);}
        .kv:last-child{border-bottom:none;}
        .kv .k{color:var(--mute);min-width:112px;font-family:'IBM Plex Mono',monospace;font-size:11px;
          text-transform:uppercase;letter-spacing:.06em;padding-top:2px;}
        .kv .v{flex:1;}

        .void{background:repeating-linear-gradient(135deg,#E8EDE9,#E8EDE9 5px,#DFE7E1 5px,#DFE7E1 10px);
          border:1px solid var(--line);border-radius:2px;padding:12px;}
        .void ul{margin:6px 0 0;padding-left:17px;}
        .void li{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:#3A4C44;margin-bottom:2px;}

        .chip{display:inline-block;background:#EDF2EF;border:1px solid var(--line);border-radius:2px;
          padding:2px 7px;font-size:11.5px;margin:0 5px 5px 0;}
        .chip.mono{font-family:'IBM Plex Mono',monospace;font-size:11px;}

        .conf{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;
          padding:1px 6px;border-radius:2px;border:1px solid;}
        .conf.low{color:var(--mute);border-color:var(--haze);}
        .conf.moderate{color:var(--steel);border-color:var(--steel);}
        .conf.high{color:var(--pine);border-color:var(--pine);}

        .err{background:#EDF2F5;border-left:3px solid var(--steel);padding:10px 12px;font-size:12.5px;margin-bottom:14px;}
        .foot{margin-top:14px;padding-top:11px;border-top:1px solid var(--line);
          font-size:11.5px;color:var(--mute);line-height:1.5;}
        .empty{text-align:center;padding:52px 20px;color:var(--mute);}
        .spin{display:inline-block;width:11px;height:11px;border:2px solid rgba(255,255,255,.35);
          border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite;margin-right:7px;vertical-align:-1px;}
        @keyframes sp{to{transform:rotate(360deg);}}
        @media(prefers-reduced-motion:reduce){.spin{animation:none;}}
      `}</style>

      <div className="shell">
        <div className="masthead">
          <div>
            <div className="rule-brass" />
            <h1>Kera <span>/ Assessment Station</span></h1>
            <div className="eyebrow" style={{ marginTop: 5 }}>Structured wound image assessment — documentation support</div>
          </div>
          <div className="eyebrow" style={{ textAlign: "right" }}>
            Skill: wound-image-assessment<br />NPIAP · WOCN · NERDS/STONEES
          </div>
        </div>

        {error && <div className="err">{error}</div>}

        <div className="grid">
          {/* ---------- LEFT: capture + context ---------- */}
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-h"><span className="eyebrow">Captures</span>
                {images.length > 0 && <span className="mono" style={{ fontSize: 11, color: "var(--mute)" }}>{images.length} loaded</span>}
              </div>
              <div className="card-b">
                {images.length > 0 && (
                  <div className="strip">
                    {images.map((im, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <button className={"thumb" + (i === active ? " on" : "")} onClick={() => setActive(i)} aria-label={"Capture " + (i + 1)}>
                          <img src={im.dataUrl} alt="" />
                          {im.result && <span className="dot" />}
                        </button>
                        <button className="thumb-x" onClick={() => removeImage(i)} aria-label="Remove">×</button>
                      </div>
                    ))}
                  </div>
                )}

                {current ? (
                  <img src={current.dataUrl} alt="Wound capture under assessment" className="preview" />
                ) : (
                  <div className="drop" onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
                    <svg className="tess" viewBox="0 0 80 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                      <defs><pattern id="tess" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M20 2 L26 14 L38 20 L26 26 L20 38 L14 26 L2 20 L14 14 Z" fill="none" stroke="#1C4A3C" strokeWidth="1" />
                        <rect x="2" y="2" width="36" height="36" fill="none" stroke="#1C4A3C" strokeWidth="0.5" transform="rotate(45 20 20)" />
                      </pattern></defs>
                      <rect width="80" height="80" fill="url(#tess)" />
                    </svg>
                    <div className="drop-inner">
                      <div className="disp" style={{ fontWeight: 600, fontSize: 14, marginBottom: 5 }}>Add wound photographs</div>
                      <div style={{ fontSize: 12.5, color: "var(--mute)" }}>Drop files here or click to browse.<br />Include a ruler in frame for measurements.</div>
                    </div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                  onChange={(e) => handleFiles(e.target.files)} />
                {current && (
                  <button className="ghost" onClick={() => fileRef.current?.click()} style={{ marginTop: 10 }}>Add more captures</button>
                )}
              </div>
            </div>

            {current && (
              <div className="card">
                <div className="card-h"><span className="eyebrow">Bedside context</span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--mute)" }}>not in the image</span></div>
                <div className="card-b">
                  <label className="f"><span className="lb">Body site</span>
                    <select value={current.context.site} onChange={(e) => updateContext("site", e.target.value)}>
                      {BODY_SITES.map((s) => <option key={s}>{s}</option>)}
                    </select></label>
                  <label className="f"><span className="lb">Skin tone</span>
                    <select value={current.context.tone} onChange={(e) => updateContext("tone", e.target.value)}>
                      {SKIN_TONES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select></label>
                  <div className="two">
                    <label className="f"><span className="lb">Exudate</span>
                      <select value={current.context.exudate} onChange={(e) => updateContext("exudate", e.target.value)}>
                        {EXUDATE.map((x) => <option key={x}>{x}</option>)}
                      </select></label>
                    <label className="f"><span className="lb">Days from baseline</span>
                      <input type="text" inputMode="numeric" placeholder="e.g. 28" value={current.context.days}
                        onChange={(e) => updateContext("days", e.target.value.replace(/[^0-9]/g, ""))} /></label>
                  </div>
                  <button className="act" onClick={assess} disabled={busy}>
                    {busy ? <><span className="spin" />Assessing</> : current.result ? "Re-assess capture" : "Assess capture"}
                  </button>
                  {images.length >= 2 && (
                    <button className="ghost" onClick={compare} disabled={comparing}>
                      {comparing ? "Comparing…" : "Compare captures 1 → 2 for trajectory"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ---------- RIGHT: report ---------- */}
          <div>
            {compareResult && <Trajectory data={compareResult} onClose={() => setCompareResult(null)} />}
            {current?.result ? <Report r={current.result} /> : (
              <div className="card"><div className="card-b empty">
                <div className="disp" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>No assessment yet</div>
                <div style={{ fontSize: 13, maxWidth: 380, margin: "0 auto", lineHeight: 1.55 }}>
                  Add a photograph, confirm the bedside context on the left, then run the assessment.
                  Findings the photograph cannot establish will be listed explicitly rather than omitted.
                </div>
              </div></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Report ---------------- */

function Report({ r }) {
  const gradeColor = { A: "#1C4A3C", B: "#3E7A63", C: "#2C5A78", D: "#0E1A16" }[r.imageQuality?.grade] || "#5C7268";
  const t = r.tissue || {};
  const segs = [
    { k: "granulation", v: t.granulation || 0, label: "Granulation" },
    { k: "slough", v: t.slough || 0, label: "Slough" },
    { k: "eschar", v: t.eschar || 0, label: "Eschar" },
    { k: "epithelial", v: t.epithelial || 0, label: "Epithelial" },
  ].filter((s) => s.v > 0);
  const cls = r.classification || {};
  const m = r.measurement || {};

  return (
    <div className="card">
      <div className="card-h">
        <span className="eyebrow">Assessment report</span>
        <div className="grade">
          <span className="eyebrow">Capture</span>
          <b style={{ background: gradeColor }}>{r.imageQuality?.grade || "—"}</b>
        </div>
      </div>
      <div className="card-b">

        {r._partial && (
          <div className="err" style={{ marginBottom: 13 }}>
            This report is incomplete — part of the response was cut short. Sections below are
            accurate as far as they go, but treat missing sections as unassessed rather than negative.
            Re-run to attempt a full report.
          </div>
        )}

        {r.imageQuality?.limitations?.length > 0 && (
          <div className="sec">
            <h3>Capture limitations</h3>
            {r.imageQuality.limitations.map((l, i) => <span key={i} className="chip">{l}</span>)}
            {!r.imageQuality.scaleReference && (
              <div className="mono" style={{ fontSize: 11.5, color: "var(--steel)", marginTop: 6 }}>
                ▲ No scale reference detected — absolute measurements withheld.
              </div>
            )}
            {r.imageQuality.privacyConcerns?.length > 0 && (
              <div className="mono" style={{ fontSize: 11.5, color: "var(--steel)", marginTop: 5 }}>
                ▲ Privacy: {r.imageQuality.privacyConcerns.join(", ")}
              </div>
            )}
          </div>
        )}

        {r.flags?.length > 0 && (
          <div className="sec">
            <h3>Escalation flags</h3>
            {r.flags.map((f, i) => (
              <div key={i} className={"flag " + (f.level || "refer")}>
                <div className="lv">{f.level}</div>
                <div style={{ fontSize: 13, fontWeight: 500, margin: "3px 0 2px" }}>{f.finding}</div>
                <div style={{ fontSize: 12, color: "var(--mute)" }}>{f.action}</div>
              </div>
            ))}
          </div>
        )}

        <div className="sec">
          <h3>Measurement</h3>
          {m.scaleAvailable ? (
            <div className="mono" style={{ fontSize: 15, letterSpacing: "-0.01em" }}>
              {m.lengthCm} × {m.widthCm} cm
              {m.areaCm2 && <span style={{ color: "var(--mute)", fontSize: 12 }}>  ·  area {m.areaCm2} cm²</span>}
            </div>
          ) : (
            <div className="void">
              <div className="eyebrow" style={{ color: "#3A4C44" }}>Withheld — no scale reference</div>
              <div className="mono" style={{ fontSize: 12, marginTop: 5 }}>Aspect ratio {m.aspectRatio || "—"}</div>
            </div>
          )}
          {m.note && <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 6 }}>{m.note}</div>}
        </div>

        <div className="sec">
          <h3>Wound bed</h3>
          {segs.length > 0 ? (
            <>
              <div className="bar">
                {segs.map((s) => (
                  <div key={s.k} style={{ width: s.v + "%", background: TISSUE_COLORS[s.k] }}>
                    {s.v >= 12 ? s.v + "%" : ""}
                  </div>
                ))}
              </div>
              <div className="legend">
                {segs.map((s) => (
                  <span key={s.k}><i style={{ background: TISSUE_COLORS[s.k] }} />{s.label} <b className="mono">{s.v}%</b></span>
                ))}
              </div>
            </>
          ) : <div style={{ fontSize: 13, color: "var(--mute)" }}>Tissue composition not resolvable from this capture.</div>}

          <div style={{ marginTop: 10 }}>
            {t.granulationQuality && <div className="kv"><span className="k">Granulation</span><span className="v">{t.granulationQuality}</span></div>}
            {t.escharState && t.escharState !== "n/a" && <div className="kv"><span className="k">Eschar state</span><span className="v">{t.escharState}</span></div>}
            {t.exposedStructures?.length > 0 && <div className="kv"><span className="k">Exposed</span><span className="v">{t.exposedStructures.join(", ")}</span></div>}
            {t.note && <div className="kv"><span className="k">Note</span><span className="v">{t.note}</span></div>}
          </div>
        </div>

        <Findings title="Wound edges" data={r.edges} />
        <Findings title="Periwound skin" data={r.periwound} extra={r.periwound?.erythemaExtentCm ? `Erythema extends ${r.periwound.erythemaExtentCm} cm` : null} />

        {r.moisture && (
          <div className="sec"><h3>Moisture</h3>
            <span className="chip mono">{r.moisture.state}</span>
            {r.moisture.note && <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 4 }}>{r.moisture.note}</div>}
          </div>
        )}

        {r.infection && (
          <div className="sec"><h3>Infection screen</h3>
            <div className="kv"><span className="k">NERDS</span><span className="v">{r.infection.nerdsPresent?.length ? r.infection.nerdsPresent.join(", ") : "None identified from image"}</span></div>
            <div className="kv"><span className="k">STONEES</span><span className="v">{r.infection.stoneesPresent?.length ? r.infection.stoneesPresent.join(", ") : "None identified from image"}</span></div>
            {r.infection.assessment && <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 6 }}>{r.infection.assessment}</div>}
          </div>
        )}

        <div className="sec">
          <h3>Proposed classification</h3>
          <div className="kv"><span className="k">Etiology</span>
            <span className="v">{cls.etiology} <span className={"conf " + (cls.etiologyConfidence || "low")}>{cls.etiologyConfidence}</span></span></div>
          <div className="kv"><span className="k">Stage</span>
            <span className="v">{cls.stagingApplicable ? <>{cls.stage} <span className={"conf " + (cls.stageConfidence || "low")}>{cls.stageConfidence}</span></>
              : <span style={{ color: "var(--mute)" }}>Not applicable — staging is for pressure injuries only</span>}</span></div>
          {cls.differential?.length > 0 && <div className="kv"><span className="k">Differential</span><span className="v">{cls.differential.join(" · ")}</span></div>}
          {cls.rationale && <div className="kv"><span className="k">Rationale</span><span className="v">{cls.rationale}</span></div>}
          <div className="mono" style={{ fontSize: 11, color: "var(--steel)", marginTop: 7, letterSpacing: ".04em" }}>
            → REQUIRES CLINICIAN CONFIRMATION
          </div>
        </div>

        {r.cannotDetermine?.length > 0 && (
          <div className="sec">
            <h3>Cannot be determined from this image</h3>
            <div className="void">
              <div style={{ fontSize: 12, color: "#3A4C44" }}>Capture at the bedside — these are not obtainable from a photograph.</div>
              <ul>{r.cannotDetermine.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          </div>
        )}

        {r.push && (
          <div className="sec"><h3>PUSH score</h3>
            {r.push.computable
              ? <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{r.push.score}<span style={{ fontSize: 12, color: "var(--mute)", fontWeight: 400 }}> / 17</span></div>
              : <div style={{ fontSize: 12.5, color: "var(--mute)" }}>Not computable. Missing: <span className="mono">{r.push.missingInputs?.join(", ")}</span></div>}
          </div>
        )}

        {r.nextCapture?.length > 0 && (
          <div className="sec"><h3>Improve the next capture</h3>
            <ul style={{ margin: 0, paddingLeft: 17 }}>
              {r.nextCapture.map((n, i) => <li key={i} style={{ fontSize: 12.5, marginBottom: 3 }}>{n}</li>)}
            </ul>
          </div>
        )}

        <div className="foot">
          Documentation support based on visible features only. Hands-on assessment by a qualified wound
          clinician is required for diagnosis and treatment decisions.
        </div>
      </div>
    </div>
  );
}

function Findings({ title, data, extra }) {
  if (!data) return null;
  return (
    <div className="sec">
      <h3>{title}</h3>
      {data.findings?.length ? data.findings.map((f, i) => <span key={i} className="chip">{f}</span>)
        : <span style={{ fontSize: 13, color: "var(--mute)" }}>No abnormal findings identified.</span>}
      {extra && <div className="mono" style={{ fontSize: 11.5, marginTop: 5 }}>{extra}</div>}
      {data.note && <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 5 }}>{data.note}</div>}
    </div>
  );
}

/* ---------------- Trajectory ---------------- */

function Trajectory({ data, onClose }) {
  return (
    <div className="card" style={{ marginBottom: 14, borderColor: "var(--pine)", borderWidth: 1.5 }}>
      <div className="card-h" style={{ background: "#F2F7F4" }}>
        <span className="eyebrow">Healing trajectory — capture 1 → 2</span>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--mute)", fontSize: 16, lineHeight: 1, padding: 0 }} aria-label="Dismiss">×</button>
      </div>
      <div className="card-b">
        {!data.comparable ? (
          <div className="void">
            <div className="eyebrow" style={{ color: "#3A4C44" }}>Not comparable</div>
            <div style={{ fontSize: 13, marginTop: 5 }}>{data.comparabilityNote}</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 9, flexWrap: "wrap" }}>
              <div className="mono" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {data.areaChangePercent != null ? (data.areaChangePercent > 0 ? "+" : "") + data.areaChangePercent + "%" : "—"}
              </div>
              <div className="eyebrow">area {data.areaDirection}{!data.absoluteMeasurement && " · relative estimate"}</div>
            </div>
            {data.belowHealingThreshold === true && (
              <div className="flag urgent"><div className="lv">Below 4-week benchmark</div>
                <div style={{ fontSize: 12.5, marginTop: 3 }}>{data.thresholdNote}</div></div>
            )}
            <div className="kv"><span className="k">Tissue shift</span><span className="v">{data.tissueShift}</span></div>
            <div className="kv"><span className="k">Interpretation</span><span className="v">{data.interpretation}</span></div>
            {data.recommendedActions?.length > 0 && (
              <div style={{ marginTop: 9 }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>Consider</div>
                <ul style={{ margin: 0, paddingLeft: 17 }}>
                  {data.recommendedActions.map((a, i) => <li key={i} style={{ fontSize: 12.5, marginBottom: 3 }}>{a}</li>)}
                </ul>
              </div>
            )}
            {data.comparabilityNote && <div className="foot">{data.comparabilityNote}</div>}
          </>
        )}
      </div>
    </div>
  );
}
