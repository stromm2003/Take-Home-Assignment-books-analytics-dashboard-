"""
database.py  —  STEP 1: Connect to PostgreSQL  (and STEP 3: create the table).

WHY this file exists:
    Every part of the backend (inserting books, the API) needs to talk to the
    same database. Instead of repeating connection code everywhere, we set it
    up ONCE here and import `engine` / `SessionLocal` from this module.

    Importing this file has NO side effects (it does not touch the database on
    import). That is deliberate: importing a module should be safe and quiet.
    Creating tables is an explicit action, so it lives in the __main__ block
    at the bottom and only runs when you execute this file directly.
"""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# WHY load_dotenv():
#   It reads the .env file and puts DB_USER, DB_PASSWORD, etc. into the
#   environment. This keeps secrets/config OUT of the code so the same code
#   runs locally and in Docker just by changing .env.
load_dotenv()

# WHY build the URL from parts:
#   SQLAlchemy needs one connection string in the form:
#     postgresql://user:password@host:port/dbname
#   We assemble it from the .env values so nothing is hard-coded.
DATABASE_URL = (
    f"postgresql://"
    f"{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}"
    f"/{os.getenv('DB_NAME')}"
)

# WHY the engine:
#   The engine is SQLAlchemy's core connection manager. It holds a pool of
#   connections to PostgreSQL and knows how to translate our ORM into SQL.
#   We create exactly ONE engine for the whole app.
engine = create_engine(DATABASE_URL)

# WHY SessionLocal:
#   A "session" is a single conversation with the database (a unit of work:
#   add rows, query, commit). sessionmaker is a factory: calling SessionLocal()
#   gives us a fresh session. We'll use this in STEP 4 to insert books and in
#   STEP 6 for the API. We create the factory once here and reuse it.
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


# WHY get_db:
#   FastAPI needs a fresh database session for each incoming request, and that
#   session must be closed again afterwards — even if the request fails. This
#   generator does exactly that: it hands the route a session (`yield db`), then
#   guarantees `db.close()` runs when the request is done. FastAPI calls this
#   automatically via Depends(get_db) in STEP 6. It's the same open/try/finally
#   pattern seed.py used, packaged so the API can reuse it on every request.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# WHY this block:
#   Running `python database.py` directly executes this. It creates the tables
#   defined in models.py. Doing it here gives us a simple, testable command for
#   this milestone without needing FastAPI yet.
if __name__ == "__main__":
    # We import models so that the Book class registers itself on Base.metadata.
    # (create_all only creates tables it knows about via that registry.)
    from models import Base

    print("Connecting to PostgreSQL...")
    Base.metadata.create_all(engine)
    print("Done. 'books' table is ready.")
