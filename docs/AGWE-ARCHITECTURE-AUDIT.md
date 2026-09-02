# AxiomTV / AgwèStream — audit architecture

Date: 2026-09-02

## Verdict

The current Agwè module is a strong browser-side prototype for scenario parsing, timeline construction, deterministic continuity heuristics, QA scoring and canvas preview. It is **not yet a production GPU film-rendering pipeline**. The existing QA pipeline simulates generation and repair with timers and deterministic scores; the VFX studio renders a visual preview on Canvas. It does not call Wan/ComfyUI/FFmpeg/XTTS-v2/ElevenLabs or another server-side render worker. Therefore a claim of end-to-end, error-free sci-fi film generation would be incorrect.

## Critical findings

1. **Rendering boundary** — generation must move to a server/worker/GPU. Browser Canvas cannot reliably render long 1080p/4K films or perform real video-to-video enhancement.
2. **Timeouts** — the media extraction path has bounded waits, but the QA pipeline uses simulated waits and has no real worker timeout/cancellation propagation.
3. **Audio/video synchronization** — `buildTimeline` estimates dialogue duration from word count and tone rate. It is not phoneme/viseme synchronization. Real lipsync requires timestamps from the TTS/voice worker and a muxing stage.
4. **Fallback bug** — the QA pipeline catches `planScenes` and calls the same function again. A deterministic exception would therefore be repeated, not isolated. This should be replaced by a true fallback scene object or a guarded recovery path.
5. **Hardcoded content** — the hub demo catalogue is fixture data and should remain in typed data/config until API-backed. Secrets and deployment endpoints, however, must be environment driven. Runtime configuration was added for those values.
6. **PWA** — manifest, service worker registration, cache versioning and mobile metadata are present. PWABuilder should still be checked against the deployed HTTPS origin and icon requirements; the repository currently uses SVG icons, so platform-specific PNG icon assets may be required by a target store/validator.

## New Sci-Fi orchestration contract

`src/agwe/scifi.ts` converts plain-language instructions into a deterministic `ScifiRenderPlan` containing:

- environment replacement: terrestrial / space station / cyberpunk / alien world / orbital city;
- upscale target: native / 2x / 4x;
- camera stabilization or cinematic smoothing;
- VFX intents: hologram, laser glow, spatial distortion, portal, robotic elements, energy field, cosmic particles, zero-G;
- continuity constraints for identity, wardrobe and voice;
- stable source hash for reproducibility.

This is deliberately a **render contract**, not a fake client-side AI engine. `src/agwe/renderClient.ts` provides the production boundary for a real GPU worker with request timeouts, bounded retries, job polling and terminal failure handling.

## Voice architecture

The existing `CastMember` model can carry a voice URL/buffer/label, but browser-side state is not a durable voice-clone registry. A production implementation should store voice references server-side and have the render worker return exact audio timestamps. The final mux stage must align generated speech, phonemes/visemes, scene timing and video frames before approval.

## Recommended production flow

`SCRIPT → PARSER → SCENE GRAPH → CHARACTER/VOICE MEMORY → GPU RENDER JOB → UPSCALE/ENHANCE → CAMERA STABILIZATION → ENVIRONMENT/VFX → TTS/VOICE CLONE → LIPSYNC → FFmpeg MUX → TEMPORAL QA → FINAL MASTER → STORAGE/CDN`

Every long-running step should be a queue job with an idempotency key, progress, retry policy, timeout and persisted artifact reference. Vercel should remain the web/API control plane; long GPU work should run outside a Vercel request lifecycle.

## Deployment variables

Public Vite variables may use the `VITE_` prefix. Secrets must never use that prefix. See `.env.example`.

Server-only examples: `DATABASE_URL`, `ZAKAPRO_APP_SECRET`, `JWT_SECRET`, `RESEND_API_KEY`.

Optional render control plane: `VITE_AGWE_RENDER_API_URL`.

## Validation still required

- Run `npm ci`, `npm run typecheck`, `npm test` and `npm run build` in CI or locally.
- Test the deployed webhook and database schema against the real Neon database.
- Configure Vercel environment variables in Production/Preview as appropriate.
- Connect `VITE_AGWE_RENDER_API_URL` only after a real authenticated render worker exists.
- Validate the deployed PWA with PWABuilder/Lighthouse and add 192x192 and 512x512 PNG icons if the target validator requires them.
- Do not expose provider secret keys in the browser.
