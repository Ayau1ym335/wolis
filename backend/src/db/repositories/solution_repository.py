from __future__ import annotations
import uuid
from dataclasses import dataclass
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.db.models.material import Material
from src.db.models.solution import Solution
from src.db.models.solution_material import SolutionMaterial

@dataclass(frozen=True)
class SolutionMaterialData:
    material: Material
    quantity: float
    unit_price_at_calculation: float


@dataclass(frozen=True)
class SolutionWithMaterials:
    solution: Solution
    materials: list[SolutionMaterialData]


class SolutionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, data: dict) -> uuid.UUID:
        solution = Solution(**data)

        self.db.add(solution)
        self.db.commit()
        self.db.refresh(solution)

        return solution.id

    def add_material(
        self,
        solution_id: uuid.UUID,
        material_id: uuid.UUID,
        quantity: float,
        price: float,
    ) -> None:
        solution_material = SolutionMaterial(
            solution_id=solution_id,
            material_id=material_id,
            quantity=quantity,
            unit_price_at_calculation=price,
        )

        self.db.add(solution_material)
        self.db.commit()

    def get_by_assessment_id(
        self,
        assessment_id: uuid.UUID,
    ) -> list[SolutionWithMaterials]:
        solution_stmt = (
            select(Solution)
            .where(Solution.assessment_id == assessment_id)
            .order_by(Solution.created_at)
        )

        solutions = list(self.db.scalars(solution_stmt).all())

        result: list[SolutionWithMaterials] = []

        for solution in solutions:
            material_stmt = (
                select(
                    Material,
                    SolutionMaterial.quantity,
                    SolutionMaterial.unit_price_at_calculation,
                )
                .join(
                    SolutionMaterial,
                    SolutionMaterial.material_id == Material.id,
                )
                .where(
                    SolutionMaterial.solution_id == solution.id
                )
            )

            rows = self.db.execute(material_stmt).all()

            materials = [
                SolutionMaterialData(
                    material=material,
                    quantity=quantity,
                    unit_price_at_calculation=unit_price,
                )
                for material, quantity, unit_price in rows
            ]

            result.append(
                SolutionWithMaterials(
                    solution=solution,
                    materials=materials,
                )
            )
        return result