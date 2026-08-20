from src.ai.model.inference import ModelBundle
from src.ai.validation import get_assessment
from src.db.repositories.assessment_repository import AssessmentRepository
from src.db.repositories.measurement_repository import MeasurementRepository
from src.types.assessment import AssessmentResult


class MeasurementNotFoundError(Exception):
    def __init__(self, session_id: str):
        self.session_id = session_id
        super().__init__(f"No measurement session found for session_id={session_id}")


class AssessmentService:
    def __init__(
        self,
        measurement_repository: MeasurementRepository,
        assessment_repository: AssessmentRepository,
        model_bundle: ModelBundle,
    ):
        self._measurement_repository = measurement_repository
        self._assessment_repository = assessment_repository
        self._model_bundle = model_bundle

    def assess_measurement(self, session_id: str) -> AssessmentResult:
        measurement = self._measurement_repository.get_by_id(session_id)
        if measurement is None:
            raise MeasurementNotFoundError(session_id)

        sensor_data = self._measurement_repository.to_sensor_data(measurement)
        building_context = self._measurement_repository.to_building_context(measurement)

        result = get_assessment(sensor_data, building_context, self._model_bundle)

        self._assessment_repository.save(session_id, result)

        return result