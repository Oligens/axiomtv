import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import type { FrameData } from './types';

export class FrameGenerator {
  constructor(private readonly width: number, private readonly height: number) {}

  async generateFrame(data: FrameData, framesDir: string): Promise<string> {
    await fs.ensureDir(framesDir);
    const output = path.join(framesDir, `frame_${String(data.index).padStart(7, '0')}.png`);
    const background = data.segment.backgroundImage;
    let image: sharp.Sharp;
    if (background && await fs.pathExists(background)) image = sharp(background).resize(this.width, this.height, { fit: 'cover' });
    else image = sharp({ create: { width: this.width, height: this.height, channels: 4, background: { r: 5, g: 8, b: 20, alpha: 1 } } });

    const title = escapeXml(data.segment.character || 'Narrator');
    const text = escapeXml(data.segment.text).slice(0, 140);
    const svg = `<svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020617" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity=".78"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="80" y="${this.height - 150}" fill="#67e8f9" font-size="30" font-family="Arial, sans-serif">${title}</text>
      <text x="80" y="${this.height - 95}" fill="#fff" font-size="42" font-family="Arial, sans-serif">${text}</text>
      <text x="80" y="60" fill="#94a3b8" font-size="20" font-family="Arial, sans-serif">AGWÈSTREAM • SCI-FI RENDER</text>
    </svg>`;
    await image.composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(output);
    return output;
  }

  async cleanup(): Promise<void> { /* Frame files are owned and removed by SciFiRenderer. */ }
}

function escapeXml(value: string): string {
  const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
  return value.replace(/[<>&'\"]/g, (char) => entities[char] ?? char);
}
