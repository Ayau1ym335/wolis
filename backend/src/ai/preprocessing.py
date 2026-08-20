import os
import joblib
import pandas as pd
from src.types.assessment import BuildingContext, SensorData

# Must match ALL_FEATURE_COLUMNS in ml_training/training/train_model.py exactly
# — same names, same order does not matter for a ColumnTransformer keyed by
# name, but the SET of columns must match what the encoder was fit on.
FEATURE_COLUMNS = [
    "temperature_c",
    "humidity_pct",
    "pressure_hpa",
    "illuminance_lux",
    "tilt_angle_deg",
    "vibration_magnitude",
    "age_years",
    "area_m2",
    "shock_detected",
    "building_type",
    "material",
    "region",
]

_DEFAULT_ENCODER_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "artifacts", "feature_encoder.pkl"
)


def load_encoder(encoder_path: str = _DEFAULT_ENCODER_PATH):
    """
    Load the fit-once feature encoder from disk. Intended to be called once
    at application startup (see inference.load_models), not per-request —
    joblib.load has non-trivial I/O cost and the encoder is immutable at
    runtime.
    """
    if not os.path.isfile(encoder_path):
        raise FileNotFoundError(
            f"Feature encoder not found at {encoder_path}. "
            "Run ml_training/training/train_model.py first, or check "
            "WOLIS_MODEL_ARTIFACTS_DIR / encoder_path."
        )
    return joblib.load(encoder_path)


def to_feature_row(sensor_data: SensorData, building_context: BuildingContext) -> pd.DataFrame:
    """
    Combine sensor readings and building context into a single-row DataFrame
    with exactly the columns the encoder expects, in a format pandas/sklearn
    can consume. Returns a DataFrame (not a dict or array) because the
    encoder's ColumnTransformer selects columns by name.
    """
    row = {
        "temperature_c": sensor_data.temperature_c,
        "humidity_pct": sensor_data.humidity_pct,
        "pressure_hpa": sensor_data.pressure_hpa,
        "illuminance_lux": sensor_data.illuminance_lux,
        "tilt_angle_deg": sensor_data.tilt_angle_deg,
        "vibration_magnitude": sensor_data.vibration_magnitude,
        "age_years": building_context.age_years,
        "area_m2": building_context.area_m2,
        "shock_detected": sensor_data.shock_detected,
        "building_type": building_context.building_type.value,
        "material": building_context.material.value,
        "region": building_context.region.value,
    }
    return pd.DataFrame([row])[FEATURE_COLUMNS]


def encode_features(sensor_data: SensorData, building_context: BuildingContext, encoder) -> "np.ndarray":
    """
    Encode a single (SensorData, BuildingContext) pair into the numeric
    feature array the trained models expect. `encoder` must be a
    previously-loaded, already-fit encoder (see load_encoder) — this
    function only calls .transform(), never .fit()/.fit_transform().
    """
    row_df = to_feature_row(sensor_data, building_context)
    return encoder.transform(row_df)
