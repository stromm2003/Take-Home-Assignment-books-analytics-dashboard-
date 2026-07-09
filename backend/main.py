"""
main.py  —  STEP 6: the REST API (FastAPI).

WHY this file exists:
    It is the HTTP layer — the public face of the backend. It turns web requests
    (GET /books) into function calls (crud.get_books) and returns JSON. It holds
    NO database logic itself: every route asks crud to do the actual work. That
    keeps HTTP concerns and database concerns cleanly separated.

Run it with:   uvicorn main:app --reload
Then open:     http://127.0.0.1:8000/docs   (interactive API documentation)
"""

from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import crud
from database import get_db
from schemas import BookOut, StatsOut

# WHY the app object:
#   This is the FastAPI application. Uvicorn (the web server) looks for it as
#   "main:app". We give it a title/description so the auto-generated /docs page
#   reads nicely.
app = FastAPI(
    title="BooksToScrape API",
    description="Serves scraped book data from PostgreSQL.",
    version="1.0.0",
)

# WHY CORS:
#   Our frontend dashboard runs on a DIFFERENT origin (e.g. a static page or a
#   separate port). Browsers block cross-origin requests by default. This
#   middleware tells the browser it's allowed to call this API. We allow all
#   origins here because it's a self-contained take-home; in production you'd
#   list only your real frontend's URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """
    WHY: a tiny "is the server alive?" endpoint. Load balancers, Docker health
    checks, and you-during-debugging all use it to confirm the app is running
    without touching the database.
    """
    return {"status": "ok"}


@app.get("/books", response_model=List[BookOut])
def read_books(db: Session = Depends(get_db)):
    """
    WHY: returns every book as JSON — this feeds the dashboard's table.

    HOW the pieces connect:
      - Depends(get_db) gives this request a database session (auto-closed after).
      - crud.get_books(db) does the actual query.
      - response_model=List[BookOut] tells FastAPI to shape each row as a BookOut
        and document the response in /docs.
    """
    return crud.get_books(db)


# IMPORTANT: /books/search must be declared BEFORE /books/{book_id}.
# Routes match top-to-bottom; if {book_id} came first, a request to
# /books/search would try to parse "search" as an integer id and fail.
@app.get("/books/search", response_model=List[BookOut])
def search_books(
    q: str = Query("", description="Case-insensitive text to match in the title"),
    db: Session = Depends(get_db),
):
    """
    WHY: the assignment requires at least one query parameter. GET /books/search?q=term
    returns books whose title contains `q` (case-insensitive). An empty q returns all.
    """
    return crud.search_books(db, q)


@app.get("/books/{book_id}", response_model=BookOut)
def read_book(book_id: int, db: Session = Depends(get_db)):
    """
    WHY: fetch one book by id (the brief's canonical GET /items/{id}).
    Returns 404 if no book has that id.
    """
    book = crud.get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@app.get("/stats", response_model=StatsOut)
def read_stats(db: Session = Depends(get_db)):
    """
    WHY: returns aggregate numbers (totals, average price, counts per rating)
    for the dashboard's summary cards. The database does the maths; we just
    forward the result.
    """
    return crud.get_stats(db)
