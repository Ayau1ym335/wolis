import argparse
import json
import os
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder


NUMERIC_FEATURES = [
    "temperature_c",
    "humidity_pct",
    "pressure_hpa",
    "illuminance_lux",
    "tilt_angle_deg",
    "vibration_magnitude",
    "age_years",
    "area_m2",
]
BOOLEAN_FEATURES = ["shock_detected"]
CATEGORICAL_FEATURES = ["building_type", "material", "region"]

ALL_FEATURE_COLUMNS = NUMERIC_FEATURES + BOOLEAN_FEATURES + CATEGORICAL_FEATURES

TARGET_COLUMNS = {
    "structural": "structural_status",
    "climate": "climate_status",
    "lighting": "lighting_status",
}
NON_FEATURE_COLUMNS = ["_true_degradation_level", "overall_status"] + list(TARGET_COLUMNS.values())
MODEL_VERSION = "v1.0"
RANDOM_STATE = 42

def build_feature_encoder() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("numeric_passthrough", "passthrough", NUMERIC_FEATURES + BOOLEAN_FEATURES),
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
        ]
    )


def get_encoded_feature_names(encoder: ColumnTransformer) -> list[str]:
    names = list(NUMERIC_FEATURES) + list(BOOLEAN_FEATURES)
    cat_encoder: OneHotEncoder = encoder.named_transformers_["categorical"]
    names += list(cat_encoder.get_feature_names_out(CATEGORICAL_FEATURES))
    return names

def load_dataset(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    missing = [col for col in ALL_FEATURE_COLUMNS + list(TARGET_COLUMNS.values()) if col not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing expected columns: {missing}")
    return df


def split_dataset(df: pd.DataFrame):
    train_df, temp_df = train_test_split(
        df, test_size=0.30, random_state=RANDOM_STATE, stratify=df["overall_status"]
    )
    val_df, test_df = train_test_split(
        temp_df, test_size=0.50, random_state=RANDOM_STATE, stratify=temp_df["overall_status"]
    )
    train_df = train_df.reset_index(drop=True)
    val_df = val_df.reset_index(drop=True)
    test_df = test_df.reset_index(drop=True)
    return train_df, val_df, test_df


def train_group_model(
    group_name: str,
    train_df: pd.DataFrame,
    encoded_train_X: np.ndarray,
) -> RandomForestClassifier:
    target_col = TARGET_COLUMNS[group_name]
    y_train = train_df[target_col].to_numpy()

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=5,
        class_weight="balanced", 
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(encoded_train_X, y_train)
    return model


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the Wolis structural/climate/lighting models.")
    parser.add_argument(
        "--dataset",
        type=str,
        default=os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "dataset", "synthetic_dataset.csv"
        ),
        help="Path to the synthetic dataset CSV.",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=str,
        default=os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "ai", "model"
        ),
        help="Where to write trained model artifacts.",
    )
    args = parser.parse_args()

    print(f"Loading dataset from {args.dataset}")
    df = load_dataset(args.dataset)
    print(f"Loaded {len(df)} rows")

    train_df, val_df, test_df = split_dataset(df)
    print(f"Split sizes -> train: {len(train_df)}, val: {len(val_df)}, test: {len(test_df)}")

    encoder = build_feature_encoder()
    encoded_train_X = encoder.fit_transform(train_df[ALL_FEATURE_COLUMNS])
    encoded_val_X = encoder.transform(val_df[ALL_FEATURE_COLUMNS])
    encoded_test_X = encoder.transform(test_df[ALL_FEATURE_COLUMNS])

    feature_names = get_encoded_feature_names(encoder)

    models = {}
    for group_name in TARGET_COLUMNS:
        print(f"\nTraining {group_name} model...")
        model = train_group_model(group_name, train_df, encoded_train_X)
        models[group_name] = model

    os.makedirs(args.artifacts_dir, exist_ok=True)

    for group_name, model in models.items():
        model_path = os.path.join(args.artifacts_dir, f"{group_name}_model.pkl")
        joblib.dump(model, model_path)
        print(f"Saved {model_path}")

    encoder_path = os.path.join(args.artifacts_dir, "feature_encoder.pkl")
    joblib.dump(encoder, encoder_path)
    print(f"Saved {encoder_path}")

    metadata = {
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_path": os.path.abspath(args.dataset),
        "dataset_rows": len(df),
        "train_rows": len(train_df),
        "val_rows": len(val_df),
        "test_rows": len(test_df),
        "feature_columns": ALL_FEATURE_COLUMNS,
        "encoded_feature_names": feature_names,
        "target_columns": TARGET_COLUMNS,
        "random_state": RANDOM_STATE,
    }
    metadata_path = os.path.join(args.artifacts_dir, "metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved {metadata_path}")

    eval_cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_eval_cache")
    eval_cache_dir = os.path.normpath(eval_cache_dir)
    os.makedirs(eval_cache_dir, exist_ok=True)
    val_df.to_csv(os.path.join(eval_cache_dir, "val_split.csv"), index=False)
    test_df.to_csv(os.path.join(eval_cache_dir, "test_split.csv"), index=False)
    print(f"Cached val/test splits -> {eval_cache_dir}")

    print("\nTraining complete.")


if __name__ == "__main__":
    main()