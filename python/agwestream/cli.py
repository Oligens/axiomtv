"""CLI for preparing AgwèStream production plans."""
from __future__ import annotations

import argparse
import json
import sys

from .models import CharacterIdentity
from .pipeline import AgweStreamPipeline


def main() -> int:
    parser = argparse.ArgumentParser(description="AgwèStream cinematic production planner")
    parser.add_argument("--scenario", required=True, help="Path to UTF-8 screenplay/scenario text")
    parser.add_argument("--master-image", help="Optional master/reference image")
    parser.add_argument("--output", default="output/agwestream/production-plan.json")
    parser.add_argument("--character", action="append", default=[], help="JSON character identity object; repeatable")
    args = parser.parse_args()

    scenario = open(args.scenario, encoding="utf-8").read()
    pipeline = AgweStreamPipeline()
    for raw in args.character:
        pipeline.register_character(CharacterIdentity(**json.loads(raw)))
    plan = pipeline.prepare(scenario, args.master_image)
    path = pipeline.write_plan(plan, args.output.rsplit("/", 1)[-1])
    print(json.dumps({"ok": True, "productionPlan": str(path), "shots": len(plan.shots)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
