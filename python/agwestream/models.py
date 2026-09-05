"""Strongly typed domain models for the AgwèStream production planner."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class ShotStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    PASSED = "passed"
    FAILED = "failed"
    REGENERATING = "regenerating"


class CameraAngle(str, Enum):
    LOW = "low-angle"
    HIGH = "high-angle"
    EYE = "eye-level"
    OVERHEAD = "overhead"
    DUTCH = "dutch-angle"
    POV = "pov"


class CameraMovement(str, Enum):
    STATIC = "static"
    PAN_LEFT = "pan-left"
    PAN_RIGHT = "pan-right"
    TILT_UP = "tilt-up"
    TILT_DOWN = "tilt-down"
    PUSH_IN = "push-in"
    PULL_OUT = "pull-out"
    TRACKING = "tracking"
    HANDHELD = "handheld"
    CRANE = "crane"
    DRONE = "drone"
    VEHICLE_CHASE = "vehicle-chase"


@dataclass(slots=True)
class CharacterIdentity:
    """Persistent visual identity used in every shot containing a character."""

    id: str
    name: str
    reference_images: list[str] = field(default_factory=list)
    physical_description: str = ""
    clothing: str = ""
    age: int | None = None
    gender: str | None = None
    face_embedding_ref: str | None = None
    visual_traits: dict[str, Any] = field(default_factory=dict)

    def continuity_prompt(self) -> str:
        traits = ", ".join(f"{k}: {v}" for k, v in self.visual_traits.items())
        parts = [f"Character {self.name} ({self.id})", self.physical_description, self.clothing]
        if traits:
            parts.append(traits)
        return "; ".join(p for p in parts if p)


@dataclass(slots=True)
class VehicleState:
    id: str
    vehicle_type: str
    color: str = ""
    model: str = ""
    position: tuple[float, float, float] = (0.0, 0.0, 0.0)
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0)
    speed: float = 0.0
    is_moving: bool = False


@dataclass(slots=True)
class SceneState:
    """Continuity state carried from one shot to the next."""

    location: str = ""
    environment: str = ""
    time_of_day: str = ""
    weather: str = ""
    lighting: str = ""
    palette: list[str] = field(default_factory=list)
    characters: dict[str, CharacterIdentity] = field(default_factory=dict)
    vehicles: dict[str, VehicleState] = field(default_factory=dict)
    props: dict[str, str] = field(default_factory=dict)
    motifs: list[str] = field(default_factory=list)
    previous_shot_id: str | None = None

    def snapshot(self) -> dict[str, Any]:
        data = asdict(self)
        data["characters"] = {k: asdict(v) for k, v in self.characters.items()}
        data["vehicles"] = {k: asdict(v) for k, v in self.vehicles.items()}
        return data


@dataclass(slots=True)
class MasterImage:
    path: str
    width: int | None = None
    height: int | None = None
    dominant_colors: list[str] = field(default_factory=list)
    objects: list[dict[str, Any]] = field(default_factory=list)
    depth_reference: str | None = None
    segmentation_reference: str | None = None
    analysis: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ShotDefinition:
    id: str
    duration: float
    angle: CameraAngle
    movement: CameraMovement
    lens: str = "35mm"
    action: str = ""
    characters: list[str] = field(default_factory=list)
    vehicles: list[str] = field(default_factory=list)
    vfx: list[str] = field(default_factory=list)
    motion: dict[str, Any] = field(default_factory=dict)
    camera: dict[str, Any] = field(default_factory=dict)
    prompt: str = ""
    status: ShotStatus = ShotStatus.PENDING
    quality_score: float = 0.0
    issues: list[str] = field(default_factory=list)
    retry_count: int = 0
    generated_video: str | None = None

    def to_node_plan(self, scene: SceneState) -> dict[str, Any]:
        """Serialize to the ProductionPlan shape consumed by the TS renderer."""
        return {
            "segmentId": int(self.id.split("_")[-1]),
            "shotType": self._shot_type(),
            "cameraMovement": self.movement.value,
            "duration": self.duration,
            "intensity": float(self.motion.get("intensity", 0.5)),
            "environment": scene.environment,
            "continuity": {
                "characters": list(scene.characters),
                "environments": [scene.environment] if scene.environment else [],
                "motifs": list(scene.motifs),
                "palette": list(scene.palette),
            },
            "engines": ["image", "cloud-video"] + (["vfx"] if self.vfx else []),
            "vfx": list(self.vfx),
            "prompt": {
                "segmentId": int(self.id.split("_")[-1]),
                "description": scene.environment,
                "shotType": self._shot_type(),
                "cameraMovement": self.movement.value,
                "lighting": scene.lighting,
                "mood": self.motion.get("mood", "neutral"),
                "colorPalette": list(scene.palette),
                "vfxElements": list(self.vfx),
                "aiPrompt": self.prompt,
            },
        }

    def _shot_type(self) -> str:
        mapping = {
            CameraAngle.LOW: "low-angle", CameraAngle.HIGH: "high-angle",
            CameraAngle.EYE: "medium", CameraAngle.OVERHEAD: "extreme-wide",
            CameraAngle.DUTCH: "wide", CameraAngle.POV: "pov",
        }
        return mapping[self.angle]


@dataclass(slots=True)
class QualityReport:
    score: float
    passed: bool
    anomalies: list[str] = field(default_factory=list)
    metrics: dict[str, float] = field(default_factory=dict)
    recommendation: str = "accept"


@dataclass(slots=True)
class ProductionPlan:
    version: int
    generated_at: str
    shots: list[dict[str, Any]]
    global_style: dict[str, Any]
    scene_state: dict[str, Any]
    source: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "generatedAt": self.generated_at,
            "shots": self.shots,
            "globalStyle": self.global_style,
            "sceneState": self.scene_state,
            "source": self.source,
        }
