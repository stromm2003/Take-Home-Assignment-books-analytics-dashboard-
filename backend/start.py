"""
start.py  —  Container entrypoint for the backend.

WHY this file exists:
    Inside Docker we can't rely on running commands by hand. This script does the
    whole boot sequence in order, every time the backend container starts:

        1. wait for PostgreSQL to accept connections (it may still be starting),
        2. create the tables if they don't exist,
        3. run the scraper + seed ONLY if the table is empty (so the first
           `docker compose up` populates data, but later restarts are instant),
        4. hand off to uvicorn.

    It's written in Python (not a shell script) so it behaves identically on
    Windows and Linux and isn't broken by CRLF line endings.
"""

import os
import subprocess
import sys
import time

from sqlalchemy import text

import models
from database import engine, SessionLocal


def wait_for_db(attempts=30, delay=2):
    """Retry connecting until PostgreSQL is ready (or give up after ~60s)."""
    for i in range(1, attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("Database is ready.", flush=True)
            return
        except Exception as exc:  # noqa: BLE001 - we want to retry on any DB error
            print(f"Database not ready ({i}/{attempts}): {exc}", flush=True)
            time.sleep(delay)
    sys.exit("Database never became ready — aborting.")


def main():
    wait_for_db()

    # Create tables if missing (safe to run every start; it's create-if-not-exists).
    models.Base.metadata.create_all(engine)
    print("Tables ready.", flush=True)

    # Seed only when the catalogue is empty.
    db = SessionLocal()
    try:
        count = db.query(models.Book).count()
    finally:
        db.close()

    if count == 0:
        print("No books found — running scraper + seed (~1 minute)...", flush=True)
        subprocess.run([sys.executable, "seed.py"], check=True)
    else:
        print(f"{count} books already present — skipping seed.", flush=True)

    # Replace this process with uvicorn so it becomes the container's main
    # process and receives stop/restart signals directly.
    print("Starting API on 0.0.0.0:8000 ...", flush=True)
    os.execvp(sys.executable, [sys.executable, "-m", "uvicorn",
                               "main:app", "--host", "0.0.0.0", "--port", "8000"])


if __name__ == "__main__":
    main()
