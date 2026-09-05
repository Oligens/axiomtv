"""Creative direction modules: shot, camera, motion and character continuity."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .models import CameraAngle, CameraMovement, CharacterIdentity, SceneState, ShotDefinition


class CharacterContinuity:
    def __init__(self) -> None:
        self.characters: dict[str, CharacterIdentity] = {}

    def register(self, character: CharacterIdentity) -> None:
        if character.id in self.characters and self.characters[character.id].reference_images != character.reference_images:
            raise ValueError(f"Character identity conflict: {character.id}")
        self.characters[character.id] = character

    def verify(self, shot: ShotDefinition) -> list[str]:
        return [f"missing-character:{cid}" for cid in shot.characters if cid not in self.characters]


@dataclass(slots=True)
class ShotPlanner:
    max_shots: int = 24
    min_duration: float = 1.0
    max_duration: float = 15.0

    def plan(self, scenario: str, scene: SceneState, semantic: dict[str, Any]) -> list[ShotDefinition]:
        """Build a neutral technical coverage plan from the supplied scenario.

        No fictional characters, locations or statistics are injected here.
        """
        if not scenario.strip():
            raise ValueError("Scenario cannot be empty")
        intensity = float(semantic.get("intensity", 0.5))
        count = min(self.max_shots, max(1, len([s for s in scenario.splitlines() if s.strip()])))
        count = min(count, 8)  # sensible first-pass coverage; can be expanded by an AI planner
        duration = min(self.max_duration, max(self.min_duration, 3.0 + intensity * 2.0))
        result: list[ShotDefinition] = []
        angles = [CameraAngle.OVERHEAD, CameraAngle.EYE, CameraAngle.LOW, CameraAngle.HIGH]
        movements = [CameraMovement.STATIC, CameraMovement.PUSH_IN, CameraMovement.TRACKING, CameraMovement.PAN_RIGHT]
        for i in range(count):
            shot = ShotDefinition(
                id=f"SHOT_{i + 1:03d}", duration=duration,
                angle=angles[i % len(angles)], movement=movements[i % len(movements)],
                action=scenario.strip(), motion={"intensity": intensity, "mood": "neutral"},
            )
            result.append(shot)
        return result


class MotionDirector:
    def direct(self, shot: ShotDefinition, semantic: dict[str, Any]) -> dict[str, Any]:
        intensity = max(0.0, min(1.0, float(semantic.get("intensity", 0.5))))
        speed = "high" if intensity > 0.8 else "medium" if intensity > 0.45 else "slow"
        blur = round(0.08 + intensity * 0.25, 3)
        return {"speed": speed, "intensity": intensity, "motionBlur": blur, "subjectLock": True,
                "cameraShake": round(intensity * 0.12, 3), "direction": shot.movement.value}


class CameraDirector:
    PRESETS = {
        CameraAngle.LOW: {"height": 0.6, "tilt": -20, "defaultLens": "24mm"},
        CameraAngle.HIGH: {"height": 3.0, "tilt": 15, "defaultLens": "35mm"},
        CameraAngle.EYE: {"height": 1.6, "tilt": 0, "defaultLens": "35mm"},
        CameraAngle.OVERHEAD: {"height": 12.0, "tilt": -90, "defaultLens": "24mm"},
        CameraAngle.DUTCH: {"height": 1.6, "tilt": 8, "defaultLens": "35mm"},
        CameraAngle.POV: {"height": 1.6, "tilt": 0, "defaultLens": "28mm"},
    }

    def configure(self, shot: ShotDefinition) -> dict[str, Any]:
        preset = self.PRESETS[shot.angle]
        return {"angle": shot.angle.value, "movement": shot.movement.value,
                "lens": shot.lens or preset["defaultLens"], **preset,
                "stabilization": shot.movement != CameraMovement.HANDHELD}


class VFXDirector:
    def plan(self, scenario: str, semantic: dict[str, Any]) -> list[str]:
        text = scenario.lower()
        effects: list[str] = []
        if semantic.get("sciFi"):
            effects.extend(["atmospheric-haze", "volumetric-light"])
        if "explosion" in text or "explosion" in semantic.get("keywords", []):
            effects.extend(["embers", "screen-shake"])
        if "hologram" in text or "hologramme" in text:
            effects.append("hologram")
        return list(dict.fromkeys(effects))


def build_prompt(shot: ShotDefinition, scene: SceneState, continuity: CharacterContinuity) -> str:
    character_text = "; ".join(continuity.characters[c].continuity_prompt() for c in shot.characters if c in continuity.characters)
    return " ".join(filter(None, [
        "Cinematic production shot.", f"Environment: {scene.environment}.",
        f"Camera: {shot.angle.value}, {shot.movement.value}, {shot.lens}.",
        f"Lighting: {scene.lighting}.", f"Palette: {', '.join(scene.palette)}.",
        character_text, f"Action: {shot.action}.", f"VFX: {', '.join(shot.vfx)}.",
        "Preserve identity, geometry, wardrobe, lighting and temporal continuity. Avoid unintended text or logos.",
    ]))
