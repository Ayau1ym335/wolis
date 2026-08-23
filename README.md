# Wolis — Система интеллектуального мониторинга зданий

> Платформа для предиктивного анализа и мониторинга состояния зданий с использованием IoT-сенсоров (ESP32) и машинного обучения.

**Важное примечание по hardware:**
В MVP используются mock-данные. На этапе сборки физического прототипа мы столкнулись с непредвиденной проблемой: ESP32 не смог подключиться к ноутбуку из-за проблем с драйверами/портами. Чтобы продемонстрировать работу продукта, логика опроса сенсоров была переведена в программный режим (Mock SensorBox). Это позволяет полностью оценить UI/UX, бизнес-логику и работу ИИ-моделей.

**Live-ссылка на продукт (Vercel):** [https://wolis.vercel.app](https://wolis.vercel.app)

---

## 🛠 1. Стек технологий

### Frontend (Mobile & Web)
* **Framework:** React Native / Expo (работает как веб-приложение)
* **Language:** TypeScript
* **Hosting:** Vercel

### Backend
* **Framework:** FastAPI (Python)
* **Database:** PostgreSQL (Supabase)
* **ORM:** SQLAlchemy

### AI / ML
* **Libraries:** Scikit-learn, Pandas, Numpy
* **Отчеты:** WeasyPrint (создание PDF)

### Hardware (IoT)
* **Microcontroller:** ESP32 (Симуляция в текущем MVP)
* **Датчики (в теории):** Акселерометр, гироскоп, датчик температуры, влажности и освещенности.

---

## 🏛 2. Архитектура проекта

```text
                ┌─────────────────────────┐
                │     SensorBox (ESP32)   │ 
                │ (Mocked in current MVP) │
                └───────────┬─────────────┘
                            │ (Bluetooth / Wi-Fi)
                            ▼
                ┌─────────────────────────┐
                │      Mobile App         │
                │ (React Native / Expo)   │
                └───────────┬─────────────┘
                            │ (REST API)
                            ▼
                ┌─────────────────────────┐
                │      Python Backend     │
                │       (FastAPI)         │
                └─────┬─────────────┬─────┘
                      │             │
             ┌────────▼────┐   ┌────▼────────┐
             │ AI / ML     │   │ Supabase DB │
             │ Scikit-learn│   │ PostgreSQL  │
             └─────────────┘   └─────────────┘
```

---

## 🚀 3. Инструкция по локальному запуску

### Требования
* Node.js >= 18
* Python >= 3.10

### Запуск Frontend (Expo Web)
```bash
cd mobile
npm install
npm run start
```

### Запуск Backend (FastAPI)
```bash
cd backend
python -m venv venv
venv\Scripts\activate   
pip install -r requirements.txt
uvicorn src.api.main:app --reload
```
Бэкенд будет доступен по адресу `http://localhost:8000`.  
Swagger документация: `http://localhost:8000/docs`.
