# Wolis — Система интеллектуального мониторинга зданий
> Платформа для предиктивного анализа и мониторинга состояния зданий с использованием IoT-сенсоров (ESP32) и машинного обучения.

**Live-ссылка на продукт (Vercel):** https://wolis.vercel.app

---

## Mock-данные вместо реального ESP32

В текущем MVP используются mock-данные**, а не ESP32.
При сборке hardware-прототипа мы столкнулись с проблемой: ESP32 не удалось подключить к ноутбуку 
из-за ошибок с драйверами USB-UART и COM-портами. Поэтому мы решили взять mock данные как альтернативу
**Что это даёт:**
- Полноценная демонстрация UI/UX, бизнес-логики и AI-модулей
- Стабильная работа на веб- и мобильных платформах без физического железа
- Готовая архитектура для подключения реального ESP32 в будущем (код прошивки лежит в `hardware/`)

---

## Стек технологий

**Frontend** React Native / Expo (Web), TypeScript, Vercel
**Backend** FastAPI (Python), SQLAlchemy
**База данных** PostgreSQL (Supabase)
**Аутентификация** Supabase Auth (JWT)
**AI / ML** Scikit-learn, Pandas, NumPy 
**Отчёты** WeasyPrint → PDF, Supabase Storage 
**Hardware (IoT)** | ESP32 + BME280, MPU6050, GY-30, SW-420

---

## Архитектура проекта

### Структура репозитория

wolis/
├── mobile/                  # React Native 
│   └── src/
│       ├── screens/         # Экраны пользовательского потока
│       ├── features/        # BLE-подключение, сессия измерений, auth
│       ├── services/        # HTTP-клиент и API-вызовы
│       └── navigation/      # Оркестратор потока
├── backend/                 # FastAPI сервер
│   └── src/
│       ├── api/             # Роуты, middleware, зависимости
│       ├── services/        # Бизнес-логика (измерения, оценка, отчёты)
│       ├── ai/              # ML-инференс, препроцессинг, fallback
│       ├── db/              # SQLAlchemy модели и репозитории
│       └── pdf/             # Генерация PDF-отчётов
├── hardware/                # Прошивка ESP32 (не используется в MVP)
├── supabase/                # Миграции БД
└── backend/ml_training/     # Обучение моделей, синтетический датасет

---

## Ключевая логика

### 1. Пользовательский поток (Mobile)

**LoginScreen** Авторизация через Supabase Auth 
**DeviceConnectionScreen** BLE-сканирование и подключение к SensorBox (mock или реальное) 
**MeasurementScreen** Потоковое чтение показаний датчиков, выбор снимка для анализа 
**BuildingContextFormScreen** Ввод контекста здания: тип, возраст, материал, площадь, регион 
**ResultsScreen** Оценка риска, флаги по группам, три варианта решений с ценами 
**ReportPreviewScreen** Генерация и скачивание PDF-отчёта 

### 2. Данные с датчиков

Каждый BLE-пакет содержит JSON с 7 полями:
`temperature_c`, `humidity_pct`, `pressure_hpa` BME280 Climate 
`illuminance_lux` GY-30 (BH1750) Lighting 
`tilt_angle_deg`, `vibration_magnitude`, `shock_detected` MPU6050 + SW-420 Structural 

### 3. AI-пайплайн оценки

При вызове `POST /measurements/{session_id}/assess`:

1. **Препроцессинг** — кодирование sensor data + building context в feature vector
2. **Три ML-модели** (Scikit-learn) предсказывают статус по группам:
   - `structural` — наклон, вибрация, удары
   - `climate` — температура, влажность, давление
   - `lighting` — освещённость
3. **Статусы:** `NORMAL` → `ATTENTION` → `CRITICAL`
4. **Risk Score** — взвешенная вероятность критического состояния (0–100)
5. **Key Concerns** — конкретные проблемы (`high_tilt`, `moisture_risk`, `insufficient_natural_light` и др.)
6. **Fallback** — если ML-модель недоступна или результат невалиден, срабатывает rule-based оценка
7. **Cross-check** — при расхождении ML и правил снижается confidence

### 4. Генерация решений

На основе `key_concerns` система формирует **три варианта**:

**LOW_COST** Минимальный ремонт, сниженный объём материалов (×0.6) 
**OPTIMAL** Стандартная замена/установка (×1.0) 
**ECO** Переиспользование материалов где возможно (×0.85) 

Для каждого варианта рассчитываются:
- Список необходимых работ (`required_changes`)
- Материалы с количеством и ценой (из справочника `materials_reference.json`)
- Оценка экономии (деньги + ресурсы)

### 5. PDF-отчёт

`POST /measurements/{session_id}/report` генерирует PDF через WeasyPrint по HTML-шаблону и загружает в Supabase Storage. Клиент получает signed URL для скачивания.

---

### Локальный запуск

#### Frontend (Expo Web)

cd mobile
npm install
npm run start
Откройте в браузере (нажмите w для web)

#### Backend (FastAPI)

cd backend
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
uvicorn src.main:app --reload

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- Hosted: `https://wolis.onrender.com`