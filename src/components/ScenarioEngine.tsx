/**
 * Pilier 1 — Moteur de Scénario Global.
 * Zone multiligne étendue + analyse en direct : slugs de scène, répliques
 * préfixées par le nom du clone, indications de ton, actions.
 */
import { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Clapperboard, Eye, Link2, MessageSquare, Plus, Timer, Unlink, Users } from "lucide-react";
import { TONES, type ParsedLine, type Timeline } from "../data/content";
import { formatTime } from "../lib/scenario";

interface Props {
  script: string;
  onChange: (s: string) => void;
  parsed: ParsedLine[];
  timeline: Timeline;
  castNames: string[];
}

const SNIPPETS = [
  { label: "Réplique", icon: <MessageSquare size={12} />, text: "Nom (ton) : « Votre dialogue ici. »\n" },
  { label: "Scène", icon: <Clapperboard size={12} />, text: "[SCÈNE 3 — INT. LIEU — NUIT]\n" },
  { label: "Action", icon: <Eye size={12} />, text: "(Description visuelle de l'action.)\n" },
];

export default function ScenarioEngine({ script, onChange, parsed, timeline, castNames }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  const stats = useMemo(() => {
    const scenes = parsed.filter((l) => l.kind === "scene").length;
    const lines = parsed.filter((l) => l.kind === "dialogue");
    const names = new Map<string, number>();
    for (const l of lines) if (l.name) names.set(l.name, (names.get(l.name) ?? 0) + 1);
    return { scenes, dialogues: lines.length, names: [...names.entries()] };
  }, [parsed]);

  const insert = (snippet: string) => {
    const ta = taRef.current;
    if (!ta) {
      onChange(script + snippet);
      return;
    }
    const pos = ta.selectionStart ?? script.length;
    onChange(script.slice(0, pos) + snippet + script.slice(pos));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = pos + snippet.length;
    });
  };

  const linked = (name: string) => castNames.some((c) => c.trim().toLowerCase() === name.trim().toLowerCase());
  const lineCount = script.split("\n").length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.12fr_1fr]">
      {/* ---- Éditeur ---- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45 }}
        className="panel flex flex-col overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <span className="eyebrow text-cyan">Éditeur de scénario</span>
          <span className="ml-auto flex gap-1.5">
            {SNIPPETS.map((s) => (
              <button
                key={s.label}
                onClick={() => insert(s.text)}
                className="chip flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-fog"
                title={`Insérer : ${s.text.trim()}`}
              >
                <Plus size={11} /> {s.label}
              </button>
            ))}
          </span>
        </div>
        <div className="relative flex-1">
          <div className="font-mono pointer-events-none absolute bottom-3 left-4 select-none text-[10px] font-semibold text-fog/50">
            {lineCount} lignes · format [Nom] (ton) : « réplique »
          </div>
          <textarea
            ref={taRef}
            value={script}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className="field font-mono h-[380px] w-full resize-y rounded-none border-0 bg-transparent p-4 pb-9 text-[12.5px] leading-[1.75] text-frost focus:shadow-none sm:h-[420px]"
            placeholder={"[SCÈNE 1 — INT. LIEU — NUIT]\nNom (ton, indication) : « Votre réplique… »"}
          />
        </div>
      </motion.div>

      {/* ---- Analyse en direct ---- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="panel flex flex-col overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <span className="eyebrow text-volt">Analyse en direct</span>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] font-semibold text-mint">
            <Timer size={12} /> {formatTime(timeline.total)}
          </span>
        </div>

        {/* statistiques */}
        <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.06]">
          {[
            { v: stats.scenes, l: "Scènes" },
            { v: stats.dialogues, l: "Répliques" },
            { v: stats.names.length, l: "Personnages" },
          ].map((s) => (
            <div key={s.l} className="px-4 py-3">
              <p className="font-display text-[24px] font-bold leading-none text-frost">{s.v}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-fog">{s.l}</p>
            </div>
          ))}
        </div>

        {/* personnages détectés + liaison aux clones */}
        <div className="border-b border-white/[0.06] px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-fog">
            <Users size={12} /> Noms dans le scénario → liaison casting
          </p>
          {stats.names.length === 0 ? (
            <p className="text-[11.5px] font-semibold text-fog/60">Aucune réplique détectée pour l'instant.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {stats.names.map(([name, count]) => {
                const ok = linked(name);
                return (
                  <span
                    key={name}
                    className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold"
                    style={{
                      borderColor: ok ? "rgba(52,211,153,0.4)" : "rgba(245,197,66,0.4)",
                      background: ok ? "rgba(52,211,153,0.07)" : "rgba(245,197,66,0.07)",
                      color: ok ? "#34d399" : "#f5c542",
                    }}
                  >
                    {ok ? <Link2 size={11} /> : <Unlink size={11} />}
                    {name} <span className="opacity-70">×{count}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* liste des lignes parsées */}
        <div className="no-scrollbar max-h-[268px] flex-1 overflow-y-auto px-2 py-2">
          {parsed.length === 0 && <p className="px-2 py-4 text-[11.5px] font-semibold text-fog/60">Le chef d'orchestre textuel apparaîtra ici ligne par ligne.</p>}
          {parsed.map((l, i) => (
            <div key={i} className="group flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
              <span className="mt-0.5 w-6 shrink-0 text-right font-mono text-[10px] font-semibold text-fog/40">{i + 1}</span>
              {l.kind === "scene" && (
                <>
                  <Clapperboard size={13} className="mt-0.5 shrink-0 text-gold" />
                  <p className="text-[11.5px] font-bold uppercase tracking-wide text-gold/90">{l.text}</p>
                </>
              )}
              {l.kind === "action" && (
                <>
                  <Eye size={13} className="mt-0.5 shrink-0 text-fog/70" />
                  <p className="text-[11.5px] italic leading-relaxed text-fog">{l.text}</p>
                </>
              )}
              {l.kind === "dialogue" && (
                <>
                  <MessageSquare size={13} className="mt-0.5 shrink-0 text-cyan" />
                  <p className="min-w-0 text-[11.5px] leading-relaxed text-frost">
                    <span className={`font-bold ${l.name && linked(l.name) ? "text-mint" : "text-gold"}`}>{l.name}</span>
                    {l.tone && (
                      <span
                        className="mx-1.5 rounded-sm px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider"
                        style={{
                          color: TONES.find((t) => t.id === l.tone)?.accent,
                          background: `${TONES.find((t) => t.id === l.tone)?.accent}1a`,
                        }}
                      >
                        {TONES.find((t) => t.id === l.tone)?.label}
                      </span>
                    )}
                    <span className="text-fog">« {l.text} »</span>
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
