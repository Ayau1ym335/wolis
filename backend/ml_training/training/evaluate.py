import argparse
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

from ml_training.dataset.rules import STATUS_ORDER
from ml_training.sanity_check_scenarios import SCENARIOS
from ml_training.training.train_model import (
    ALL_FEATURE_COLUMNS,
    TARGET_COLUMNS,
    get_encoded_feature_names,
)


def load_artifacts(artifacts_dir: str):
    models = {
        group: joblib.load(os.path.join(artifacts_dir, f"{group}_model.pkl"))
        for group in TARGET_COLUMNS
    }
    encoder = joblib.load(os.path.join(artifacts_dir, "feature_encoder.pkl"))
    with open(os.path.join(artifacts_dir, "metadata.json")) as f:
        metadata = json.load(f)
    return models, encoder, metadata


def evaluate_on_split(models, encoder, split_df: pd.DataFrame, split_name: str) -> dict:
    encoded_X = encoder.transform(split_df[ALL_FEATURE_COLUMNS])
    results = {}

    print(f"\n{'=' * 70}\nEvaluation on {split_name} split ({len(split_df)} rows)\n{'=' * 70}")

    for group_name, target_col in TARGET_COLUMNS.items():
        y_true = split_df[target_col]
        y_pred = models[group_name].predict(encoded_X)

        acc = accuracy_score(y_true, y_pred)
        f1_macro = f1_score(y_true, y_pred, average="macro", labels=STATUS_ORDER, zero_division=0)

        print(f"\n--- {group_name} ---")
        print(f"Accuracy: {acc:.3f}   Macro-F1: {f1_macro:.3f}")
        print(classification_report(y_true, y_pred, labels=STATUS_ORDER, zero_division=0))

        cm = confusion_matrix(y_true, y_pred, labels=STATUS_ORDER)
        cm_df = pd.DataFrame(
            cm,
            index=[f"true_{s}" for s in STATUS_ORDER],
            columns=[f"pred_{s}" for s in STATUS_ORDER],
        )
        print("Confusion matrix:")
        print(cm_df)

        true_critical_idx = STATUS_ORDER.index("critical")
        pred_normal_idx = STATUS_ORDER.index("normal")
        missed_critical = cm[true_critical_idx, pred_normal_idx]
        total_critical = cm[true_critical_idx, :].sum()
        if total_critical > 0:
            print(
                f"Missed critical (true=critical, predicted=normal): "
                f"{missed_critical}/{total_critical} "
                f"({100 * missed_critical / total_critical:.1f}%)"
            )

        results[group_name] = {"accuracy": acc, "macro_f1": f1_macro}

    return results


def report_feature_importance(models, encoder, top_n: int = 8) -> None:
    feature_names = get_encoded_feature_names(encoder)

    print(f"\n{'=' * 70}\nFeature importance (top {top_n} per group)\n{'=' * 70}")

    for group_name, model in models.items():
        importances = model.feature_importances_
        order = np.argsort(importances)[::-1][:top_n]

        print(f"\n--- {group_name} ---")
        for idx in order:
            print(f"  {feature_names[idx]:35s} {importances[idx]:.4f}")


def run_sanity_scenarios_against_model(models, encoder) -> bool:
    print(f"\n{'=' * 70}\nSanity-check scenarios against the TRAINED MODEL\n{'=' * 70}")

    rows = []
    for scenario in SCENARIOS:
        inp = scenario["input"]
        row = {**inp, "area_m2": inp.get("area_m2", 500.0)}
        rows.append(row)

    scenario_df = pd.DataFrame(rows)[ALL_FEATURE_COLUMNS]
    encoded_X = encoder.transform(scenario_df)

    all_matched = True
    for i, scenario in enumerate(SCENARIOS):
        predictions = {
            group: models[group].predict(encoded_X[i : i + 1])[0] for group in TARGET_COLUMNS
        }
        expected = {
            "structural": scenario["expected_structural"].value,
            "climate": scenario["expected_climate"].value,
            "lighting": scenario["expected_lighting"].value,
        }

        matched = all(predictions[g] == expected[g] for g in TARGET_COLUMNS)
        all_matched = all_matched and matched

        status_icon = "MATCH" if matched else "DIFFER"
        print(f"[{status_icon}] {scenario['name']}")
        if not matched:
            for group in TARGET_COLUMNS:
                if predictions[group] != expected[group]:
                    print(f"    {group}: expected={expected[group]}, model_predicted={predictions[group]}")

    print(f"\n{'All' if all_matched else 'NOT all'} scenarios matched the trained model's predictions.")
    print("(A mismatch here is a prompt to investigate, not necessarily a bug — "
          "see docstring for how to interpret this.)")
    return all_matched


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the trained Wolis models.")
    parser.add_argument(
        "--artifacts-dir",
        type=str,
        default=os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "ai", "model"
        ),
    )
    parser.add_argument(
        "--eval-cache-dir",
        type=str,
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "_eval_cache"),
        help="Directory containing val_split.csv / test_split.csv written by train_model.py.",
    )
    args = parser.parse_args()
    models, encoder, metadata = load_artifacts(args.artifacts_dir)
    print(f"Loaded model version {metadata['model_version']}, trained at {metadata['trained_at']}")
    test_df = pd.read_csv(os.path.join(args.eval_cache_dir, "test_split.csv"))
    evaluate_on_split(models, encoder, test_df, "test")
    report_feature_importance(models, encoder)
    run_sanity_scenarios_against_model(models, encoder)


if __name__ == "__main__":
    main()