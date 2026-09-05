"""Quality control with measurable checks and bounded retry decisions."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import Any

from .models import QualityReport, ShotDefinition


class QualityAssuranceEngine:
    """Performs objective media checks; ML/VLM checks can be plugged in later."""

    def __init__(self, threshold: float = 0.75, max_retries: int = 3) -> None:
        self.threshold = threshold
        self.max_retries = max_retries

    def evaluate(self, video_path: str | None, shot: ShotDefinition) -> QualityReport:
        metrics: dict[str, float] = {}
        anomalies: list[str] = []
        if not video_path:
            return QualityReport(0.0, False, ["missing-output"], {}, "regenerate")
        path = Path(video_path)
        if not path.is_file() or path.stat().st_size == 0:
            return QualityReport(0.0, False, ["missing-or-empty-output"], {}, "regenerate")

        probe = self._ffprobe(path)
        if probe:
            streams = probe.get("streams", [])
            video = next((s for s in streams if s.get("codec_type") == "video"), None)
            if not video:
                anomalies.append("no-video-stream")
            else:
                width, height = int(video.get("width") or 0), int(video.get("height") or 0)
                metrics["resolution"] = 1.0 if width >= 1280 and height >= 720 else 0.5
                metrics["duration"] = 1.0 if float(video.get("duration") or 0) > 0 else 0.0
                metrics["frame_rate"] = 1.0 if self._fps(video.get("r_frame_rate", "0/1")) >= 23 else 0.5
        else:
            anomalies.append("ffprobe-unavailable")
            metrics["file_integrity"] = 0.0

        black, frozen = self._visual_anomalies(path)
        if black:
            anomalies.append("black-frame-or-black-segment")
        if frozen:
            anomalies.append("frozen-frame-segment")
        metrics["black_frame_control"] = 0.0 if black else 1.0
        metrics["freeze_control"] = 0.0 if frozen else 1.0

        score = sum(metrics.values()) / len(metrics) if metrics else 0.0
        passed = score >= self.threshold and not anomalies
        return QualityReport(score, passed, anomalies, metrics, "accept" if passed else "regenerate")

    def should_retry(self, report: QualityReport, shot: ShotDefinition) -> bool:
        return not report.passed and shot.retry_count < self.max_retries

    @staticmethod
    def _ffprobe(path: Path) -> dict[str, Any] | None:
        try:
            proc = subprocess.run(
                ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
                capture_output=True, text=True, check=True, timeout=30,
            )
            return json.loads(proc.stdout)
        except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
            return None

    @staticmethod
    def _fps(rate: str) -> float:
        try:
            n, d = rate.split("/", 1)
            return float(n) / float(d)
        except (ValueError, ZeroDivisionError):
            return 0.0

    @staticmethod
    def _visual_anomalies(path: Path) -> tuple[bool, bool]:
        """Use FFmpeg's blackdetect/freezedetect filters for objective anomalies."""
        try:
            proc = subprocess.run(
                ["ffmpeg", "-hide_banner", "-i", str(path), "-vf", "blackdetect=d=0.20:pix_th=0.98,freezedetect=n=0.003:d=1", "-f", "null", "-"],
                capture_output=True, text=True, timeout=300,
            )
            log = proc.stderr
            return bool(re.search(r"black_(start|end)", log)), bool(re.search(r"freeze_(start|end)", log))
        except (OSError, subprocess.SubprocessError):
            # Missing FFmpeg should already be visible through ffprobe/integrity checks.
            return False, False
