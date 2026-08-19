import json
import uuid
from pathlib import Path
from sqlalchemy.dialects.postgresql import insert as pg_insert
from src.db.session import get_session
from src.db.models.material import Material

SEED_FILE_PATH = Path(__file__).resolve().parents[2] / "seed" / "materials_reference.json"
REQUIRED_FIELDS = {"name", "unit", "unit_price"}


def load_seed_data(path: Path = SEED_FILE_PATH) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"сид файл не найден: {path}")
    with path.open("r", encoding="utf-8") as f:
        records = json.load(f)
    if not isinstance(records, list) or len(records) == 0:
        raise ValueError("пустой список материалов")

    for i, record in enumerate(records):
        missing = REQUIRED_FIELDS - record.keys()
        if missing:
            raise ValueError(
                f"Запись #{i} ({record.get('name', '?')}) не содержит: {missing}"
            )
    return records


def upsert_materials(records: list[dict]) -> int:
    session = get_session()
    try:
        for record in records:
            stmt = pg_insert(Material).values(
                id=uuid.uuid4(),
                name=record["name"],
                unit=record["unit"],
                unit_price=record["unit_price"],
                category=record.get("category"),
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uq_material_name",
                set_={
                    "unit": stmt.excluded.unit,
                    "unit_price": stmt.excluded.unit_price,
                    "category": stmt.excluded.category,
                },
            )
            session.execute(stmt)

        session.commit()
        return len(records)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def main():
    records = load_seed_data()
    count = upsert_materials(records)

if __name__ == "__main__":
    main()