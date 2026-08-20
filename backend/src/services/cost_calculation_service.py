from dataclasses import dataclass, field
from src.db.repositories.materials_repository import MaterialsRepository
from src.services.solution_service import SolutionDraft, SolutionType, CONCERN_TO_MATERIALS

DEFAULT_CURRENCY = "USD"

# Fallback unit prices used when a material is not found in
# materials_reference for the building's region — keyed by unit, since a
# missing material still has a known unit (from the SolutionDraft) even
# without a price. Per the architecture decision: a missing material must
# not block the entire cost calculation.
# TODO: these are rough placeholder averages, not sourced from real market
# data — same status as other placeholder constants in this codebase (see
# rules.py, solution_service.py TODOs).
DEFAULT_UNIT_PRICE_BY_UNIT = {
    "kg": 5.0,
    "m2": 18.0,
    "unit": 300.0,
}

# Baseline scenario used only internally to compute savings — NOT one of the
# 3 presented solutions. Represents "address every flagged concern using
# EVERY candidate material for it (not a preferred subset), at full
# quantity, no reuse discount" — i.e. a maximum-intervention reference
# point, not literally "replace the whole building". User-facing text calls
# this a "maximum-intervention baseline", not "full replacement", to avoid
# implying it means replacing the entire structure.
# TODO: team judgement call (both the multiplier value and the "include
# every candidate, not just non-reuse" design choice), not derived from a
# real replacement-cost study.
BASELINE_QUANTITY_MULTIPLIER = 1.15


@dataclass
class MaterialLineItem:
    material_name: str
    quantity: float
    unit: str
    unit_price_at_calculation: float
    is_estimated_price: bool
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
        baseline_cost = self._calculate_baseline_cost(assessment_key_concerns, building_area_m2, region)

        priced_solutions = []
        for draft in solution_drafts:
            line_items = self._price_material_requirements(draft.material_requirements, region)
            total_cost = round(sum(item.line_cost for item in line_items), 2)

            savings_money = round(baseline_cost - total_cost, 2)
            savings_pct = (savings_money / baseline_cost * 100) if baseline_cost > 0 else 0.0

            reused_count = sum(
                1 for item in line_items
                if self._is_reuse_material(item.material_name)
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

    def _price_material_requirements(self, material_requirements, region: str) -> list[MaterialLineItem]:
        line_items = []
        for req in material_requirements:
            material_ref = self._materials_repository.get_by_name_and_region(req.material_name, region)

            if material_ref is not None:
                unit_price = material_ref.unit_price
                is_estimated = False
                material_id = material_ref.id
            else:
                unit_price = DEFAULT_UNIT_PRICE_BY_UNIT.get(req.unit, DEFAULT_UNIT_PRICE_BY_UNIT["unit"])
                is_estimated = True
                material_id = None

            line_items.append(
                MaterialLineItem(
                    material_name=req.material_name,
                    quantity=req.quantity,
                    unit=req.unit,
                    unit_price_at_calculation=unit_price,
                    is_estimated_price=is_estimated,
                    material_id=material_id,
                )
            )
        return line_items

    def _calculate_baseline_cost(
        self,
        key_concerns: list[str],
        building_area_m2: float,
        region: str,
    ) -> float:
        """
        Baseline = "replace everything the assessment flagged, using EVERY
        material candidate for each concern (not just a preferred subset),
        at full quantity, with no reuse discount" — i.e. the same material
        selection breadth as the OPTIMAL scenario (which also includes every
        candidate per concern, see SolutionGenerationService), but priced at
        BASELINE_QUANTITY_MULTIPLIER instead of OPTIMAL's 1.0, to represent
        a slightly less efficient, no-planning "just replace everything"
        reference point.

        This must include the SAME set of candidates OPTIMAL includes (all
        of them per concern), not a reduced non-reuse-only subset. An
        earlier version of this method used only the non-reuse candidate per
        concern, which under-counted materials relative to what OPTIMAL (and
        ECO) actually include — producing a baseline cheaper than OPTIMAL's
        real cost and forcing savings to be clamped to 0 for both of them.
        Found via calculate_costs' own reproducibility test producing
        suspicious 0%-savings results for optimal/eco; verified by directly
        comparing each scenario's real total against the baseline before any
        clamping.
        """
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

                material_ref = self._materials_repository.get_by_name_and_region(
                    candidate.material_name, region
                )
                unit_price = (
                    material_ref.unit_price if material_ref is not None
                    else DEFAULT_UNIT_PRICE_BY_UNIT.get(candidate.unit, DEFAULT_UNIT_PRICE_BY_UNIT["unit"])
                )
                baseline_total += quantity * unit_price

        return round(baseline_total, 2)

    @staticmethod
    def _is_reuse_material(material_name: str) -> bool:
        # Mirrors solution_service.py's reuse_oriented flag on
        # MaterialCandidate — duplicated here as a name-based check since
        # MaterialRequirement (the type this service actually receives) does
        # not carry the reuse_oriented flag through from MaterialCandidate.
        # TODO: minor duplication, acceptable for MVP; consider threading
        # reuse_oriented through MaterialRequirement if this needs to grow.
        return material_name in {"structural_underpinning"}

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
