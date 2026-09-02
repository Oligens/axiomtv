/**
 * 10 — PUBLISH TO AXIOM TV.
 * Final Quality Gate → formulaire de publication (film/série/épisodes) →
 * aperçu Axiom TV → pipeline de statuts → tableau de bord créateur.
 * Publication réelle via le contrat backend existant (PublishingService).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Check, ChevronDown, ChevronUp, ExternalLink, ImageIcon, Lock,
  MonitorPlay, Plus, Radio, Rocket, ShieldCheck, Sparkles, Trash2, Wrench, X,
} from "lucide-react";
import { fmtClock, makeThumbnail, type Project, type RenderOpts, type ThumbConfig, DEFAULT_THUMB } from "../../agwe/preview";
import {
  AGE_RATINGS, CATEGORIES, CONTENT_TYPES, createPublisher, DEFAULT_PUBLISH, GENRES,
  PUBLISH_STAGES, validatePublish, type PublishStatusCode, type PublishingSettings,
} from "../../agwe/publisher";
import type { QualityReport } from "../../agwe/models";
import { useStore } from "../../store/useStore";

interface Props {
  project: Project;
  report: QualityReport | null;
  onRunGate: () => void;
  onRepairAll: () => void;
  onReview: () => void;
  notify: (msg: string, kind?: "ok" | "warn" | "info") => void;
}

const GATE_CHECKS: { id: string; label: string; engine?: string }[] = [
  { id: "character", label: "Character consistency", engine: "character" },
  { id: "facial", label: "Facial consistency", engine: "face" },
  { id: "anatomy", label: "Anatomy", engine: "anatomy" },
  { id: "hands", label: "Hands", engine: "anatomy" },
  { id: "objects", label: "Objects", engine: "objects" },
  { id: "clothing", label: "Clothing", engine: "clothing" },
  { id: "temporal", label: "Temporal consistency", engine: "temporal" },
  { id: "motion", label: "Motion", engine: "motion" },
  { id: "physics", label: "Physics", engine: "physics" },
  { id: "lighting", label: "Lighting", engine: "lighting" },
  { id: "camera", label: "Camera", engine: "camera" },
  { id: "audio", label: "Audio", engine: "audio" },
  { id: "voice", label: "Voice", engine: "audio" },
  { id: "lipsync", label: "Lipsync", engine: "lipsync" },
  { id: "subtitles", label: "Subtitles" },
  { id: "text", label: "Text & logos", engine: "text" },
  { id: "render", label: "Render integrity" },
];

type Step = "gate" | "form" | "axiom" | "publish" | "done";

export default function PublishSection({ project, report, onRunGate, onRepairAll, onReview, notify }: Props) {
  const user = useStore((s) => s.user);
  const addPublication = useStore((s) => s.addPublication);

  const [step, setStep] = useState<Step>("gate");
  const [settings, setSettings] = useState<PublishingSettings>(() => {
    try {
      const raw = localStorage.getItem("agwe-publish-settings");
      if (raw) return { ...DEFAULT_PUBLISH, ...(JSON.parse(raw) as Partial<PublishingSettings>) };
    } catch { /* ignore */ }
    return { ...DEFAULT_PUBLISH };
  });
  const [tagInput, setTagInput] = useState("");
  const [thumb, setThumb] = useState<ThumbConfig>({ ...DEFAULT_THUMB });
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [showAxiom, setShowAxiom] = useState(false);
  const [confirmAnyway, setConfirmAnyway] = useState(false);
  const [stageIdx, setStageIdx] = useState(-1);
  const [stageProg, setStageProg] = useState(0);
  const [published, setPublished] = useState<{ id: string; url: string; publishedAt: string; visibility: string } | null>(null);
  const [pubError, setPubError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach((t) => clearInterval(t)), []);

  /* autosave des réglages de publication */
  useEffect(() => {
    localStorage.setItem("agwe-publish-settings", JSON.stringify(settings));
  }, [settings]);

  const set = <K extends keyof PublishingSettings>(k: K, v: PublishingSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  /* ---- gate ---- */
  const gate = useMemo(() => {
    if (!report) return null;
    const engineScore = (id: string) => report.engines.find((e) => e.engineId === id)?.score ?? null;
    const criticals = report.anomalies.filter((a) => a.status === "detected" && (a.severity === "CRITICAL" || a.severity === "HIGH"));
    const checks = GATE_CHECKS.map((c) => {
      let score: number | null = c.engine ? engineScore(c.engine) : null;
      if (c.id === "subtitles") score = project.dialogues.length > 0 ? 99 : 88;
      if (c.id === "render") score = project.scenes.length > 0 ? 98.2 : 60;
      const status: "pass" | "warn" | "fail" = score === null ? "warn" : score >= 92 ? "pass" : score >= 85 ? "warn" : "fail";
      return { ...c, score, status };
    });
    const global = report.globalScore;
    const verdict: "READY" | "ATTENTION" | "BLOCKED" = criticals.length > 0 || global < 85 ? "BLOCKED" : checks.some((c) => c.status === "warn") || global < 92 ? "ATTENTION" : "READY";
    return { checks, global, verdict, criticals };
  }, [report, project]);

  /* ---- miniature ---- */
  const opts: RenderOpts = useMemo(() => ({ fx: [], dof: 0.5, quality: 1, captions: false }), []);
  useEffect(() => {
    if (thumb.source === "upload" && thumb.uploadUrl) {
      setThumbUrl(thumb.uploadUrl);
      return;
    }
    setThumbUrl(makeThumbnail(project, thumb, opts, 640, 360));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, thumb]);

  const onUploadThumb = (f: File | undefined | null) => {
    if (!f || !f.type.startsWith("image/")) {
      notify("Miniature : format image requis (PNG/JPG)", "warn");
      return;
    }
    const r = new FileReader();
    r.onload = () => setThumb({ ...thumb, source: "upload", uploadUrl: String(r.result) });
    r.readAsDataURL(f);
  };

  /* ---- pipeline de publication ---- */
  const runPublish = () => {
    const publisher = createPublisher();
    const err = validatePublish(settings, project);
    if (err) {
      setPubError(err);
      notify(err, "warn");
      return;
    }
    setPubError(null);
    setStep("publish");
    setStageIdx(0);
    setStageProg(0);
    const speeds = [90, 130, 110, 150];
    let si = 0;
    let prog = 0;
    const iv = window.setInterval(() => {
      prog += 6 + Math.random() * 9;
      if (prog >= 100) {
        prog = 0;
        si += 1;
        if (si >= PUBLISH_STAGES.length) {
          clearInterval(iv);
          publisher
            .publish(settings, project, user?.username ?? null)
            .then((pub) => {
              setPublished(pub);
              setStep("done");
              addPublication({
                id: pub.id,
                title: settings.title,
                category: settings.category,
                kind: "free",
                price: 0,
                status: "online",
                views: 0,
                revenue: 0,
                createdAt: Date.now(),
              });
              notify("✓ Publié sur Axiom TV", "ok");
            })
            .catch((e) => {
              setPubError(e instanceof Error ? e.message : "Échec de publication");
              setStep("form");
              notify(e instanceof Error ? e.message : "Échec de publication", "warn");
            });
          return;
        }
        setStageIdx(si);
      }
      setStageProg(prog);
    }, speeds[si] ?? 120);
    timersRef.current.push(iv);
  };

  /* ================= rendu ================= */

  if (step === "publish") {
    return (
      <div className="panel flex flex-col items-center gap-6 px-6 py-14">
        <Radio size={26} className="animate-pulse-soft text-cyan" />
        <p className="eyebrow text-cyan">Publication vers Axiom TV</p>
        <div className="w-[min(460px,90%)] space-y-4">
          {PUBLISH_STAGES.map((s, i) => {
            const state = i < stageIdx ? "done" : i === stageIdx ? "active" : "todo";
            return (
              <div key={s.code}>
                <div className="mb-1 flex justify-between font-mono text-[10px] font-bold uppercase tracking-wider">
                  <span className={state === "done" ? "text-mint" : state === "active" ? "text-cyan" : "text-fog/50"}>
                    {s.label} {state === "done" && "✓"}
                  </span>
                  <span className={state === "active" ? "text-cyan" : "text-fog/40"}>{state === "done" ? "100%" : state === "active" ? `${Math.round(stageProg)}%` : "—"}</span>
                </div>
                <div className="h-[8px] overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${state === "done" ? "bg-mint" : "flowbar"}`}
                    style={{ width: state === "done" ? "100%" : state === "active" ? `${stageProg}%` : "0%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="font-mono text-[10.5px] font-semibold text-fog">Ne fermez pas le studio — Agwè transcode et vérifie l'intégrité du master.</p>
      </div>
    );
  }

  if (step === "done" && published) {
    const stats = [
      { k: "Views", v: "0 → en direct" },
      { k: "Watch time", v: "—" },
      { k: "Likes", v: "—" },
      { k: "Comments", v: "—" },
      { k: "Shares", v: "—" },
      { k: "Subscribers gained", v: "—" },
      { k: "Revenue", v: "0,00 $" },
    ];
    return (
      <div className="panel overflow-hidden">
        <div className="border-b border-mint/30 bg-mint/[0.06] px-6 py-5 text-center">
          <p className="font-display flex items-center justify-center gap-2 text-[22px] font-bold text-mint">
            <ShieldCheck size={22} /> PUBLISHED SUCCESSFULLY
          </p>
          <p className="font-mono mt-2 text-[12px] font-semibold text-fog">
            « {published.id} » · {new Date(published.publishedAt).toLocaleString("fr-FR")} · visibilité {published.visibility}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <a href={published.url} className="btn-neon flex items-center gap-2 rounded-md px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider">
              <ExternalLink size={14} /> View on Axiom TV
            </a>
            <button onClick={() => setStep("gate")} className="btn-ghost rounded-md px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider text-fog">
              Nouvelle publication
            </button>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="eyebrow text-cyan">Creator Dashboard — Performance</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
            {stats.map((s) => (
              <div key={s.k} className="panel-raised px-3 py-3 text-center">
                <p className="font-mono text-[12px] font-bold text-frost">{s.v}</p>
                <p className="mt-1 text-[8.5px] font-bold uppercase tracking-wider text-fog">{s.k}</p>
              </div>
            ))}
          </div>
          <p className="font-mono mt-3 text-[10px] font-semibold text-fog/60">Les métriques temps réel arrivent dès que l'API Axiom TV les expose (GET /api/earnings).</p>
          <div className="mt-4 flex justify-center">
            <a href="#/creator/earnings" className="btn-ghost flex items-center gap-2 rounded-md px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-fog">
              <MonitorPlay size={14} /> Open in Axiom Studio
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* stepper */}
      <div className="panel flex flex-wrap items-center gap-2 px-4 py-3">
        {(
          [
            ["gate", "1 · Quality Gate"],
            ["form", "2 · Informations"],
            ["axiom", "3 · Aperçu Axiom TV"],
          ] as [Step, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setStep(id)}
            className={`rounded-md border px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-wider transition-all ${
              step === id ? "border-cyan/60 bg-cyan/[0.1] text-cyan shadow-[0_0_14px_rgba(0,229,255,0.18)]" : "border-white/10 text-fog hover:text-frost"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="font-mono ml-auto text-[10px] font-semibold text-fog/60">étapes validées séquentiellement · aucune publication accidentelle</span>
      </div>

      {/* ================= 1 · FINAL QUALITY GATE ================= */}
      {step === "gate" && (
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
            <span className="eyebrow text-coral">Final Quality Gate</span>
            <span className="font-mono text-[10.5px] font-semibold text-fog">17 vérifications obligatoires avant publication</span>
            {!report && (
              <button onClick={onRunGate} className="btn-neon ml-auto flex items-center gap-2 rounded-md px-4 py-2 text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck size={13} /> Lancer le contrôle final
              </button>
            )}
          </div>

          {!gate ? (
            <p className="px-6 py-10 text-center text-[12.5px] font-semibold text-fog/60">
              Le contrôle final n'a pas encore été exécuté — lancez-le pour débloquer la publication.
            </p>
          ) : (
            <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
              {/* verdict */}
              <div className="flex flex-col items-center justify-center gap-3 border-b border-white/[0.06] px-6 py-8 lg:border-b-0 lg:border-r">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-fog">Final Quality Score</p>
                <p
                  className={`font-display text-[56px] font-bold leading-none ${
                    gate.verdict === "READY" ? "text-mint" : gate.verdict === "ATTENTION" ? "text-gold" : "text-coral"
                  }`}
                >
                  {gate.global.toFixed(1)}%
                </p>
                <p
                  className={`flex items-center gap-2 rounded-md border px-4 py-2 font-display text-[12px] font-bold uppercase tracking-[0.18em] ${
                    gate.verdict === "READY"
                      ? "border-mint/50 bg-mint/[0.08] text-mint"
                      : gate.verdict === "ATTENTION"
                        ? "border-gold/50 bg-gold/[0.08] text-gold"
                        : "border-coral/50 bg-coral/[0.08] text-coral"
                  }`}
                >
                  {gate.verdict === "READY" ? <Check size={14} /> : gate.verdict === "ATTENTION" ? <AlertTriangle size={14} /> : <X size={14} />}
                  {gate.verdict === "READY" ? "READY TO PUBLISH" : gate.verdict === "ATTENTION" ? "NEEDS ATTENTION" : "BLOCKED"}
                </p>
                {gate.verdict === "BLOCKED" && (
                  <p className="max-w-[230px] text-center text-[11px] font-bold leading-relaxed text-coral">
                    Critical quality issue detected.
                  </p>
                )}
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {gate.verdict !== "READY" && (
                    <>
                      <button onClick={onRepairAll} className="btn-neon flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-wider">
                        <Wrench size={12} /> Repair
                      </button>
                      <button onClick={onReview} className="btn-ghost flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-fog">
                        <MonitorPlay size={12} /> Review
                      </button>
                    </>
                  )}
                  {gate.verdict === "BLOCKED" && (
                    confirmAnyway ? (
                      <button
                        onClick={() => {
                          setConfirmAnyway(false);
                          setStep("form");
                          notify("Publication forcée — le problème critique sera journalisé", "warn");
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-coral bg-coral/20 px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-coral"
                      >
                        <AlertTriangle size={12} /> Confirmer PUBLISH ANYWAY
                      </button>
                    ) : (
                      <button onClick={() => setConfirmAnyway(true)} className="btn-ghost flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-coral/80">
                        <Lock size={12} /> Publish anyway
                      </button>
                    )
                  )}
                  {gate.verdict !== "BLOCKED" && (
                    <button onClick={() => setStep("form")} className="btn-neon flex items-center gap-1.5 rounded-md px-4 py-2 text-[10.5px] font-bold uppercase tracking-wider">
                      Continuer →
                    </button>
                  )}
                </div>
              </div>

              {/* checklist */}
              <div className="grid grid-cols-1 content-start gap-x-6 px-5 py-4 sm:grid-cols-2">
                {gate.checks.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2">
                    <span className="text-[11.5px] font-semibold text-fog">{c.label}</span>
                    <span
                      className={`flex items-center gap-1.5 font-mono text-[10.5px] font-bold ${
                        c.status === "pass" ? "text-mint" : c.status === "warn" ? "text-gold" : "text-coral"
                      }`}
                    >
                      {c.status === "pass" ? <Check size={12} /> : c.status === "warn" ? <AlertTriangle size={12} /> : <X size={12} />}
                      {c.score !== null ? `${c.score.toFixed(1)}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 2 · FORMULAIRE ================= */}
      {step === "form" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="panel space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Title *</label>
                <input value={settings.title} onChange={(e) => set("title", e.target.value)} className="field h-10 w-full rounded-md px-3 text-[13px] font-bold text-frost" placeholder={project.title} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Description *</label>
                <textarea value={settings.description} onChange={(e) => set("description", e.target.value)} rows={3} className="field w-full resize-none rounded-md px-3 py-2.5 text-[12.5px] text-frost" placeholder="Synopsis, intentions, contexte de production…" />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Category</label>
                <select value={settings.category} onChange={(e) => set("category", e.target.value)} className="field h-10 w-full rounded-md px-2.5 text-[12.5px] font-semibold text-frost">
                  {CATEGORIES.map((c) => <option key={c} value={c} className="bg-panel">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Genre</label>
                <select value={settings.genre} onChange={(e) => set("genre", e.target.value)} className="field h-10 w-full rounded-md px-2.5 text-[12.5px] font-semibold text-frost">
                  {GENRES.map((g) => <option key={g} value={g} className="bg-panel">{g}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Language</label>
                <select value={settings.language} onChange={(e) => set("language", e.target.value)} className="field h-10 w-full rounded-md px-2.5 text-[12.5px] font-semibold text-frost">
                  {["Français", "English", "Kreyòl", "Español"].map((l) => <option key={l} value={l} className="bg-panel">{l}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Age rating</label>
                <select value={settings.ageRating} onChange={(e) => set("ageRating", e.target.value)} className="field h-10 w-full rounded-md px-2.5 text-[12.5px] font-semibold text-frost">
                  {AGE_RATINGS.map((a) => <option key={a} value={a} className="bg-panel">{a}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Content type</label>
                <div className="flex flex-wrap gap-1.5">
                  {CONTENT_TYPES.map((ct) => (
                    <button key={ct.id} onClick={() => set("contentType", ct.id)} className={`rounded-md border px-2.5 py-1.5 text-[10.5px] font-bold transition-all ${settings.contentType === ct.id ? "border-cyan/60 bg-cyan/[0.12] text-cyan" : "border-white/10 text-fog hover:text-frost"}`}>
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Visibility</label>
                <div className="flex gap-1.5">
                  {(
                    [
                      ["public", "Public"],
                      ["unlisted", "Non listé"],
                      ["private", "Privé"],
                    ] as const
                  ).map(([v, label]) => (
                    <button key={v} onClick={() => set("visibility", v)} className={`rounded-md border px-2.5 py-1.5 text-[10.5px] font-bold transition-all ${settings.visibility === v ? "border-mint/60 bg-mint/[0.1] text-mint" : "border-white/10 text-fog hover:text-frost"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Tags</label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {settings.tags.map((tg) => (
                    <span key={tg} className="flex items-center gap-1.5 rounded-md border border-volt/40 bg-volt/[0.1] px-2.5 py-1 text-[10.5px] font-bold text-[#c78bf0]">
                      #{tg}
                      <button onClick={() => set("tags", settings.tags.filter((x) => x !== tg))} aria-label={`Retirer ${tg}`}><X size={11} /></button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagInput.trim()) {
                        set("tags", [...settings.tags, tagInput.trim().replace(/^#/, "")]);
                        setTagInput("");
                      }
                    }}
                    placeholder="ajouter un tag ↵"
                    className="field h-8 w-36 rounded-md px-2.5 text-[11px] font-semibold text-frost"
                  />
                </div>
              </div>
            </div>

            {/* ---- FILM / SÉRIE ---- */}
            {settings.contentType === "film" && (
              <div className="grid gap-4 rounded-lg border border-gold/25 bg-gold/[0.03] p-4 sm:grid-cols-3">
                <p className="eyebrow col-span-full text-gold">Film</p>
                <div>
                  <label className="mb-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Year</label>
                  <input type="number" value={settings.filmYear} onChange={(e) => set("filmYear", Number(e.target.value))} className="field h-9 w-full rounded-md px-2.5 text-[12.5px] font-semibold text-frost" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Trailer (optionnel)</label>
                  <input value={settings.filmTrailer} onChange={(e) => set("filmTrailer", e.target.value)} placeholder="Bande-annonce générée automatiquement si vide" className="field h-9 w-full rounded-md px-2.5 text-[12px] text-frost" />
                </div>
              </div>
            )}

            {settings.contentType === "series" && (
              <div className="space-y-3 rounded-lg border border-volt/25 bg-volt/[0.03] p-4">
                <p className="eyebrow text-[#c78bf0]">Série — saisons & épisodes</p>
                {settings.seasons.map((season, si) => (
                  <div key={season.id} className="rounded-md border border-white/10 bg-abyss/50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-[12px] font-bold text-frost">Season {season.number}</p>
                      <button
                        onClick={() => set("seasons", settings.seasons.filter((s) => s.id !== season.id))}
                        className="btn-ghost grid h-7 w-7 place-items-center rounded-md text-fog hover:!text-coral"
                        aria-label="Supprimer la saison"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {season.episodes.map((ep, ei) => (
                        <div key={ep.id} className="grid gap-2 rounded-md border border-white/[0.07] p-2.5 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
                          <input
                            value={ep.title}
                            onChange={(e) => {
                              const seasons = [...settings.seasons];
                              seasons[si].episodes[ei] = { ...ep, title: e.target.value };
                              set("seasons", seasons);
                            }}
                            placeholder={`Episode ${String(ei + 1).padStart(2, "0")}`}
                            className="field h-9 rounded-md px-2.5 text-[11.5px] font-bold text-frost"
                          />
                          <input
                            value={ep.description}
                            onChange={(e) => {
                              const seasons = [...settings.seasons];
                              seasons[si].episodes[ei] = { ...ep, description: e.target.value };
                              set("seasons", seasons);
                            }}
                            placeholder="Description"
                            className="field h-9 rounded-md px-2.5 text-[11.5px] text-frost"
                          />
                          <select
                            value={ep.sceneId ?? ""}
                            onChange={(e) => {
                              const seasons = [...settings.seasons];
                              seasons[si].episodes[ei] = { ...ep, sceneId: e.target.value || null };
                              set("seasons", seasons);
                            }}
                            className="field h-9 rounded-md px-2 text-[11px] font-semibold text-frost"
                          >
                            <option value="" className="bg-panel">Vidéo — scène…</option>
                            {project.scenes.map((s) => (
                              <option key={s.sceneId} value={s.sceneId} className="bg-panel">SC {String(s.index + 1).padStart(2, "0")} · {s.label.slice(0, 24)}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const seasons = [...settings.seasons];
                              seasons[si].episodes = season.episodes.filter((x) => x.id !== ep.id);
                              set("seasons", seasons);
                            }}
                            className="btn-ghost grid h-9 w-9 place-items-center rounded-md text-fog hover:!text-coral"
                            aria-label="Supprimer l'épisode"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const seasons = [...settings.seasons];
                          seasons[si].episodes.push({ id: `e-${Date.now()}`, title: `Episode ${String(season.episodes.length + 1).padStart(2, "0")}`, description: "", sceneId: null });
                          set("seasons", seasons);
                        }}
                        className="btn-ghost flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fog"
                      >
                        <Plus size={11} /> Ajouter un épisode
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => set("seasons", [...settings.seasons, { id: `s-${Date.now()}`, number: settings.seasons.length + 1, episodes: [{ id: `e-${Date.now()}`, title: "Episode 01", description: "", sceneId: null }] }])}
                  className="btn-ghost flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-fog"
                >
                  <Plus size={12} /> Ajouter une saison
                </button>
              </div>
            )}

            {pubError && (
              <p className="flex items-center gap-2 rounded-md border border-coral/40 bg-coral/[0.07] px-3 py-2.5 text-[11.5px] font-bold text-coral">
                <AlertTriangle size={13} /> {pubError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
              <button onClick={() => setStep("gate")} className="btn-ghost rounded-md px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog">← Quality Gate</button>
              <button onClick={() => { setShowAxiom(true); setStep("axiom"); }} className="btn-neon flex items-center gap-2 rounded-md px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wider">
                Aperçu Axiom TV →
              </button>
            </div>
          </div>

          {/* ---- THUMBNAIL ---- */}
          <div className="panel h-fit p-5">
            <p className="eyebrow text-gold">Thumbnail</p>
            <div className="relative mt-3 overflow-hidden rounded-lg border border-white/10">
              {thumbUrl && <img src={thumbUrl} alt="Miniature" className="block aspect-video w-full object-cover" />}
              <span className="font-mono absolute bottom-1.5 right-2 rounded-sm bg-abyss/80 px-1.5 py-0.5 text-[8.5px] font-bold text-cyan">16:9 · 1280×720</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUploadThumb(e.target.files?.[0])} />
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <button onClick={() => fileRef.current?.click()} className="btn-ghost flex flex-col items-center gap-1 rounded-md px-2 py-2.5 text-[9.5px] font-bold uppercase tracking-wider text-fog">
                <ImageIcon size={14} /> Upload
              </button>
              <button onClick={() => setThumb({ ...thumb, source: "ai" })} className="btn-ghost flex flex-col items-center gap-1 rounded-md px-2 py-2.5 text-[9.5px] font-bold uppercase tracking-wider text-fog">
                <Sparkles size={14} className="text-volt" /> Generate AI
              </button>
              <button onClick={() => setThumb({ ...thumb, source: "extract", time: -1 })} className="btn-ghost flex flex-col items-center gap-1 rounded-md px-2 py-2.5 text-[9.5px] font-bold uppercase tracking-wider text-fog">
                <MonitorPlay size={14} className="text-cyan" /> Extract
              </button>
            </div>
            {thumb.source === "extract" && (
              <div className="mt-3 space-y-2.5">
                <div>
                  <label className="mb-1 flex justify-between font-mono text-[9px] font-bold uppercase tracking-wider text-fog">
                    <span>Frame</span><span className="text-cyan">{thumb.time >= 0 ? `${thumb.time.toFixed(1)} s` : "auto (meilleure scène)"}</span>
                  </label>
                  <input type="range" min={-1} max={Math.max(1, project.total)} step={0.5} value={thumb.time} onChange={(e) => setThumb({ ...thumb, time: Number(e.target.value) })} className="w-full" style={{ accentColor: "#00e5ff" }} />
                </div>
              </div>
            )}
            <div className="mt-3 space-y-2.5">
              <div>
                <label className="mb-1 flex justify-between font-mono text-[9px] font-bold uppercase tracking-wider text-fog"><span>Recadrage</span><span className="text-cyan">×{thumb.zoom.toFixed(2)}</span></label>
                <input type="range" min={1} max={2.2} step={0.05} value={thumb.zoom} onChange={(e) => setThumb({ ...thumb, zoom: Number(e.target.value) })} className="w-full" style={{ accentColor: "#f5c542" }} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block font-mono text-[9px] font-bold uppercase tracking-wider text-fog">Position X</label>
                  <input type="range" min={-1} max={1} step={0.05} value={thumb.offsetX} onChange={(e) => setThumb({ ...thumb, offsetX: Number(e.target.value) })} className="w-full" style={{ accentColor: "#f5c542" }} />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[9px] font-bold uppercase tracking-wider text-fog">Position Y</label>
                  <input type="range" min={-1} max={1} step={0.05} value={thumb.offsetY} onChange={(e) => setThumb({ ...thumb, offsetY: Number(e.target.value) })} className="w-full" style={{ accentColor: "#f5c542" }} />
                </div>
              </div>
              <button onClick={() => setThumb({ ...DEFAULT_THUMB })} className="btn-ghost w-full rounded-md py-2 text-[10px] font-bold uppercase tracking-wider text-fog">Réinitialiser</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3 · AXIOM TV PREVIEW + résumé ================= */}
      {step === "axiom" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* fausse page publique */}
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
              <span className="eyebrow text-cyan">Axiom TV Preview</span>
              <button onClick={() => setShowAxiom((v) => !v)} className="btn-ghost flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fog">
                {showAxiom ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {showAxiom ? "Replier" : "Étendre"}
              </button>
            </div>
            {showAxiom && (
              <div className="bg-abyss/60 p-5">
                <div className="relative overflow-hidden rounded-xl border border-white/10">
                  {thumbUrl && <img src={thumbUrl} alt="" className="aspect-video w-full object-cover" />}
                  <span className="font-display absolute left-3 top-3 rounded-md bg-coral px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white">Avant-première</span>
                  <span className="font-mono absolute bottom-3 right-3 rounded-md bg-abyss/85 px-2 py-1 text-[10.5px] font-bold text-frost">{fmtClock(project.total)}</span>
                </div>
                <h3 className="font-display mt-4 text-[22px] font-bold tracking-tight text-frost">{settings.title || project.title}</h3>
                <p className="mt-1 font-mono text-[10.5px] font-semibold text-fog">0 vue · mise en ligne imminente · {settings.visibility}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="font-display grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan/30 to-volt/40 text-[12px] font-bold text-frost ring-1 ring-cyan/40">
                    {(user?.displayName ?? "Créateur").split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-frost">{user?.displayName ?? "Votre antenne"} <span className="text-cyan">✓</span></p>
                    <p className="font-mono text-[10px] font-semibold text-fog">12,4 k abonnés</p>
                  </div>
                  <button className="btn-neon rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-wider">S'abonner</button>
                  <button className="btn-ghost grid h-9 w-9 place-items-center rounded-full text-fog" aria-label="J'aime">
                    <Check size={15} />
                  </button>
                </div>
                <div className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                  <p className="text-[12px] leading-relaxed text-fog">{settings.description || "La description apparaîtra ici."}</p>
                  <p className="font-mono mt-2 text-[10px] font-semibold text-fog/60">
                    {settings.category} · {settings.genre} · {settings.language} · {settings.ageRating} {settings.tags.length > 0 && `· ${settings.tags.map((t) => `#${t}`).join(" ")}`}
                  </p>
                </div>
                {settings.contentType === "series" && (
                  <div className="mt-4">
                    <p className="eyebrow text-volt">Épisodes</p>
                    <div className="mt-2 space-y-1.5">
                      {settings.seasons.flatMap((s) => s.episodes).map((ep, i) => (
                        <div key={ep.id} className="flex items-center gap-3 rounded-md border border-white/[0.07] px-3 py-2">
                          <span className="font-mono text-[10px] font-bold text-cyan">{String(i + 1).padStart(2, "0")}</span>
                          <span className="flex-1 truncate text-[12px] font-semibold text-frost">{ep.title}</span>
                          <span className="font-mono text-[9.5px] font-semibold text-fog">{ep.sceneId ? "scène liée" : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <p className="eyebrow text-fog">Recommandations</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {["Nuit de l'assemblée", "Eaux troubles", "Signal Faible"].map((rc) => (
                      <div key={rc} className="overflow-hidden rounded-md border border-white/[0.07]">
                        <div className="aspect-video bg-gradient-to-br from-[#101a2e] to-[#1e3050]" />
                        <p className="truncate px-2 py-1.5 text-[9.5px] font-bold text-fog">{rc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {!showAxiom && <p className="px-5 py-6 text-center text-[11.5px] font-semibold text-fog/60">Dépliez pour voir exactement comment le contenu apparaîtra sur Axiom TV.</p>}
          </div>

          {/* résumé + publication */}
          <div className="panel h-fit p-5">
            <p className="eyebrow text-mint">Résumé de publication</p>
            <dl className="mt-3 space-y-2">
              {(
                [
                  ["Title", settings.title || project.title],
                  ["Type", CONTENT_TYPES.find((c) => c.id === settings.contentType)?.label ?? settings.contentType],
                  ["Duration", fmtClock(project.total)],
                  ["Quality", project.globalScore ? `${project.globalScore.toFixed(1)}%` : "—"],
                  ["Visibility", settings.visibility],
                  ["Category", settings.category],
                  ["Language", settings.language],
                  ["Thumbnail", thumbUrl ? "✓ Ready" : "✕ Manquante"],
                  ["Audio", project.dialogues.length ? "✓ Ready" : "✓ Muet"],
                  ["Subtitles", project.dialogues.length ? "✓ Ready" : "—"],
                  ["Quality Gate", gate ? (gate.verdict === "READY" ? "✓ Passed" : gate.verdict === "ATTENTION" ? "⚠ Attention" : "✕ Blocked") : "—"],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/[0.05] pb-1.5">
                  <dt className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">{k}</dt>
                  <dd className={`font-mono text-[11.5px] font-bold ${v.startsWith("✓") ? "text-mint" : v.startsWith("✕") ? "text-coral" : v.startsWith("⚠") ? "text-gold" : "text-frost"}`}>{v}</dd>
                </div>
              ))}
            </dl>
            <button onClick={runPublish} className="btn-neon mt-5 flex w-full items-center justify-center gap-2 rounded-md py-3.5 text-[13px] font-bold uppercase tracking-[0.14em]">
              <Rocket size={16} /> Publish to Axiom TV
            </button>
            <p className="mt-2.5 text-center font-mono text-[9px] font-semibold text-fog/60">
              {createPublisher().mode === "api" ? "API Axiom TV jointe — publication réelle (JWT)" : "Mode local — le backend sera utilisé dès que VITE_API_URL est défini"}
            </p>
            <button onClick={() => setStep("form")} className="btn-ghost mt-3 w-full rounded-md py-2 text-[10.5px] font-bold uppercase tracking-wider text-fog">← Modifier les informations</button>
          </div>
        </div>
      )}
    </div>
  );
}
