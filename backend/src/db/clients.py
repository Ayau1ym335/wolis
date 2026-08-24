from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.config.settings import get_settings

_database_url = get_settings().database_url
if _database_url and _database_url.startswith("postgresql://"):
    _database_url = _database_url.replace("postgresql://", "postgresql+psycopg://", 1)
if _database_url.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}
elif _database_url.startswith("postgresql"):
    _connect_args = {"prepare_threshold": None}
else:
    _connect_args = {}

engine = create_engine(_database_url, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()