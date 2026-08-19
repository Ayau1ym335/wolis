from __future__ import annotations
class DomainError(Exception):
    """Базовый класс для всех доменных исключений приложения."""


class ValidationError(DomainError):
    """
    Бизнес-валидация не пройдена (не путать с Pydantic RequestValidationError,
    которая ловится FastAPI автоматически на границе запроса).
    """


class NotFoundError(DomainError):
    """Запрошенная сущность (сессия измерения, assessment и т.п.) не найдена."""


class ExternalServiceError(DomainError):
    """
    Сбой во внешней зависимости — БД, AI/ML-инференс, Supabase Storage и т.п.
    Используется, когда проблема не в данных пользователя, а в инфраструктуре.
    """