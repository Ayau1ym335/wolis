import json
import os
import sys

import joblib
import pandas as pd

ARTIFACTS_DIR = os.environ.get(
    "WOLIS_MODEL_ARTIFACTS_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "ai", "model", "artifacts"),
)

REQUIRED_FILES = [
    "structural_model.pkl",
    "climate_model.pkl",
    "lighting_model.pkl",
    "feature_encoder.pkl",
    "metadata.json",
]

TEST_ROW = {
    "temperature_c": 20.0,
    "humidity_pct": 50.0,
    "pressure_hpa": 1013.0,
    "illuminance_lux": 300.0,
    "tilt_angle_deg": 6.5,
    "vibration_magnitude": 0.5,
    "age_years": 95,
    "area_m2": 500.0,
    "shock_detected": True,
    "building_type": "residential",
    "material": "brick",
    "region": "temperate",
}


def check_files_present() -> None:
    missing = [f for f in REQUIRED_FILES if not os.path.isfile(os.path.join(ARTIFACTS_DIR, f))]
    if missing:
        print(f"FAILED: missing artifact files in {ARTIFACTS_DIR}: {missing}")
        sys.exit(1)
    print(f"All {len(REQUIRED_FILES)} required artifact files found in {ARTIFACTS_DIR}")


def load_and_predict() -> None:
    with open(os.path.join(ARTIFACTS_DIR, "metadata.json")) as f:
        metadata = json.load(f)
    print(f"Loaded metadata: model_version={metadata['model_version']}, trained_at={metadata['trained_at']}")

    encoder = joblib.load(os.path.join(ARTIFACTS_DIR, "feature_encoder.pkl"))
    structural_model = joblib.load(os.path.join(ARTIFACTS_DIR, "structural_model.pkl"))
    climate_model = joblib.load(os.path.join(ARTIFACTS_DIR, "climate_model.pkl"))
    lighting_model = joblib.load(os.path.join(ARTIFACTS_DIR, "lighting_model.pkl"))
    print("Loaded encoder + 3 models successfully.")

    feature_columns = metadata["feature_columns"]
    row_df = pd.DataFrame([TEST_ROW])[feature_columns]
    encoded_X = encoder.transform(row_df)

    structural_pred = structural_model.predict(encoded_X)[0]
    climate_pred = climate_model.predict(encoded_X)[0]
    lighting_pred = lighting_model.predict(encoded_X)[0]

    print("\nInference on test row (old brick, high tilt, shock detected):")
    print(f"  structural = {structural_pred}")
    print(f"  climate    = {climate_pred}")
    print(f"  lighting   = {lighting_pred}")

    if structural_pred != "critical":
        print(
            "FAILED: expected structural=critical for this unambiguous test row, "
            f"got {structural_pred}. Artifacts may be stale or corrupted."
        )
        sys.exit(1)

    print("\nArtifact verification PASSED — artifacts are loadable and produce a plausible prediction outside the training environment.")


if __name__ == "__main__":
    check_files_present()
    load_and_predict()
