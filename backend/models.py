"""
models.py  —  STEP 2: Define the shape of our data (the ORM model).

WHY this file exists:
    SQLAlchemy is an ORM (Object Relational Mapper). Instead of writing raw
    SQL like "CREATE TABLE books (...)", we describe the table ONCE as a
    Python class. SQLAlchemy then translates that class into SQL for us.
    This keeps the table definition in one place and lets the rest of the
    app work with normal Python objects (book.title) instead of SQL strings.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean
from sqlalchemy.orm import declarative_base

# WHY Base exists:
#   declarative_base() creates a parent class that all our models inherit from.
#   SQLAlchemy uses it as a registry: every class that inherits from Base gets
#   recorded in Base.metadata. Later, Base.metadata.create_all(engine) can look
#   at that registry and create every table at once.
Base = declarative_base()


class Book(Base):
    """
    WHY this class exists:
        It represents ONE row in the "books" table. One Book instance = one book.
        Each Column below becomes a column in PostgreSQL.
    """

    __tablename__ = "books"

    # WHY a separate integer id:
    #   A surrogate primary key. It gives every row a stable, unique identifier
    #   that never changes, independent of the book's title or price.
    id = Column(Integer, primary_key=True, autoincrement=True)

    # WHY unique=True on title:
    #   On BooksToScrape the title is effectively the natural identifier of a
    #   book. Making it unique lets us prevent duplicates in STEP 5: if we run
    #   the scraper twice, PostgreSQL will recognise the same title and we can
    #   UPDATE instead of inserting a second copy.
    title = Column(String, nullable=False, unique=True)

    price = Column(Float, nullable=False)          # cleaned to float in the scraper
    rating = Column(Integer, nullable=False)       # "Three" -> 3 in the scraper
    availability = Column(Boolean, nullable=False) # "In stock" -> True in the scraper

    def __repr__(self):
        # WHY: a readable printout when debugging (e.g. in `python` shell or logs).
        return f"<Book title={self.title!r} price={self.price} rating={self.rating}>"
