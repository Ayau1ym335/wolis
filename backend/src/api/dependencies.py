from __future__ import annotations
from uuid import UUID
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from src.db.repositories.measurement_repository import MeasurementRepository
from src.db.session import get_session
from src.services.measurement_service import MeasurementService

# Фиксированный "demo user" — используется заглушкой get_current_user_id
# до тех пор, пока TASK 35 не подключит реальную проверку Supabase JWT.
# Значение стабильно (не меняется между запусками), чтобы история
# измерений для demo-пользователя была консистентной при ручном
# тестировании через curl/Postman.
_STUB_DEMO_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


def get_db_session():
    db = get_session()
    try:
        yield db
    finally:
        db.close()


def get_measurement_repository(
    db: Session = Depends(get_db_session)
) -> MeasurementRepository:
    """
    Фабрика репозитория. Реальная реализация подключает Supabase/Postgres
    client (см. db/client.py) — вынесено в отдельную функцию, чтобы в тестах
    можно было переопределить через app.dependency_overrides без импорта
    реального DB-клиента.
    """
    return MeasurementRepository(db=db)


def get_measurement_service(
    repository: MeasurementRepository = Depends(get_measurement_repository),
) -> MeasurementService:
    return MeasurementService(measurement_repository=repository)


def get_current_user_id(
    authorization: str | None = Header(default=None),
) -> UUID:
    """
    Заглушка на время до TASK 35 (Authentication).

    Контракт зафиксирован уже сейчас: зависимость возвращает UUID
    пользователя. Требует наличие заголовка Authorization (чтобы
    эндпоинты не были доступны совсем без намёка на авторизацию),
    но не проверяет сам токен — любой непустой Authorization
    принимается, и возвращается фиксированный demo user_id.

    Это осознанный временный компромисс ради того, чтобы TASK 12
    (endpoint) можно было протестировать end-to-end через curl/Postman
    уже сейчас, не дожидаясь TASK 35.

    TODO(TASK 35): заменить тело функции на верификацию Supabase JWT
    через external/auth_client.py и извлечение реального user_id
    из проверенного токена. Сигнатура функции (принимает Header,
    возвращает UUID) не должна измениться — вызывающий код
    (routes/*.py) останется нетронутым.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
        )

    return _STUB_DEMO_USER_ID