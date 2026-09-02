import { describe, expect, it } from "vitest";
import { buildScifiCommandText, buildScifiRenderPlan } from "./scifi";

describe("Agwè Sci-Fi director", () => {
  it("detects a space station, stabilization, upscale and VFX", () => {
    const plan = buildScifiRenderPlan([
      "Mira entre dans une station spatiale.",
      "La caméra tremble : stabilisation à 72 %.",
      "Un hologramme et une distorsion spatiale apparaissent.",
      "Améliorer en 4K.",
    ]);
    expect(plan.environment).toBe("space_station");
    expect(plan.camera.treatment).toBe("stabilize");
    expect(plan.camera.strength).toBeCloseTo(0.72);
    expect(plan.upscale).toBe("4x");
    expect(plan.vfx).toEqual(expect.arrayContaining(["hologram", "space_distortion"]));
    expect(plan.continuity.preserveVoice).toBe(true);
  });

  it("remains deterministic for identical input", () => {
    const lines = ["Ville cyberpunk sous la pluie, néons, hologrammes.", "Caméra fluide, amélioration 2K."];
    expect(buildScifiRenderPlan(lines)).toEqual(buildScifiRenderPlan(lines));
  });

  it("does not invent effects when the script is neutral", () => {
    const plan = buildScifiRenderPlan(["Une personne marche dans une rue."]);
    expect(plan.environment).toBe("earth");
    expect(plan.vfx).toEqual([]);
    expect(plan.upscale).toBe("native");
  });

  it("produces a worker-friendly command contract", () => {
    const plan = buildScifiRenderPlan(["Station orbitale, hologramme, stabilisation."]);
    expect(buildScifiCommandText(plan)).toContain("SCI-FI ENVIRONMENT: space_station");
  });
});
