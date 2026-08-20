from enum import Enum

class Status(str, Enum):
    NORMAL = "normal"
    ATTENTION = "attention"
    CRITICAL = "critical"

_STATUS_SEVERITY_ORDER = [Status.NORMAL, Status.ATTENTION, Status.CRITICAL]

def _max_severity(*statuses: Status) -> Status:
    return max(statuses, key=lambda s: _STATUS_SEVERITY_ORDER.index(s))

STRUCTURAL_TILT_THRESHOLDS_DEG = {
    "attention": 0.6,
    "critical": 1.0,
}

STRUCTURAL_VIBRATION_THRESHOLDS = {
    "attention": 0.035,
    "critical": 0.06,
}

_AGE_SENSITIVITY_BRACKETS = [
    (0, 1.0),
    (30, 0.9),
    (60, 0.8),
    (100, 0.7),
]


def _age_threshold_multiplier(age_years: int) -> float:
    multiplier = _AGE_SENSITIVITY_BRACKETS[0][1]
    for min_age, mult in _AGE_SENSITIVITY_BRACKETS:
        if age_years >= min_age:
            multiplier = mult
        else:
            break
    return multiplier


def evaluate_structural(
    tilt_angle_deg: float,
    vibration_magnitude: float,
    shock_detected: bool,
    age_years: int,
) -> Status:
    """
    Evaluate structural status from tilt, vibration, shock, and building age.

    Logic:
      1. Apply an age-based multiplier to the base tilt/vibration thresholds
         (older buildings are judged more strictly).
      2. Classify tilt and vibration independently against their adjusted
         thresholds.
      3. shock_detected forces a minimum of ATTENTION regardless of tilt/
         vibration, since a strong mechanical shock is itself a notable event
         (SW-420 signal) even if it did not (yet) shift tilt/vibration readings.
      4. Overall structural status is the most severe of the three signals.
    """
    multiplier = _age_threshold_multiplier(age_years)

    tilt_attention = STRUCTURAL_TILT_THRESHOLDS_DEG["attention"] * multiplier
    tilt_critical = STRUCTURAL_TILT_THRESHOLDS_DEG["critical"] * multiplier

    if tilt_angle_deg >= tilt_critical:
        tilt_status = Status.CRITICAL
    elif tilt_angle_deg >= tilt_attention:
        tilt_status = Status.ATTENTION
    else:
        tilt_status = Status.NORMAL

    vib_attention = STRUCTURAL_VIBRATION_THRESHOLDS["attention"] * multiplier
    vib_critical = STRUCTURAL_VIBRATION_THRESHOLDS["critical"] * multiplier

    if vibration_magnitude >= vib_critical:
        vibration_status = Status.CRITICAL
    elif vibration_magnitude >= vib_attention:
        vibration_status = Status.ATTENTION
    else:
        vibration_status = Status.NORMAL

    shock_status = Status.ATTENTION if shock_detected else Status.NORMAL

    return _max_severity(tilt_status, vibration_status, shock_status)

CLIMATE_HUMIDITY_THRESHOLDS_BY_MATERIAL = {
    "wood": {"attention": 65.0, "critical": 75.0},
    "brick": {"attention": 70.0, "critical": 80.0},
    "concrete": {"attention": 75.0, "critical": 85.0},
    "mixed": {"attention": 70.0, "critical": 80.0},
}

TEMPERATURE_ATTENTION_RANGE_C = (-15.0, 40.0) 
PRESSURE_ATTENTION_RANGE_HPA = (950.0, 1050.0) 


def evaluate_climate(
    temperature_c: float,
    humidity_pct: float,
    pressure_hpa: float,
    material: str,
) -> Status:
    """
    Evaluate climate status from temperature, humidity, pressure, and
    construction material.

    Logic:
      1. Humidity is checked against material-specific thresholds — this is
         the dominant signal for this group.
      2. Temperature and pressure outside their normal operating ranges add
         at most ATTENTION (not CRITICAL) in the MVP — extreme readings alone
         are not treated as structurally critical without corroborating
         humidity/structural signals.
      3. Overall climate status is the most severe of the individual signals.
    """
    material_key = material.lower()
    thresholds = CLIMATE_HUMIDITY_THRESHOLDS_BY_MATERIAL.get(
        material_key, CLIMATE_HUMIDITY_THRESHOLDS_BY_MATERIAL["mixed"]
    )

    if humidity_pct >= thresholds["critical"]:
        humidity_status = Status.CRITICAL
    elif humidity_pct >= thresholds["attention"]:
        humidity_status = Status.ATTENTION
    else:
        humidity_status = Status.NORMAL

    temp_low, temp_high = TEMPERATURE_ATTENTION_RANGE_C
    temperature_status = (
        Status.ATTENTION if not (temp_low <= temperature_c <= temp_high) else Status.NORMAL
    )

    pressure_low, pressure_high = PRESSURE_ATTENTION_RANGE_HPA
    pressure_status = (
        Status.ATTENTION if not (pressure_low <= pressure_hpa <= pressure_high) else Status.NORMAL
    )

    return _max_severity(humidity_status, temperature_status, pressure_status)

LIGHTING_THRESHOLDS_LUX_BY_BUILDING_TYPE = {
    "residential": {"attention": 100.0, "critical": 50.0},
    "commercial": {"attention": 500.0, "critical": 300.0},
    "historical": {"attention": 150.0, "critical": 50.0},
    "industrial": {"attention": 200.0, "critical": 150.0},
}

def evaluate_lighting(illuminance_lux: float, building_type: str) -> Status:
    type_key = building_type.lower()
    thresholds = LIGHTING_THRESHOLDS_LUX_BY_BUILDING_TYPE.get(
        type_key, LIGHTING_THRESHOLDS_LUX_BY_BUILDING_TYPE["residential"]
    )

    if illuminance_lux <= thresholds["critical"]:
        return Status.CRITICAL
    elif illuminance_lux <= thresholds["attention"]:
        return Status.ATTENTION
    else:
        return Status.NORMAL

def compute_overall_status(
    structural: Status,
    climate: Status,
    lighting: Status,
) -> Status:
    if structural == Status.CRITICAL:
        return Status.CRITICAL

    if climate == Status.CRITICAL:
        return Status.CRITICAL

    if structural == Status.ATTENTION or climate == Status.ATTENTION or lighting != Status.NORMAL:
        return Status.ATTENTION
 
    return Status.NORMAL

