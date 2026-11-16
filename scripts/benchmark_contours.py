"""Repeatable contour timings: uv run python scripts/benchmark_contours.py."""

import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.contours import build_contours  # noqa: E402
from src.types import ContourRequest, MachineType, Source  # noqa: E402


def main() -> None:
    """Measure five warm calculations of a fixed 20-source/four-level scenario."""
    scenario = ContourRequest(
        types=[MachineType(id="t", name="Benchmark", lwa=110)],
        sources=[
            Source(id=str(i), type_id="t", lat=-33.86 + (i % 5) * 0.003, lng=116.05 + (i // 5) * 0.003)
            for i in range(20)
        ],
        levels=[35, 45, 55, 65],
    )
    durations: list[float] = []
    for _ in range(5):
        start = time.perf_counter()
        result = build_contours(scenario)
        durations.append(time.perf_counter() - start)
        print([(c.level_db, len(c.lines), sum(map(len, c.lines))) for c in result.contours])
    print(f"Median: {statistics.median(durations):.4f}s; range {min(durations):.4f}–{max(durations):.4f}s")


if __name__ == "__main__":
    main()
