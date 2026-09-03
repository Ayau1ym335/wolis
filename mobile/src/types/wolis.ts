export type BuildingType = "residential" | "commercial" | "historical" | "industrial";
export type Material = "brick" | "concrete" | "wood" | "mixed";
export type Region = "temperate" | "continental" | "arid" | "coastal";
export type Status = "normal" | "attention" | "critical";
export type Confidence = "low" | "medium" | "high";
export type SolutionType = "low_cost" | "optimal" | "eco";

export interface RawSensorPacket {
  temperature_c: number;
  humidity_pct: number;
  pressure_hpa: number;
  illuminance_lux: number;
  tilt_angle_deg: number;
  vibration_magnitude: number;
  shock_detected: boolean;
  /** Present in real hardware packets. True when all sensors initialised correctly. */
  all_sensors_ok?: boolean;
}

export interface BuildingContextFormValues {
  building_type: BuildingType;
  age_years: number;
  material: Material;
  area_m2: number;
  region: Region;
}

export interface CreateMeasurementPayload extends RawSensorPacket, BuildingContextFormValues {
  user_id: string;
}

export interface CreateMeasurementResponse {
  session_id: string;
  status: string;
  created_at: string;
}

export interface FeatureWeight {
  sensor: string;
  weight: number;
  label: string;
}

export interface ParameterFlag {
  group: string;
  status: Status;
  confidence: number;
  contributing_sensors: string[];
  feature_weights: FeatureWeight[];
  threshold_description: string;
}

export interface AssessmentSummary {
  overall_risk_score: number;
  overall_status: Status;
  confidence: Confidence;
  ml_model_used: boolean;
  model_version: string | null;
  parameter_flags: ParameterFlag[];
  key_concerns: string[];
}

export interface MaterialLineItemSummary {
  material_name: string;
  quantity: number;
  unit: string;
  unit_price_at_calculation: number;
  is_estimated_price: boolean;
  line_cost: number;
  work_description: string;
}

export interface SolutionSummary {
  type: SolutionType;
  required_changes: string[];
  material_line_items: MaterialLineItemSummary[];
  estimated_cost_amount: number;
  estimated_cost_currency: string;
  estimated_savings_money: number;
  estimated_savings_resources_description: string;
  baseline_cost_amount?: number;
  baseline_cost_currency?: string;
}

export interface MeasurementSummary {
  session_id: string;
  building_type: string;
  /** Backend field: building_age_years */
  building_age_years: number;
  /** Backend field: construction_material */
  construction_material: string;
  /** Backend field: building_area_m2 */
  building_area_m2: number;
  region: string;
  status: string;
  created_at: string;
  overall_status: string | null;
  overall_risk_score: number | null;
}

export interface SensorReadings {
  temperature_c: number;
  humidity_pct: number;
  pressure_hpa: number;
  illuminance_lux: number;
  tilt_angle_deg: number;
  vibration_magnitude: number;
  shock_detected: boolean;
}

export interface WolisResult {
  measurement: MeasurementSummary;
  assessment: AssessmentSummary;
  solutions: SolutionSummary[];
  sensor_readings?: SensorReadings;
}

export interface ApiErrorBody {
  error: string;
  session_id?: string;
}