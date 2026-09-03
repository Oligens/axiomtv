import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import type { FrameData, CameraMovement } from './types';

export class FrameGenerator {
  constructor(private readonly width: number, private readonly height: number) {}

  async generateFrame(data: FrameData, framesDir: string): Promise<string> {
    await fs.ensureDir(framesDir);
    const output = path.join(framesDir, `frame_${String(data.index).padStart(7, '0')}.png`);
    const background = data.segment.backgroundImage;
    const progress = data.segment.duration ? Math.max(0, Math.min(1, data.timestamp / data.segment.duration)) : 0.5;
    const shot = data.shot;
    let image: sharp.Sharp;
    if (background && await fs.pathExists(background)) image = await this.prepareCameraFrame(background, shot?.cameraMovement ?? 'static', progress, shot?.intensity ?? 0.5);
    else image = sharp({ create: { width: this.width, height: this.height, channels: 4, background: { r: 5, g: 8, b: 20, alpha: 1 } } });

    const title = escapeXml(data.segment.character || 'Narrator');
    const text = escapeXml(data.segment.text).slice(0, 140);
    const lighting = shot?.lighting === 'neon' ? '#22d3ee' : shot?.lighting === 'low-key' ? '#a5b4fc' : '#67e8f9';
    const bars = `<rect width="100%" height="7%" y="0" fill="#000" opacity=".92"/><rect width="100%" height="7%" y="93%" fill="#000" opacity=".92"/>`;
    const vfx = buildVfx(shot?.vfx ?? [], this.width, this.height, data.timestamp);
    const svg = `<svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020617" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".78"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${vfx}${bars}<text x="80" y="${this.height - 150}" fill="${lighting}" font-size="30" font-family="Arial, sans-serif">${title}</text><text x="80" y="${this.height - 95}" fill="#fff" font-size="42" font-family="Arial, sans-serif">${text}</text><text x="80" y="95" fill="#94a3b8" font-size="20" font-family="Arial, sans-serif">AGWÈSTREAM • CINEMA ENGINE • ${escapeXml(shot?.shotType ?? 'medium')}</text></svg>`;
    await image.composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(output);
    return output;
  }

  private async prepareCameraFrame(file: string, movement: CameraMovement, progress: number, intensity: number): Promise<sharp.Sharp> {
    const meta = await sharp(file).metadata();
    const srcW = meta.width || this.width; const srcH = meta.height || this.height;
    const baseScale = Math.max(this.width / srcW, this.height / srcH);
    const zoom = 1 + 0.08 * intensity;
    const targetW = Math.max(this.width, Math.ceil(this.width * zoom)); const targetH = Math.max(this.height, Math.ceil(this.height * zoom));
    const resizedW = Math.ceil(srcW * baseScale * zoom); const resizedH = Math.ceil(srcH * baseScale * zoom);
    const x = movement === 'pan-left' ? Math.round((resizedW - targetW) * (1 - progress)) : movement === 'pan-right' ? Math.round((resizedW - targetW) * progress) : Math.round((resizedW - targetW) / 2);
    const y = movement === 'tilt-up' ? Math.round((resizedH - targetH) * (1 - progress)) : movement === 'tilt-down' ? Math.round((resizedH - targetH) * progress) : Math.round((resizedH - targetH) / 2);
    const frame = sharp(file).resize(resizedW, resizedH, { fit: 'fill' });
    return frame.extract({ left: Math.max(0, Math.min(x, resizedW - targetW)), top: Math.max(0, Math.min(y, resizedH - targetH)), width: targetW, height: targetH }).resize(this.width, this.height);
  }
  async cleanup(): Promise<void> {}
}

function buildVfx(vfx: string[], width: number, height: number, timestamp: number): string {
  let out = '';
  if (vfx.includes('lens-flare')) out += `<circle cx="${Math.round(width * 0.72)}" cy="${Math.round(height * 0.25)}" r="${35 + Math.round(Math.sin(timestamp * 2) * 8)}" fill="#fff" opacity=".18"/>`;
  if (vfx.includes('scanlines')) for (let y = 0; y < height; y += 8) out += `<path d="M0 ${y}H${width}" stroke="#22d3ee" opacity=".025"/>`;
  if (vfx.includes('light-streaks')) out += `<path d="M0 ${height * .32}L${width} ${height * .18}" stroke="#67e8f9" stroke-width="3" opacity=".16"/><path d="M0 ${height * .68}L${width} ${height * .82}" stroke="#a78bfa" stroke-width="2" opacity=".12"/>`;
  if (vfx.includes('embers')) for (let i = 0; i < 18; i++) { const x = ((i * 137 + Math.floor(timestamp * 50)) % width); const y = ((i * 83 + Math.floor(timestamp * 90)) % height); out += `<circle cx="${x}" cy="${y}" r="${1 + i % 3}" fill="#fbbf24" opacity=".35"/>`; }
  if (vfx.includes('rain')) for (let i = 0; i < 45; i++) { const x = (i * 97) % width; const y = (i * 53 + Math.floor(timestamp * 500)) % height; out += `<path d="M${x} ${y}l-12 30" stroke="#bae6fd" opacity=".2"/>`; }
  return out;
}
function escapeXml(value: string): string { const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }; return value.replace(/[<>&'\"]/g, (char) => entities[char] ?? char); }
