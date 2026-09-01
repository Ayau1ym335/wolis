"""
Seed script: load materials_reference.json into DB
Run from backend/ directory:
    python -m src.db.seeds.seed_materials
"""
from __future__ import annotations
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[4]))

from src.db.clients import SessionLocal
from src.db.models.material import Material

SEED_FILE = (
    pathlib.Path(__file__).resolve().parents[4]
    / "ml_training" / "seed" / "materials_reference.json"
)

def seed_materials(session) -> None:
    with open(SEED_FILE, encoding="utf-8") as f:
        items = json.load(f)

    created = 0
    for item in items:
        existing = session.query(Material).filter_by(name=item["name"]).first()
        if existing:
            continue
        mat = Material(
            name=item["name"],
            unit=item["unit"],
            unit_price=float(item["unit_price"]),
            category=item.get("category"),
        )
        session.add(mat)
        created += 1

    session.commit()
    print(f"[seed_materials] Seeded {created} new material(s).")

if __name__ == "__main__":
    with SessionLocal() as session:
        seed_materials(session)
        print("[seed_materials] Done.")
