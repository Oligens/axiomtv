"""Central AgwèStream orchestration layer.

This layer produces a production-plan JSON compatible with AxiomTV's existing
TypeScript Cinema Engine. AI generation remains provider-adapter based; no fake
video outputs are reported as successful renders.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .analyzers import ImageAnalyzer, SceneAnalyzer
from .directors import CameraDirector, CharacterContinuity, MotionDirector, ShotPlanner, VFXDirector, build_prompt
from .models import CharacterIdentity, MasterImage, ProductionPlan, SceneState, ShotStatus
from .qa import QualityAssuranceEngine


class AgweStreamPipeline:
    def __init__(self, output_dir: str = "output/agwestream") -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.image_analyzer = ImageAnalyzer()
        self.scene_analyzer = SceneAnalyzer()
        self.shot_planner = ShotPlanner()
        self.motion_director = MotionDirector()
        self.camera_director = CameraDirector()
        self.character_continuity = CharacterContinuity()
        self.vfx_director = VFXDirector()
        self.qa = QualityAssuranceEngine()
        self.scene = SceneState()
        self.master: MasterImage | None = None
        self.shots = []

    def register_character(self, character: CharacterIdentity) -> None:
        self.character_continuity.register(character)
        self.scene.characters[character.id] = character

    def prepare(self, scenario: str, master_image: str | None = None) -> ProductionPlan:
        if not scenario.strip():
            raise ValueError("Scenario cannot be empty")
        semantic = self.scene_analyzer.analyze(scenario)
        self.scene_analyzer.apply_to_scene(self.scene, semantic)
        if master_image:
            self.master = self.image_analyzer.analyze(MasterImage(master_image))

        self.scene.lighting = self.scene.lighting or ("motivated cyan-blue cinematic lighting" if semantic["sciFi"] else "natural cinematic lighting")
        self.scene.palette = self.scene.palette or (["deep-blue", "cyan", "violet", "black"] if semantic["sciFi"] else ["natural"])
        self.shots = self.shot_planner.plan(scenario, self.scene, semantic)

        for shot in self.shots:
            shot.motion = self.motion_director.direct(shot, semantic)
            shot.camera = self.camera_director.configure(shot)
            shot.vfx = self.vfx_director.plan(scenario, semantic)
            missing = self.character_continuity.verify(shot)
            shot.issues.extend(missing)
            shot.prompt = build_prompt(shot, self.scene, self.character_continuity)
            shot.status = ShotStatus.PENDING if not missing else ShotStatus.FAILED
            self.scene.previous_shot_id = shot.id

        return ProductionPlan(
            version=1,
            generated_at=datetime.now(timezone.utc).isoformat(),
            shots=[s.to_node_plan(self.scene) for s in self.shots if s.status != ShotStatus.FAILED],
            global_style={
                "genre": "sci-fi" if semantic["sciFi"] else "cinematic",
                "visualLanguage": "cinematic, coherent characters, motivated camera, physically plausible motion",
                "palette": list(self.scene.palette),
            },
            scene_state=self.scene.snapshot(),
            source={"masterImage": self.master.path if self.master else None},
        )

    def write_plan(self, plan: ProductionPlan, filename: str = "production-plan.json") -> Path:
        destination = self.output_dir / filename
        destination.write_text(json.dumps(plan.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
        return destination

    def validate_render(self, video_path: str, shot_index: int = 0) -> dict[str, Any]:
        if not self.shots:
            raise RuntimeError("Prepare a production plan before QA")
        if shot_index < 0 or shot_index >= len(self.shots):
            raise IndexError("shot_index out of range")
        report = self.qa.evaluate(video_path, self.shots[shot_index])
        return {"score": report.score, "passed": report.passed, "anomalies": report.anomalies,
                "metrics": report.metrics, "recommendation": report.recommendation}
