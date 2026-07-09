"""
schemas.py  —  The shapes of the DATA that leaves the API (Pydantic models).

WHY this file exists (and why it's separate from models.py):
    models.py describes how a book is stored in the DATABASE (SQLAlchemy).
    schemas.py describes how a book looks in the API's JSON RESPONSES (Pydantic).

    Keeping them separate is deliberate: the database model may hold columns you
    don't want to expose, and Pydantic gives us automatic validation plus the
    interactive API docs. FastAPI uses these classes to convert ORM objects to
    JSON and to document each endpoint.
"""

from pydantic import BaseModel


class BookOut(BaseModel):
    """
    WHY: the JSON shape of one book in API responses. FastAPI validates every
    outgoing book against this, so the response is always consistent.
    """

    id: int
    title: str
    price: float
    rating: int
    availability: bool

    # WHY from_attributes:
    #   Our crud functions return SQLAlchemy Book OBJECTS (book.title), not dicts.
    #   This tells Pydantic it's allowed to read values off object attributes, so
    #   FastAPI can turn a Book object straight into this JSON shape.
    model_config = {"from_attributes": True}


class StatsOut(BaseModel):
    """
    WHY: the JSON shape of the dashboard summary. One clear contract for the
    frontend's summary cards, so it knows exactly which fields to expect.
    """

    total_books: int
    average_price: float
    in_stock: int
    by_rating: dict[int, int]   # e.g. {1: 226, 2: 196, 3: 203, ...}  (rating -> count)
