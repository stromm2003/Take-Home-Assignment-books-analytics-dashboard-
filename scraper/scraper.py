"""
scraper.py  —  Scrapes BooksToScrape and returns clean book data.

WHY this file exists:
    Its ONE job is to fetch and clean data from the website. It does NOT know
    about databases. Keeping it database-free means we can run it on its own to
    check the scraping works, and reuse it from the backend without dragging in
    any DB code.

WHY a function instead of a top-level script:
    Previously the code ran the moment the file was imported. By wrapping it in
    scrape_all_books(), the backend can call it when IT wants, and running this
    file directly still works (see the __main__ block at the bottom).
"""

import time
import requests
from bs4 import BeautifulSoup

# WHY this map:
#   The website encodes the rating as a word in a CSS class ("star-rating Three").
#   Our database stores rating as an integer, so we translate word -> number.
RATING_MAP = {"One": 1, "Two": 2, "Three": 3, "Four": 4, "Five": 5}

BASE_URL = "https://books.toscrape.com"
TOTAL_PAGES = 50


def scrape_all_books():
    """
    WHY this function exists:
        It runs the full scrape (all 50 pages) and returns a list of clean
        dicts. Each dict's keys match the Book model's columns exactly, so the
        database layer can insert them without any extra mapping.
    """
    all_books = []

    for page in range(1, TOTAL_PAGES + 1):
        if page == 1:
            url = f"{BASE_URL}/"
        else:
            url = f"{BASE_URL}/catalogue/page-{page}.html"

        print(f"Scraping page {page}/{TOTAL_PAGES} ...")

        response = requests.get(url)
        if response.status_code != 200:
            print(f"  Failed to load page {page} (status {response.status_code})")
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        books = soup.find_all("article", class_="product_pod")

        for book in books:
            title = book.h3.a["title"]

            # Clean price: "Â£51.77" / "£51.77" -> 51.77 (float)
            raw_price = book.find("p", class_="price_color").text
            price = float(raw_price.replace("Â£", "").replace("£", ""))

            # Availability: text contains "In stock" -> True, else False (boolean)
            in_stock_text = book.find("p", class_="instock availability").text
            availability = "In stock" in in_stock_text

            # Rating: second CSS class word ("star-rating Three") -> 3 (int)
            raw_rating = book.find("p", class_="star-rating")["class"][1]
            rating = RATING_MAP[raw_rating]

            all_books.append({
                "title": title,
                "price": price,
                "availability": availability,
                "rating": rating,
            })

        # WHY sleep: be polite — avoid hammering the server with 50 rapid requests.
        time.sleep(1)

    print(f"Finished. Scraped {len(all_books)} books.")
    return all_books


# WHY this block:
#   Lets you run `python scraper.py` on its own to confirm scraping works,
#   without touching the database.
if __name__ == "__main__":
    result = scrape_all_books()
    print(f"Example record: {result[0] if result else 'none'}")
