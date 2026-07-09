"""
crud.py  —  All database read/write logic lives here.

WHY this file exists:
    "CRUD" = Create, Read, Update, Delete. Instead of scattering database
    operations across the app, we keep them in ONE place. The seed script and
    (later) the API both call these functions. If we ever change HOW we store
    books, we only edit this file.

    Every function takes a `db` session as its first argument. It does NOT
    create the session itself — the caller decides that. This keeps these
    functions easy to reuse and easy to test.
"""

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert

from models import Book


def upsert_books(db, books):
    """
    STEP 4 + STEP 5: insert books, but never create duplicates.

    WHY "upsert":
        UPSERT = UPDATE if it already exists, otherwise INSERT. PostgreSQL does
        this in a single statement with "INSERT ... ON CONFLICT". We rely on the
        UNIQUE constraint on `title`: if a title already exists, instead of
        failing or duplicating, we UPDATE that row's price/rating/availability.

        This makes the whole ingestion "idempotent": run the scraper once or ten
        times, you always end up with exactly one row per book, kept up to date.

    Args:
        db:    an active SQLAlchemy session (from SessionLocal()).
        books: list of dicts, each with keys title, price, rating, availability.

    Returns:
        The number of books processed.
    """
    if not books:
        return 0

    # WHY de-duplicate first:
    #   BooksToScrape lists a few titles more than once, so `books` can contain
    #   two rows with the SAME title. PostgreSQL's ON CONFLICT cannot update the
    #   same target row twice within one statement, so it would raise a
    #   "cannot affect row a second time" error. We collapse duplicates here,
    #   keeping the LAST occurrence of each title (dicts preserve insertion order,
    #   and a later key assignment overwrites the earlier one).
    unique_by_title = {book["title"]: book for book in books}
    deduped_books = list(unique_by_title.values())

    # Build one bulk INSERT for all books at once (fast: a single round-trip).
    stmt = insert(Book).values(deduped_books)

    # ON CONFLICT (title): if the title already exists, update these columns
    # to the newly scraped values. `stmt.excluded` refers to the row that WOULD
    # have been inserted, so excluded.price is the freshly scraped price.
    stmt = stmt.on_conflict_do_update(
        index_elements=["title"],          # the column that has the UNIQUE constraint
        set_={
            "price": stmt.excluded.price,
            "rating": stmt.excluded.rating,
            "availability": stmt.excluded.availability,
        },
    )

    db.execute(stmt)
    db.commit()          # WHY commit: make the changes permanent in PostgreSQL.
    return len(deduped_books)


def get_books(db):
    """
    Read helper: return every book. Used by the API in STEP 6.
    Defined here now so all database access stays in one file.
    """
    return db.query(Book).all()


def get_book(db, book_id):
    """
    Return a single book by its primary key, or None if it doesn't exist.
    The API layer turns the None into a 404.
    """
    return db.query(Book).filter(Book.id == book_id).first()


def search_books(db, query):
    """
    Case-insensitive title search. ILIKE with %term% matches the term anywhere
    in the title. Doing this in SQL keeps it fast and lets the database use its
    index rather than pulling every row into Python.
    """
    return db.query(Book).filter(Book.title.ilike(f"%{query}%")).all()


def get_stats(db):
    """
    Aggregate numbers for the dashboard's summary cards.

    WHY compute this in SQL (not in Python):
        Counting and averaging 999 rows is exactly what the database is good at.
        We ask PostgreSQL for the totals directly instead of pulling every row
        into Python and looping — faster, and it scales if the table grows.

    Returns a plain dict that matches schemas.StatsOut.
    """
    total_books = db.query(Book).count()

    # func.avg returns None if the table is empty, so fall back to 0.0.
    average_price = db.query(func.avg(Book.price)).scalar() or 0.0

    in_stock = db.query(Book).filter(Book.availability.is_(True)).count()

    # GROUP BY rating -> list of (rating, count) pairs, turned into a dict.
    rating_rows = (
        db.query(Book.rating, func.count(Book.id))
        .group_by(Book.rating)
        .all()
    )
    by_rating = {rating: count for rating, count in rating_rows}

    return {
        "total_books": total_books,
        "average_price": round(float(average_price), 2),
        "in_stock": in_stock,
        "by_rating": by_rating,
    }
