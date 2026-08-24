from dataclasses import dataclass, field
from src.db.repositories.materials_repository import MaterialsRepository
from src.services.solution_service import (
    SolutionDraft,
    SolutionType,
    CONCERN_TO_MATERIALS,
    MaterialCandidate,
)

DEFAULT_CURRENCY = "USD"
DEFAULT_UNIT_PRICE_BY_UNIT = {
    "kg": 5.0,
    "m2": 18.0,
    "unit": 300.0,
}
BASELINE_QUANTITY_MULTIPLIER = 1.15


@dataclass
class MaterialLineItem:
    material_name: str
    quantity: float
    unit: str
    unit_price_at_calculation: float
    is_estimated_price: bool
    is_reuse: bool = False
    material_id: str | None = None

    @property
    def line_cost(self) -> float:
        return round(self.quantity * self.unit_price_at_calculation, 2)


@dataclass
class EstimatedCost:
    amount: float
    currency: str = DEFAULT_CURRENCY


@dataclass
class EstimatedSavings:
    money: float
    resources_description: str


@dataclass
class SolutionWithCost:
    type: SolutionType
    required_changes: list[str]
    material_line_items: list[MaterialLineItem] = field(default_factory=list)
    estimated_cost: EstimatedCost = None
    estimated_savings: EstimatedSavings = None


class CostCalculationService:
    def __init__(self, materials_repository: MaterialsRepository):
        self._materials_repository = materials_repository

    def calculate_costs(
        self,
        solution_drafts: list[SolutionDraft],
        region: str,
        assessment_key_concerns: list[str],
        building_area_m2: float,
    ) -> list[SolutionWithCost]:
        baseline_cost = self._calculate_baseline_cost(assessment_key_concerns, building_area_m2)

        priced_solutions = []
        for draft in solution_drafts:
            line_items = self._price_material_requirements(draft.material_requirements)
            total_cost = round(sum(item.line_cost for item in line_items), 2)

            savings_money = round(baseline_cost - total_cost, 2)
            savings_pct = (savings_money / baseline_cost * 100) if baseline_cost > 0 else 0.0

            reused_count = sum(
                1 for item in line_items
                if item.is_reuse
            )

            resources_description = self._build_resources_description(
                savings_pct, reused_count, len(line_items)
            )

            priced_solutions.append(
                SolutionWithCost(
                    type=draft.type,
                    required_changes=draft.required_changes,
                    material_line_items=line_items,
                    estimated_cost=EstimatedCost(amount=total_cost),
                    estimated_savings=EstimatedSavings(
                        money=savings_money,
                        resources_description=resources_description,
                    ),
                )
            )

        return priced_solutions

    def _price_material_requirements(self, material_requirements) -> list[MaterialLineItem]:
        all_candidates: dict[str, MaterialCandidate] = {
            c.material_name: c
            for candidates in CONCERN_TO_MATERIALS.values()
            for c in candidates
        }

        line_items = []
        for req in material_requirements:
            material_ref = self._materials_repository.get_by_name(req.material_name)

            if material_ref is not None:
                unit_price = material_ref.unit_price
                is_estimated = False
                material_id = material_ref.id
            else:
                unit_price = DEFAULT_UNIT_PRICE_BY_UNIT.get(req.unit, DEFAULT_UNIT_PRICE_BY_UNIT["unit"])
                is_estimated = True
                material_id = None

            candidate = all_candidates.get(req.material_name)
            line_items.append(
                MaterialLineItem(
                    material_name=req.material_name,
                    quantity=req.quantity,
                    unit=req.unit,
                    unit_price_at_calculation=unit_price,
                    is_estimated_price=is_estimated,
                    is_reuse=candidate.reuse_oriented if candidate else False,
                    material_id=material_id,
                )
            )
        return line_items

    def _calculate_baseline_cost(
        self,
        key_concerns: list[str],
        building_area_m2: float,
    ) -> float:
        baseline_total = 0.0

        for concern in key_concerns:
            candidates = CONCERN_TO_MATERIALS.get(concern, [])

            for candidate in candidates:
                quantity = (
                    candidate.base_quantity_per_area * building_area_m2
                    if candidate.per_area
                    else candidate.base_quantity_per_area
                )
                quantity *= BASELINE_QUANTITY_MULTIPLIER

                material_ref = self._materials_repository.get_by_name(candidate.material_name)
                unit_price = (
                    material_ref.unit_price if material_ref is not None
                    else DEFAULT_UNIT_PRICE_BY_UNIT.get(candidate.unit, DEFAULT_UNIT_PRICE_BY_UNIT["unit"])
                )
                baseline_total += quantity * unit_price

        return round(baseline_total, 2)

    @staticmethod
    def _build_resources_description(savings_pct: float, reused_count: int, total_materials: int) -> str:
        if total_materials == 0:
            return "No material intervention required."
        if reused_count > 0:
            return (
                f"{reused_count} of {total_materials} material(s) selected favor reuse/renovation; "
                f"~{savings_pct:.0f}% lower cost than a maximum-intervention baseline (addressing every flagged issue with no reuse)."
            )
        return f"~{savings_pct:.0f}% lower cost than a maximum-intervention baseline (addressing every flagged issue with no reuse)."
