"""
seed.py  —  One-off ingestion script: scrape the website, store into PostgreSQL.

WHY this file exists:
    It is the "glue" between the scraper and the database. It is the command you
    run to fill (or refresh) the database:  python seed.py

    It does three things in order:
        1. call the scraper to get clean book data,
        2. open a database session,
        3. hand the data to crud.upsert_books to store it.

    Keeping this as a separate script (not inside the API) means ingestion is an
    explicit action you trigger, not something that runs every time the app boots.
"""

import os
import sys

# WHY this path line:
#   The scraper lives in a SIBLING folder (../scraper), not inside backend/.
#   Adding that folder to Python's import path lets us `import scraper` here.
#   We APPEND (not insert-at-front) so that backend's own modules — database.py,
#   crud.py — always win. Putting scraper first could shadow our files if names
#   ever collide. Backend's folder is already first on the path when we run this
#   script from inside backend/, so appending keeps that priority.
SCRAPER_DIR = os.path.join(os.path.dirname(__file__), "..", "scraper")
sys.path.append(SCRAPER_DIR)

from database import SessionLocal   # noqa: E402  (import after sys.path tweak)
from crud import upsert_books       # noqa: E402
from scraper import scrape_all_books  # noqa: E402


def main():
    # 1. Scrape (no database involved yet).
    books = scrape_all_books()

    # 2. Open a session. WHY try/finally: always close the session, even if the
    #    insert raises, so we never leak a database connection.
    db = SessionLocal()
    try:
        count = upsert_books(db, books)
        print(f"Stored {count} books in the database (duplicates updated, not re-added).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
