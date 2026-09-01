from dataclasses import dataclass, field
from src.types.assessment import AssessmentResult, BuildingContext, Status, STATUS_RANK
from src.types.solution import SolutionType


@dataclass
class MaterialCandidate:
    material_name: str
    base_quantity_per_area: float
    unit: str
    per_area: bool = True
    reuse_oriented: bool = False


@dataclass
class MaterialRequirement:
    material_name: str
    quantity: float
    unit: str


@dataclass
class SolutionDraft:
    type: SolutionType
    required_changes: list[str]
    material_requirements: list[MaterialRequirement] = field(default_factory=list)


CONCERN_TO_MATERIALS: dict[str, list[MaterialCandidate]] = {
    "high_tilt": [
        MaterialCandidate("Арматура композитная 8 мм", 0.5, "m", per_area=True),
        MaterialCandidate("Сетка кладочная 1000x2000 мм, ячейка 150x150", 0.1, "m2", per_area=True, reuse_oriented=True),
    ],
    "structural_vibration": [
        MaterialCandidate("Цемент М450, Семей, 50 кг", 0.3, "kg", per_area=True),
    ],
    "shock_event_detected": [
        MaterialCandidate("Штукатурка Rotband гипсовая 30 кг, Knauf", 1.0, "kg", per_area=False),
    ],
    "moisture_risk": [
        MaterialCandidate("Гидроизоляционная масса CR65 цементная 25 кг, Ceresit", 1.0, "m2", per_area=True),
        MaterialCandidate("Грунтовка CT7 универсальная 10 л, Ceresit", 0.2, "l", per_area=True),
    ],
    "extreme_temperature": [
        MaterialCandidate("Утеплитель РОКЛАЙТ 50 мм, Технониколь", 1.0, "m2", per_area=True),
    ],
    "extreme_pressure": [
    ],
    "insufficient_natural_light": [
        MaterialCandidate("Профиль направляющий Knauf 27x28x3000 мм", 0.05, "unit", per_area=True),
        MaterialCandidate("Плита OSB-3 12 мм, 1250x2500", 0.01, "m2", per_area=True, reuse_oriented=False),
    ],
}



@dataclass
class SolutionTypeConfig:
    quantity_multiplier: float
    min_severity: Status
    change_verb: str
    prefer_reuse: bool = False


SOLUTION_TYPE_CONFIG: dict[SolutionType, SolutionTypeConfig] = {
    SolutionType.LOW_COST: SolutionTypeConfig(
        quantity_multiplier=0.6,
        min_severity=Status.CRITICAL,
        change_verb="partial repair of",
    ),
    SolutionType.OPTIMAL: SolutionTypeConfig(
        quantity_multiplier=1.0,
        min_severity=Status.ATTENTION, 
        change_verb="replacement/installation of",
    ),
    SolutionType.ECO: SolutionTypeConfig(
        quantity_multiplier=0.85,
        min_severity=Status.ATTENTION,
        change_verb="reuse-oriented upgrade of",
        prefer_reuse=True,
    ),
}

CONCERN_TO_GROUP: dict[str, str] = {
    "high_tilt": "structural",
    "structural_vibration": "structural",
    "shock_event_detected": "structural",
    "moisture_risk": "climate",
    "extreme_temperature": "climate",
    "extreme_pressure": "climate",
    "insufficient_natural_light": "lighting",
}


class SolutionGenerationService:
    def generate_solutions(
        self,
        assessment: AssessmentResult,
        building_context: BuildingContext,
    ) -> list[SolutionDraft]:
        group_severity = self._get_group_severity(assessment)

        drafts = []
        for solution_type in SolutionType:
            draft = self._build_solution_draft(
                solution_type, assessment, building_context, group_severity
            )
            drafts.append(draft)

        return drafts

    @staticmethod
    def _get_group_severity(assessment: AssessmentResult) -> dict[str, Status]:
        return {flag.group: flag.status for flag in assessment.parameter_flags}

    def _build_solution_draft(
        self,
        solution_type: SolutionType,
        assessment: AssessmentResult,
        building_context: BuildingContext,
        group_severity: dict[str, Status],
    ) -> SolutionDraft:
        config = SOLUTION_TYPE_CONFIG[solution_type]
        min_severity_rank = STATUS_RANK[config.min_severity]

        relevant_concerns = [
            concern
            for concern in assessment.key_concerns
            if concern in CONCERN_TO_GROUP
            and STATUS_RANK[group_severity.get(CONCERN_TO_GROUP[concern], Status.NORMAL)]
            >= min_severity_rank
        ]

        material_requirements = self._collect_material_requirements(
            relevant_concerns, config, building_context
        )
        required_changes = self._build_required_changes(relevant_concerns, config)

        return SolutionDraft(
            type=solution_type,
            required_changes=required_changes,
            material_requirements=material_requirements,
        )

    @staticmethod
    def _collect_material_requirements(
        concerns: list[str],
        config: SolutionTypeConfig,
        building_context: BuildingContext,
    ) -> list[MaterialRequirement]:
        collected: dict[str, MaterialRequirement] = {}

        for concern in concerns:
            candidates = CONCERN_TO_MATERIALS.get(concern, [])

            if config.prefer_reuse:
                candidates = SolutionGenerationService._apply_eco_reuse_preference(candidates)

            for candidate in candidates:
                if candidate.per_area:
                    quantity = candidate.base_quantity_per_area * building_context.area_m2
                else:
                    quantity = candidate.base_quantity_per_area

                quantity *= config.quantity_multiplier

                if candidate.material_name in collected:
                    collected[candidate.material_name].quantity += quantity
                else:
                    collected[candidate.material_name] = MaterialRequirement(
                        material_name=candidate.material_name,
                        quantity=round(quantity, 3),
                        unit=candidate.unit,
                    )

        return list(collected.values())

    @staticmethod
    def _apply_eco_reuse_preference(candidates: list[MaterialCandidate]) -> list[MaterialCandidate]:
        reuse_candidates = [c for c in candidates if c.reuse_oriented]
        return reuse_candidates if reuse_candidates else candidates

    @staticmethod
    def _build_required_changes(concerns: list[str], config: SolutionTypeConfig) -> list[str]:
        if not concerns:
            return ["No significant changes required — building parameters are within normal range."]
        concern_labels = {
            "high_tilt": "facade/foundation tilt",
            "structural_vibration": "structural vibration",
            "shock_event_detected": "shock-affected structural elements",
            "moisture_risk": "moisture damage",
            "extreme_temperature": "thermal insulation gaps",
            "extreme_pressure": "pressure-related structural stress",
            "insufficient_natural_light": "insufficient natural lighting",
        }

        return [
            f"{config.change_verb.capitalize()} {concern_labels.get(concern, concern)}"
            for concern in concerns
        ]
