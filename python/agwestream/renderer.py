"""Renderer adapters. The default adapter prepares work; FFmpeg performs real assembly."""
from __future__ import annotations

import subprocess
from pathlib import Path


class VideoGenerator:
    """Provider-neutral interface for an external image/video generation service."""

    def generate(self, prompt: str, output_path: str, reference_images: list[str] | None = None) -> str:
        raise NotImplementedError("Configure a video-generation provider adapter for actual AI generation.")


class FFmpegRenderer:
    """Final assembly adapter using the FFmpeg executable available on the host."""

    def __init__(self, ffmpeg_bin: str = "ffmpeg") -> None:
        self.ffmpeg_bin = ffmpeg_bin

    def assemble(self, videos: list[str], output_path: str, audio_path: str | None = None) -> str:
        if not videos:
            raise ValueError("Cannot assemble an empty video sequence")
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        list_file = output.parent / f".{output.stem}.concat.txt"
        try:
            with list_file.open("w", encoding="utf-8") as handle:
                for video in videos:
                    p = Path(video).resolve()
                    if not p.is_file():
                        raise FileNotFoundError(str(p))
                    escaped = str(p).replace("'", "'\\''")
                    handle.write(f"file '{escaped}'\n")
            command = [self.ffmpeg_bin, "-y", "-f", "concat", "-safe", "0", "-i", str(list_file)]
            if audio_path:
                command += ["-i", audio_path, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-c:a", "aac", "-shortest"]
            else:
                command += ["-c", "copy"]
            command.append(str(output))
            subprocess.run(command, check=True, timeout=1800)
            return str(output)
        finally:
            list_file.unlink(missing_ok=True)
