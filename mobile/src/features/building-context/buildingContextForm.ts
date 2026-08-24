import type {
  BuildingContextFormValues,
  BuildingType,
  Material,
  Region,
} from "../../types/wolis";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export const BUILDING_TYPE_OPTIONS: SelectOption<BuildingType>[] = [
  { value: "residential", label: "Жилой",      description: "Дома, квартиры, ЖК" },
  { value: "commercial",  label: "Коммерческий", description: "Офисы, магазины" },
  { value: "historical",  label: "Исторический", description: "Архитектурное наследие" },
  { value: "industrial",  label: "Промышленный", description: "Заводы, склады" },
];

export const MATERIAL_OPTIONS: SelectOption<Material>[] = [
  { value: "brick",     label: "Кирпич",  description: "Полнотелый / облицовочный" },
  { value: "concrete",  label: "Бетон",   description: "Монолит / панели" },
  { value: "wood",      label: "Дерево",  description: "Бревно / брус / каркас" },
  { value: "mixed",     label: "Смешанный", description: "Несколько материалов" },
];

export const REGION_OPTIONS: SelectOption<Region>[] = [
  { value: "temperate",   label: "Умеренный",      description: "Средняя полоса" },
  { value: "continental", label: "Континентальный", description: "Резкие перепады" },
  { value: "arid",        label: "Засушливый",      description: "Жара / низкая влажность" },
  { value: "coastal",     label: "Прибрежный",      description: "Высокая влажность / соль" },
];

export type FormErrors = Partial<Record<keyof BuildingContextFormValues, string>>;

const AGE_MIN = 0;
const AGE_MAX = 500;
const AREA_MIN = 10;
const AREA_MAX = 1_000_000;

export function validateBuildingContext(
  values: Partial<BuildingContextFormValues>
): FormErrors {
  const errors: FormErrors = {};

  if (!values.building_type) {
    errors.building_type = "Выберите тип здания";
  }

  if (values.age_years === undefined || values.age_years === null || (values.age_years as unknown) === "") {
    errors.age_years = "Укажите возраст здания";
  } else {
    const age = Number(values.age_years);
    if (!Number.isFinite(age) || age < AGE_MIN || age > AGE_MAX) {
      errors.age_years = `Возраст должен быть от ${AGE_MIN} до ${AGE_MAX} лет`;
    }
  }

  if (!values.material) {
    errors.material = "Выберите материал";
  }

  if (values.area_m2 === undefined || values.area_m2 === null || (values.area_m2 as unknown) === "") {
    errors.area_m2 = "Укажите площадь";
  } else {
    const area = Number(values.area_m2);
    if (!Number.isFinite(area) || area < AREA_MIN || area > AREA_MAX) {
      errors.area_m2 = `Площадь должна быть от ${AREA_MIN} до ${AREA_MAX.toLocaleString()} м²`;
    }
  }

  if (!values.region) {
    errors.region = "Выберите регион";
  }

  return errors;
}

export function isFormValid(values: Partial<BuildingContextFormValues>): boolean {
  return Object.keys(validateBuildingContext(values)).length === 0;
}

export const EMPTY_FORM: Partial<BuildingContextFormValues> = {
  building_type: undefined,
  age_years: undefined,
  material: undefined,
  area_m2: undefined,
  region: undefined,
};
