import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv()

required_vars = ("user", "password", "host", "port", "dbname")
missing = [name for name in required_vars if not os.getenv(name)]
if missing:
    raise RuntimeError(f"Missing database environment variables: {', '.join(missing)}")

database_url = URL.create(
    drivername="postgresql+psycopg2",
    username=os.environ["user"],
    password=os.environ["password"],
    host=os.environ["host"],
    port=int(os.environ["port"]),
    database=os.environ["dbname"],
    query={"sslmode": "require"},
)

engine = create_engine(database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False,)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()