"""
Génère un burndown chart PNG par sprint pour le mémoire POSTIE.

Entrée  : scripts/burndown_data.csv
Sortie  : memoire/figures/burndown-s<n>.png

Colonnes CSV : sprint,day,ideal,actual

Usage :
    python scripts/generate_burndowns.py
"""

import csv
from pathlib import Path

import matplotlib.pyplot as plt

DATA = Path(__file__).parent / "burndown_data.csv"
OUT = Path(__file__).resolve().parents[1] / "memoire" / "figures"
OUT.mkdir(parents=True, exist_ok=True)

sprints: dict[str, list[tuple[int, float, float]]] = {}
with DATA.open(encoding="utf-8") as f:
    for row in csv.DictReader(f):
        sprints.setdefault(row["sprint"], []).append(
            (int(row["day"]), float(row["ideal"]), float(row["actual"]))
        )

for sprint, rows in sprints.items():
    rows.sort()
    days = [r[0] for r in rows]
    ideal = [r[1] for r in rows]
    actual = [r[2] for r in rows]

    plt.figure(figsize=(7, 4))
    plt.plot(days, ideal, label="Idéal", linestyle="--", color="#999")
    plt.plot(days, actual, label="Réel", marker="o", color="#3F4AB4")
    plt.fill_between(
        days, actual, ideal,
        where=[a > i for a, i in zip(actual, ideal)],
        color="#EF4444", alpha=0.15,
    )
    plt.title(f"Burndown — {sprint.upper()}")
    plt.xlabel("Jour du sprint")
    plt.ylabel("Story points restants")
    plt.grid(alpha=0.3)
    plt.legend()
    plt.tight_layout()
    out = OUT / f"burndown-{sprint.lower()}.png"
    plt.savefig(out, dpi=150)
    plt.close()
    print(f"[OK] {out}")
