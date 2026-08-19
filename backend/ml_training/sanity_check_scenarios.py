from dataset.rules import (
    Status,
    evaluate_structural,
    evaluate_climate,
    evaluate_lighting,
    compute_overall_status,
)

SCENARIOS = [
    {
        "name": "new_concrete_all_normal",
        "input": {
            "tilt_angle_deg": 0.2,
            "vibration_magnitude": 0.02,
            "shock_detected": False,
            "temperature_c": 21.0,
            "humidity_pct": 40.0,
            "pressure_hpa": 1013.0,
            "illuminance_lux": 450.0,
            "age_years": 3,
            "material": "concrete",
            "building_type": "residential",
        },
        "expected_structural": Status.NORMAL,
        "expected_climate": Status.NORMAL,
        "expected_lighting": Status.NORMAL,
        "expected_overall": Status.NORMAL,
    },
    {
        "name": "old_brick_high_tilt_with_shock",
        "input": {
            "tilt_angle_deg": 6.5,
            "vibration_magnitude": 0.5,
            "shock_detected": True,
            "temperature_c": 20.0,
            "humidity_pct": 50.0,
            "pressure_hpa": 1013.0,
            "illuminance_lux": 300.0,
            "age_years": 95,
            "material": "brick",
            "building_type": "residential",
        },
        "expected_structural": Status.CRITICAL,
        "expected_climate": Status.NORMAL,
        "expected_lighting": Status.NORMAL,
        "expected_overall": Status.CRITICAL,
    },
    {
        "name": "old_wood_high_humidity",
        "input": {
            "tilt_angle_deg": 0.4,
            "vibration_magnitude": 0.03,
            "shock_detected": False,
            "temperature_c": 22.0,
            "humidity_pct": 80.0,
            "pressure_hpa": 1010.0,
            "illuminance_lux": 350.0,
            "age_years": 60,
            "material": "wood",
            "building_type": "residential",
        },
        "expected_structural": Status.NORMAL,
        "expected_climate": Status.CRITICAL,
        "expected_lighting": Status.NORMAL,
        "expected_overall": Status.CRITICAL,
    },
    {
        "name": "commercial_building_dim_interior",
        "input": {
            "tilt_angle_deg": 0.1,
            "vibration_magnitude": 0.01,
            "shock_detected": False,
            "temperature_c": 22.0,
            "humidity_pct": 45.0,
            "pressure_hpa": 1013.0,
            "illuminance_lux": 60.0,
            "age_years": 15,
            "material": "concrete",
            "building_type": "commercial",
        },
        "expected_structural": Status.NORMAL,
        "expected_climate": Status.NORMAL,
        "expected_lighting": Status.CRITICAL,
        "expected_overall": Status.ATTENTION,
    },
    {
        "name": "moderate_age_borderline_tilt",
        "input": {
            "tilt_angle_deg": 2.5,
            "vibration_magnitude": 0.05,
            "shock_detected": False,
            "temperature_c": 20.0,
            "humidity_pct": 55.0,
            "pressure_hpa": 1013.0,
            "illuminance_lux": 300.0,
            "age_years": 40,
            "material": "mixed",
            "building_type": "residential",
        },
        "expected_structural": Status.ATTENTION,
        "expected_climate": Status.NORMAL,
        "expected_lighting": Status.NORMAL,
        "expected_overall": Status.ATTENTION,
    },
    {
        "name": "industrial_extreme_temperature",
        "input": {
            "tilt_angle_deg": 0.3,
            "vibration_magnitude": 0.04,
            "shock_detected": False,
            "temperature_c": 45.0,
            "humidity_pct": 30.0,
            "pressure_hpa": 1013.0,
            "illuminance_lux": 250.0,
            "age_years": 20,
            "material": "concrete",
            "building_type": "industrial",
        },
        "expected_structural": Status.NORMAL,
        "expected_climate": Status.ATTENTION,
        "expected_lighting": Status.NORMAL,
        "expected_overall": Status.ATTENTION,
    },
    {
        "name": "shock_only_otherwise_healthy",
        "input": {
            "tilt_angle_deg": 0.2,
            "vibration_magnitude": 0.03,
            "shock_detected": True,
            "temperature_c": 21.0,
            "humidity_pct": 40.0,
            "pressure_hpa": 1013.0,
            "illuminance_lux": 400.0,
            "age_years": 10,
            "material": "concrete",
            "building_type": "residential",
        },
        "expected_structural": Status.ATTENTION,
        "expected_climate": Status.NORMAL,
        "expected_lighting": Status.NORMAL,
        "expected_overall": Status.ATTENTION,
    },
    {
        "name": "historical_building_multi_group_critical",
        "input": {
            "tilt_angle_deg": 5.5,
            "vibration_magnitude": 0.45,
            "shock_detected": True,
            "temperature_c": 20.0,
            "humidity_pct": 88.0,
            "pressure_hpa": 1013.0,
            "illuminance_lux": 40.0,
            "age_years": 120,
            "material": "brick",
            "building_type": "historical",
        },
        "expected_structural": Status.CRITICAL,
        "expected_climate": Status.CRITICAL,
        "expected_lighting": Status.CRITICAL,
        "expected_overall": Status.CRITICAL,
    },
    {
        "name": "new_building_transient_pressure_dip",
        "input": {
            "tilt_angle_deg": 0.1,
            "vibration_magnitude": 0.01,
            "shock_detected": False,
            "temperature_c": 20.0,
            "humidity_pct": 42.0,
            "pressure_hpa": 930.0,
            "illuminance_lux": 500.0,
            "age_years": 2,
            "material": "concrete",
            "building_type": "residential",
        },
        "expected_structural": Status.NORMAL,
        "expected_climate": Status.ATTENTION,
        "expected_lighting": Status.NORMAL,
        "expected_overall": Status.ATTENTION,
    },
    {
        "name": "young_wood_building_moderate_humidity",
        "input": {
            "tilt_angle_deg": 0.3,
            "vibration_magnitude": 0.02,
            "shock_detected": False,
            "temperature_c": 21.0,
            "humidity_pct": 55.0,
            "pressure_hpa": 1013.0,
            "illuminance_lux": 350.0,
            "age_years": 5,
            "material": "wood",
            "building_type": "residential",
        },
        "expected_structural": Status.NORMAL,
        "expected_climate": Status.NORMAL,
        "expected_lighting": Status.NORMAL,
        "expected_overall": Status.NORMAL,
    },
]


