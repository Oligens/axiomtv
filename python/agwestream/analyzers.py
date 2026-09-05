"""Input analysis: master images and screenplay semantics.

The module deliberately uses lightweight, deterministic analysis. AI providers can
be plugged in later without changing the pipeline contract.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .models import MasterImage, SceneState


class ImageAnalyzer:
    """Extracts reference-image metadata and optional visual-analysis hooks."""

    def analyze(self, image: MasterImage) -> MasterImage:
        path = Path(image.path)
        if not path.is_file():
            raise FileNotFoundError(f"Master image not found: {image.path}")

        # Pillow is optional. The planner still works with metadata-only analysis.
        try:
            from PIL import Image
            with Image.open(path) as source:
                image.width, image.height = source.size
                image.analysis["format"] = source.format
                image.analysis["mode"] = source.mode
                image.analysis["aspect_ratio"] = round(source.width / source.height, 4) if source.height else None
        except ImportError:
            image.analysis["image_library"] = "Pillow not installed; metadata-only mode"
        return image


class SceneAnalyzer:
    """Converts screenplay text into normalized semantic signals."""

    ACTION_WORDS = {"run", "runs", "fight", "fights", "attack", "chase", "drive", "explosion",
                    "court", "attaque", "combat", "poursuite", "explosion", "accelere", "accelerer"}
    SCIFI_WORDS = {"space", "galaxy", "planet", "starship", "robot", "android", "cyber", "hologram",
                   "laser", "portal", "alien", "station", "espace", "galaxie", "planete", "vaisseau",
                   "androide", "hologramme", "portail", "extraterrestre"}
    WATER_WORDS = {"ocean", "sea", "water", "mer", "eau", "river", "riviere"}
    URBAN_WORDS = {"city", "street", "ville", "rue", "market", "marche", "building", "immeuble"}

    def analyze(self, text: str) -> dict[str, Any]:
        normalized = self._normalize(text)
        words = set(re.findall(r"[a-z0-9-]+", normalized))
        scifi = bool(words & self.SCIFI_WORDS)
        action = bool(words & self.ACTION_WORDS)
        environment: list[str] = []
        if words & self.WATER_WORDS:
            environment.append("water")
        if words & self.URBAN_WORDS:
            environment.append("urban")
        if scifi:
            environment.append("futuristic")
        intensity = 0.85 if action else (0.62 if scifi else 0.4)
        return {
            "keywords": sorted(words)[:40],
            "entities": [],
            "actions": ["high-action"] if action else ["observation"],
            "environment": environment,
            "sciFi": scifi,
            "intensity": intensity,
        }

    def apply_to_scene(self, scene: SceneState, analysis: dict[str, Any]) -> SceneState:
        env = analysis.get("environment", [])
        if "futuristic" in env:
            scene.environment = scene.environment or "futuristic cinematic environment"
        elif "urban" in env:
            scene.environment = scene.environment or "cinematic urban environment"
        elif "water" in env:
            scene.environment = scene.environment or "cinematic aquatic environment"
        scene.motifs = sorted(set(scene.motifs) | set(env))
        return scene

    @staticmethod
    def _normalize(text: str) -> str:
        import unicodedata
        return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")
