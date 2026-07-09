/*
  data.js — Everything about DATA: fetching from the API and deriving metrics.
  All values are computed from the real scraped data (no simulated fields).

  Nothing here touches the DOM. It exposes a global `Data` object that app.js
  and charts.js read from. Keeping data logic in one place means the rest of the
  app just consumes ready-made numbers.
*/

// Single source of truth for the backend location (change once for Docker).
const API_BASE = "http://127.0.0.1:8000";

const Data = {
  books: [],   // raw rows from GET /books
  stats: null, // GET /stats
};

/* ---------- Fetching ---------- */

// Load both endpoints in parallel and cache them. Called once on startup.
async function loadData() {
  const [booksRes, statsRes] = await Promise.all([
    fetch(`${API_BASE}/books`),
    fetch(`${API_BASE}/stats`),
  ]);
  if (!booksRes.ok || !statsRes.ok) {
    throw new Error("API request failed");
  }
  Data.books = await booksRes.json();
  Data.stats = await statsRes.json();
  return Data;
}

/* ---------- Derived metrics (all from REAL data) ---------- */

function overviewMetrics(books) {
  const total = books.length;
  const inStock = books.filter((b) => b.availability).length;
  const outStock = total - inStock;
  const lowRated = books.filter((b) => b.rating <= 2).length;
  const avgPrice = total
    ? books.reduce((sum, b) => sum + b.price, 0) / total
    : 0;
  return { total, inStock, outStock, lowRated, avgPrice };
}

// {1..5 : count}
function ratingCounts(books) {
  const d = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  books.forEach((b) => (d[b.rating] += 1));
  return d;
}

// Histogram counts in fixed-width bands up to `max`.
function priceHistogram(books, width = 10, max = 60) {
  const bands = [];
  for (let start = 0; start < max; start += width) {
    const end = start + width;
    const count = books.filter((b) => b.price >= start && b.price < end).length;
    bands.push({ label: `£${start}–${end}`, count });
  }
  return bands;
}

// Broad named price ranges (fewer, wider buckets than the histogram).
function priceRanges(books) {
  const ranges = [
    { label: "£0–20", test: (p) => p < 20 },
    { label: "£20–40", test: (p) => p >= 20 && p < 40 },
    { label: "£40+", test: (p) => p >= 40 },
  ];
  return ranges.map((r) => ({
    label: r.label,
    count: books.filter((b) => r.test(b.price)).length,
  }));
}

// Average price for each star rating (1..5).
function avgPriceByRating(books) {
  const result = [];
  for (let r = 1; r <= 5; r++) {
    const subset = books.filter((b) => b.rating === r);
    const avg = subset.length
      ? subset.reduce((s, b) => s + b.price, 0) / subset.length
      : 0;
    result.push(Number(avg.toFixed(2)));
  }
  return result;
}

// Sort helpers returning NEW arrays (never mutate the cache).
function topRated(books, n = 10) {
  return [...books]
    .sort((a, b) => b.rating - a.rating || b.price - a.price)
    .slice(0, n);
}

// Lowest rated; ties broken by price descending (matches topRated's tiebreak).
function lowestRated(books, n = 10) {
  return [...books]
    .sort((a, b) => a.rating - b.rating || b.price - a.price)
    .slice(0, n);
}

function mostExpensive(books, n = 10) {
  return [...books].sort((a, b) => b.price - a.price).slice(0, n);
}

function leastExpensive(books, n = 10) {
  return [...books].sort((a, b) => a.price - b.price).slice(0, n);
}
