import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { SciFiRenderer } from './SciFiRenderer';
import type { ProductionPlan } from './ProductionIntelligence';
import type { RenderConfig, ScriptSegment } from './types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const outputDir = path.resolve(process.env.OUTPUT_DIR || path.join(ROOT, 'output'));
const config: RenderConfig = {
  width: positiveInt(process.env.VIDEO_WIDTH, 1920), height: positiveInt(process.env.VIDEO_HEIGHT, 1080), fps: positiveInt(process.env.FPS, 24),
  quality: (process.env.RENDER_QUALITY as RenderConfig['quality']) || 'high', outputFormat: process.env.VIDEO_FORMAT === 'webm' ? 'webm' : 'mp4',
  backgroundMusic: resolveOptional(process.env.BACKGROUND_MUSIC_PATH), musicVolume: clamp(Number.parseFloat(process.env.MUSIC_VOLUME || '0.3'), 0, 1), maxMemoryMB: positiveInt(process.env.MAX_MEMORY_MB, 3800),
  cinematic: process.env.CINEMATIC_RENDER !== 'false', cinematicIntensity: clamp(Number.parseFloat(process.env.CINEMATIC_INTENSITY || '0.65'), 0, 1), letterbox: process.env.CINEMATIC_LETTERBOX !== 'false',
  sourceVideo: resolveOptional(process.env.SOURCE_VIDEO_PATH),
};
const exampleScript: ScriptSegment[] = [
  { id: 1, character: 'Narrator', emotion: 'neutral', text: 'Une civilisation nouvelle émerge dans les ténèbres de l’espace.', duration: 4, backgroundImage: path.join(ROOT, 'assets/backgrounds/galaxy_night.jpg') },
  { id: 2, character: 'Narrator', emotion: 'surprised', text: 'Les étoiles anciennes murmurent encore leurs secrets.', duration: 3.5, backgroundImage: path.join(ROOT, 'assets/backgrounds/nebula.jpg') },
];
export async function runRenderer(argv = process.argv.slice(2)): Promise<string | void> {
  if (argv.includes('--check')) return checkRuntime();
  const script = await loadScript(argv); const preparedPlan = await loadProductionPlan(argv); const apiKey = process.env.ELEVENLABS_API_KEY; const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) throw new Error('ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are required.');
  await fs.ensureDir(outputDir); const renderer = new SciFiRenderer(outputDir, config, apiKey, voiceId);
  const stop = async () => { await renderer.cancel(); process.exit(130); }; process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try { return await renderer.render(script, preparedPlan); } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}
async function loadProductionPlan(argv: string[]): Promise<ProductionPlan | undefined> { const index = argv.indexOf('--production-plan'); if (index === -1) return undefined; const file = argv[index + 1]; if (!file) throw new Error('Usage: npm run render:scifi -- --script ./path/script.json --production-plan ./path/production-plan.json'); const parsed = await fs.readJson(path.resolve(file)); return parsed as ProductionPlan; }
async function loadScript(argv: string[]): Promise<ScriptSegment[]> { const index = argv.indexOf('--script'); if (index === -1) return exampleScript; const file = argv[index + 1]; if (!file) throw new Error('Usage: npm run render:scifi -- --script ./path/script.json'); const parsed = await fs.readJson(path.resolve(file)); if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item.text !== 'string')) throw new Error('Script JSON must be an array of ScriptSegment objects.'); return parsed as ScriptSegment[]; }
async function checkRuntime(): Promise<void> { await Promise.all([fs.ensureDir(path.join(outputDir, 'frames')), fs.ensureDir(path.join(outputDir, 'audio')), fs.ensureDir(path.join(outputDir, 'logs')), fs.ensureDir(path.join(ROOT, 'assets/backgrounds'))]); await checkBinary(process.env.FFMPEG_PATH || 'ffmpeg', 'FFmpeg'); await checkBinary(process.env.FFPROBE_PATH || 'ffprobe', 'FFprobe'); console.log(`Cinema Engine runtime OK. Output: ${outputDir}`); }
function checkBinary(binary: string, label: string): Promise<void> { return new Promise((resolve, reject) => { const child = spawn(binary, ['-version'], { stdio: 'ignore' }); child.on('error', () => reject(new Error(`${label} not found. Set ${label === 'FFmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH'} or install it on the server.`))); child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${label} check failed with code ${code}.`))); }); }
function positiveInt(value: string | undefined, fallback: number): number { const n = Number.parseInt(value || '', 10); return Number.isFinite(n) && n > 0 ? n : fallback; }
function clamp(value: number, min: number, max: number): number { return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min; }
function resolveOptional(value?: string): string | undefined { return value ? path.resolve(value) : undefined; }
const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) runRenderer().catch((error) => { console.error('❌ Cinema Engine render failed:', error instanceof Error ? error.message : error); process.exitCode = 1; });
export { config, outputDir, exampleScript };
