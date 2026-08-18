import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session


def get_engine():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL не задан")
    return create_engine(database_url, pool_pre_ping=True)

def get_session_factory():
    engine = get_engine()
    return sessionmaker(bind=engine, expire_on_commit=False)

def get_session() -> Session:
    return get_session_factory()()