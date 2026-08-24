from __future__ import annotations
class DomainError(Exception):
    """Все доменные исключения приложения"""


class ValidationError(DomainError):
    """ Бизнес-валидация не пройдена  """


class NotFoundError(DomainError):
    """ Запрошенная сущность (сессия измерения, assessment и тд ) не найдена """


class ExternalServiceError(DomainError):
    """Сбой во внешней зависимости БД, ии мл, супабайз и тп. Проблема не в данных пользователя, а в инфраструктуре."""