def run_sanity_checks(verbose: bool = True) -> bool:
    """
    Run every scenario in SCENARIOS through rules.py and compare against the
    expected labels. Returns True if all scenarios pass, False otherwise.

    This checks rules.py directly. A separate script (to be added alongside
    the trained model in TASK 17/19) re-runs these same SCENARIOS through the
    trained model's predict() function to catch cases where the model learned
    something implausible from the synthetic dataset.
    """
    all_passed = True

    for scenario in SCENARIOS:
        inp = scenario["input"]

        structural = evaluate_structural(
            tilt_angle_deg=inp["tilt_angle_deg"],
            vibration_magnitude=inp["vibration_magnitude"],
            shock_detected=inp["shock_detected"],
            age_years=inp["age_years"],
        )
        climate = evaluate_climate(
            temperature_c=inp["temperature_c"],
            humidity_pct=inp["humidity_pct"],
            pressure_hpa=inp["pressure_hpa"],
            material=inp["material"],
        )
        lighting = evaluate_lighting(
            illuminance_lux=inp["illuminance_lux"],
            building_type=inp["building_type"],
        )
        overall = compute_overall_status(structural, climate, lighting)

        checks = [
            ("structural", structural, scenario["expected_structural"]),
            ("climate", climate, scenario["expected_climate"]),
            ("lighting", lighting, scenario["expected_lighting"]),
            ("overall", overall, scenario["expected_overall"]),
        ]

        scenario_passed = all(actual == expected for _, actual, expected in checks)
        all_passed = all_passed and scenario_passed

        if verbose:
            status_icon = "PASS" if scenario_passed else "FAIL"
            print(f"[{status_icon}] {scenario['name']}")
            if not scenario_passed:
                for group_name, actual, expected in checks:
                    if actual != expected:
                        print(
                            f"    {group_name}: expected={expected}, got={actual}"
                        )
                print(f"    reasoning: {scenario['reasoning']}")

    if verbose:
        print(f"\n{'All' if all_passed else 'NOT all'} sanity scenarios passed.")

    return all_passed


if __name__ == "__main__":
    success = run_sanity_checks(verbose=True)
    raise SystemExit(0 if success else 1)
