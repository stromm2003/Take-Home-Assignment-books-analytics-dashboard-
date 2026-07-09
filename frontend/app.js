/*
  app.js — Orchestration and DOM: sidebar navigation, System Health, rendering,
  table, and interactions. Reads ready-made numbers from Data (data.js) and
  builds charts via renderChart (charts.js). A page's charts are built the first
  time it opens (Chart.js needs a visible canvas to size correctly).
*/

const built = { analytics: false };
const PAGE_TITLES = { overview: "Overview", analytics: "Analytics", books: "Books" };
let loadTime = null;

/* Format helpers */
const gbp = (n) => `£${Number(n).toFixed(2)}`;
const stars = (r) => "★".repeat(r) + "☆".repeat(5 - r);

/* ---- Consistent Lucide-style line icons (one family, no emoji) ---- */
const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const ICON = {
  total: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  inStock: svg('<path d="m7.5 4.3 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  outStock: svg('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'),
  lowRated: svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  avgPrice: svg('<path d="M18 7c0-5.33-8-5.33-8 0"/><path d="M10 7v14"/><path d="M6 21h12"/><path d="M6 13h10"/>'),
  trendUp: svg('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
  trendDown: svg('<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>'),
};

/* ============================================================ Startup */
async function init() {
  setupNav();
  setupSidebar();
  setupExportButtons();
  setupBooksControls();
  setupModal();

  try {
    await loadData();
    setConnection(true);
    markLoaded();
    renderOverview();
    renderBooksTable();
  } catch (err) {
    setConnection(false);
    console.error(err);
    document.getElementById("overview-cards").innerHTML =
      `<div class="error-banner">Could not reach the API at ${API_BASE}. Is the backend running?</div>`;
  }
}

/* ---- Connection + System Health (API/DB reflect the real fetch result) ---- */
function setConnection(ok) {
  const dot = document.getElementById("conn-dot");
  dot.classList.toggle("ok", ok);
  dot.classList.toggle("bad", !ok);
  document.getElementById("conn-text").textContent = ok ? "Live" : "Offline";

  health("hd-api", "hv-api", ok, ok ? "Online" : "Offline");
  health("hd-db", "hv-db", ok, ok ? "Connected" : "Unknown");
  health("hd-scraper", "hv-scraper", ok, ok ? "Ready" : "Idle");
}

function health(dotId, valId, ok, text) {
  const dot = document.getElementById(dotId);
  dot.classList.toggle("ok", ok);
  dot.classList.toggle("bad", !ok);
  const val = document.getElementById(valId);
  val.textContent = text;
  val.classList.toggle("bad", !ok);
}

/* ---- "Last Sync" time + "Updated N ago" ticker (real load timestamp) ---- */
function markLoaded() {
  loadTime = Date.now();
  document.getElementById("sync-time").textContent = new Date(loadTime).toLocaleString("en-GB", {
    hour: "2-digit", minute: "2-digit",
  });
  updateAgo();
  setInterval(updateAgo, 30000);
}

function updateAgo() {
  if (!loadTime) return;
  const s = Math.floor((Date.now() - loadTime) / 1000);
  const txt = s < 60 ? "Updated just now"
    : s < 3600 ? `Updated ${Math.floor(s / 60)} min ago`
    : `Updated ${Math.floor(s / 3600)} h ago`;
  document.getElementById("updated-text").textContent = txt;
}

/* ============================================================ Navigation */
function setupNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });
}

function navigate(name) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("is-active", b.dataset.page === name));
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("is-active", p.id === `page-${name}`));
  document.getElementById("page-title").textContent = PAGE_TITLES[name] || name;

  if (name === "analytics" && !built.analytics && Data.books.length) {
    renderAnalytics();
    built.analytics = true;
  }
  document.getElementById("app").classList.remove("sidebar-open");
}

/* ============================================================ Sidebar controls */
function setupSidebar() {
  const app = document.getElementById("app");
  if (localStorage.getItem("sidebar-collapsed") === "1") app.classList.add("is-collapsed");

  const toggleCollapse = () => {
    app.classList.toggle("is-collapsed");
    localStorage.setItem("sidebar-collapsed", app.classList.contains("is-collapsed") ? "1" : "0");
  };
  document.getElementById("collapse-btn").addEventListener("click", toggleCollapse);
  document.getElementById("nav-toggle").addEventListener("click", () => {
    if (window.matchMedia("(max-width: 768px)").matches) app.classList.toggle("sidebar-open");
    else toggleCollapse();
  });
  document.getElementById("scrim").addEventListener("click", () => app.classList.remove("sidebar-open"));
}

/* ============================================================ Count-up animation */
function animateCount(el, target, decimals, prefix) {
  const dur = 700, start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / dur);
    const val = target * (1 - Math.pow(1 - t, 3)); // easeOutCubic
    el.textContent = prefix + val.toFixed(decimals);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = prefix + target.toFixed(decimals);
  }
  requestAnimationFrame(tick);
}

function animateCounts(container) {
  container.querySelectorAll("[data-count]").forEach((el) => {
    animateCount(el, parseFloat(el.dataset.count) || 0, parseInt(el.dataset.decimals) || 0, el.dataset.prefix || "");
  });
}

/* ============================================================ PAGE: Overview */
function renderOverview() {
  const m = overviewMetrics(Data.books);
  renderCards(m);
  setupCardClicks();
  renderInsights(m);
  renderTop3(Data.books);
}

// Quick Insights: value tiles with metrics NOT already shown on the KPI cards.
function renderInsights(m) {
  const prices = Data.books.map((b) => b.price);
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const fiveStar = Data.books.filter((b) => b.rating === 5).length;

  const items = [
    { icon: ICON.trendUp, tone: "purple", value: gbp(max), label: "Highest price" },
    { icon: ICON.trendDown, tone: "green", value: gbp(min), label: "Lowest price" },
    { icon: ICON.avgPrice, tone: "blue", value: gbp(max - min), label: "Price spread (min–max)" },
    { icon: ICON.lowRated, tone: "yellow", value: `${fiveStar}`, label: "Five-star books" },
  ];

  document.getElementById("insights-list").innerHTML = items
    .map((it) => `
      <div class="insight-tile tone-${it.tone}">
        <span class="insight-icon">${it.icon}</span>
        <div class="insight-body">
          <div class="insight-value">${it.value}</div>
          <div class="insight-label">${it.label}</div>
        </div>
      </div>`)
    .join("");
}

// Four compact Top 3 cards (2x2). One config array keeps them DRY.
function renderTop3(books) {
  const cards = [
    { icon: "🏆", title: "Top 3 Most Expensive", sub: "Highest-priced titles", rows: mostExpensive(books, 3), value: (b) => gbp(b.price) },
    { icon: "💰", title: "Top 3 Least Expensive", sub: "Lowest-priced titles", rows: leastExpensive(books, 3), value: (b) => gbp(b.price) },
    { icon: "⭐", title: "Top 3 Highest Rated", sub: "Best-rated, priciest first", rows: topRated(books, 3), value: (b) => `${stars(b.rating)} · ${gbp(b.price)}` },
    { icon: "📉", title: "Top 3 Lowest Rated", sub: "Lowest-rated titles", rows: lowestRated(books, 3), value: (b) => `${stars(b.rating)} · ${gbp(b.price)}` },
  ];

  document.getElementById("top3-grid").innerHTML = cards
    .map((c) => `
      <div class="top3-card">
        <div class="top3-head">
          <span class="top3-icon">${c.icon}</span>
          <div><h3 class="top3-title">${c.title}</h3><p class="top3-sub">${c.sub}</p></div>
        </div>
        <ol class="top3-list">
          ${c.rows.map((b, i) => `
            <li>
              <span class="rank-badge">${i + 1}</span>
              <span class="top3-name">${escapeHtml(b.title)}</span>
              <span class="top3-val">${c.value(b)}</span>
            </li>`).join("")}
        </ol>
      </div>`)
    .join("");
}

// Card badges show each metric's SHARE of the catalogue (real %), not a trend.
function cardConfig(m) {
  const pct = (n) => (m.total ? Math.round((n / m.total) * 100) : 0);
  const aboveAvg = Data.books.filter((b) => b.price > m.avgPrice).length;
  return [
    { key: "total", tone: "blue", label: "Total Books", count: m.total, decimals: 0, prefix: "", note: "In the catalogue", badge: { text: "100%", arrow: "—" } },
    { key: "inStock", tone: "green", label: "In Stock", count: m.inStock, decimals: 0, prefix: "", note: "Available now", badge: { text: pct(m.inStock) + "%", arrow: "↑" } },
    { key: "outStock", tone: "red", label: "Out of Stock", count: m.outStock, decimals: 0, prefix: "", note: "Unavailable", badge: { text: pct(m.outStock) + "%", arrow: "↓" } },
    { key: "lowRated", tone: "yellow", label: "Low Rated Books", count: m.lowRated, decimals: 0, prefix: "", note: "Rating ≤ 2 stars", badge: { text: pct(m.lowRated) + "%", arrow: "↑" } },
    { key: "avgPrice", tone: "purple", label: "Average Price", count: m.avgPrice, decimals: 2, prefix: "£", note: "Across all books", badge: { text: pct(aboveAvg) + "% >avg", arrow: "↑" } },
  ];
}

function renderCards(m) {
  const grid = document.getElementById("overview-cards");
  grid.innerHTML = cardConfig(m)
    .map((c, i) => `
      <div class="kpi tone-${c.tone}" style="--i:${i}" data-metric="${c.key}" role="button" tabindex="0">
        <div class="kpi-head">
          <span class="kpi-icon">${ICON[c.key]}</span>
          <span class="kpi-badge">${c.badge.arrow} ${c.badge.text}</span>
        </div>
        <div class="kpi-value" data-count="${c.count}" data-decimals="${c.decimals}" data-prefix="${c.prefix}">${c.prefix}0</div>
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-note">${c.note}</div>
      </div>`)
    .join("");
  animateCounts(grid);
}

function setupCardClicks() {
  const grid = document.getElementById("overview-cards");
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".kpi");
    if (card) openBooksModal(card.dataset.metric);
  });
  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".kpi");
    if (card) { e.preventDefault(); openBooksModal(card.dataset.metric); }
  });
}

function booksForMetric(key) {
  const b = Data.books;
  switch (key) {
    case "inStock": return { title: "In Stock", books: b.filter((x) => x.availability) };
    case "outStock": return { title: "Out of Stock", books: b.filter((x) => !x.availability) };
    case "lowRated": return { title: "Low Rated (≤ 2★)", books: b.filter((x) => x.rating <= 2) };
    case "avgPrice": return { title: "All Books by Price", books: [...b].sort((x, y) => y.price - x.price) };
    default: return { title: "All Books", books: b };
  }
}

/* ============================================================ PAGE: Analytics */
function renderAnalytics() {
  const books = Data.books;

  const ratings = ratingCounts(books);
  const ratingLabels = ["1★", "2★", "3★", "4★", "5★"];
  const ratingData = [ratings[1], ratings[2], ratings[3], ratings[4], ratings[5]];

  renderChart("chart-rating-donut", {
    type: "doughnut",
    data: { labels: ratingLabels, datasets: [{ data: ratingData, backgroundColor: COLORS.categorical, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom" } } },
  });

  const hist = priceHistogram(books);
  renderChart("chart-price-hist", {
    type: "bar",
    data: { labels: hist.map((b) => b.label), datasets: [{ data: hist.map((b) => b.count), backgroundColor: COLORS.blue, borderRadius: 6 }] },
    options: axisOptions(),
  });

  const inStock = books.filter((b) => b.availability).length;
  renderChart("chart-stock-pie", {
    type: "pie",
    data: { labels: ["In stock", "Out of stock"], datasets: [{ data: [inStock, books.length - inStock], backgroundColor: [COLORS.green, COLORS.red], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
  });

  const ranges = priceRanges(books);
  renderChart("chart-price-range", {
    type: "bar",
    data: { labels: ranges.map((r) => r.label), datasets: [{ data: ranges.map((r) => r.count), backgroundColor: COLORS.orange, borderRadius: 6 }] },
    options: axisOptions(),
  });

  renderChart("chart-avg-price", {
    type: "bar",
    data: { labels: ratingLabels, datasets: [{ data: avgPriceByRating(books), backgroundColor: COLORS.categorical, borderRadius: 6 }] },
    options: axisOptions(),
  });
}

/* ============================================================ PAGE: Books table */
const tableState = { search: "", rating: "", availability: "", price: "", sortKey: "title", sortDir: "asc", page: 1, pageSize: 25 };

function setupBooksControls() {
  document.getElementById("book-search").addEventListener("input", (e) => {
    tableState.search = e.target.value.toLowerCase(); tableState.page = 1; renderBooksTable();
  });
  ["filter-rating", "filter-availability", "filter-price"].forEach((id) => {
    document.getElementById(id).addEventListener("change", (e) => {
      tableState[id.replace("filter-", "")] = e.target.value; tableState.page = 1; renderBooksTable();
    });
  });
  document.getElementById("page-size").addEventListener("change", (e) => {
    tableState.pageSize = Number(e.target.value); tableState.page = 1; renderBooksTable();
  });
  document.querySelectorAll(".data-table th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (tableState.sortKey === key) tableState.sortDir = tableState.sortDir === "asc" ? "desc" : "asc";
      else { tableState.sortKey = key; tableState.sortDir = "asc"; }
      renderBooksTable();
    });
  });
}

function filteredBooks() {
  const s = tableState;
  const rows = Data.books.filter((b) => {
    if (s.search && !b.title.toLowerCase().includes(s.search)) return false;
    if (s.rating && b.rating !== Number(s.rating)) return false;
    if (s.availability === "in" && !b.availability) return false;
    if (s.availability === "out" && b.availability) return false;
    if (s.price) { const [lo, hi] = s.price.split("-").map(Number); if (b.price < lo || b.price >= hi) return false; }
    return true;
  });
  const dir = s.sortDir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[s.sortKey], bv = b[s.sortKey];
    if (typeof av === "string") return av.localeCompare(bv) * dir;
    return (av - bv) * dir;
  });
  return rows;
}

function renderBooksTable() {
  const rows = filteredBooks();
  const s = tableState;
  const totalPages = Math.max(1, Math.ceil(rows.length / s.pageSize));
  s.page = Math.min(s.page, totalPages);
  const start = (s.page - 1) * s.pageSize;
  const pageRows = rows.slice(start, start + s.pageSize);

  document.getElementById("books-body").innerHTML = pageRows.length
    ? pageRows.map((b) => `
        <tr>
          <td>${escapeHtml(b.title)}</td>
          <td class="num">${gbp(b.price)}</td>
          <td class="stars" title="${b.rating}/5">${stars(b.rating)}</td>
          <td>${availabilityPill(b.availability)}</td>
          <td class="num"><button class="btn-view" data-id="${b.id}">View</button></td>
        </tr>`).join("")
    : `<tr><td colspan="5" class="empty">No books match your filters.</td></tr>`;

  document.querySelectorAll(".data-table th.sortable").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sort === s.sortKey) th.classList.add(s.sortDir === "asc" ? "sort-asc" : "sort-desc");
  });

  document.getElementById("result-count").textContent = `${rows.length} book${rows.length === 1 ? "" : "s"}`;
  renderPager(totalPages);
  wireViewButtons();
}

function renderPager(totalPages) {
  const s = tableState;
  document.getElementById("pager").innerHTML = `
    <button class="pg" ${s.page === 1 ? "disabled" : ""} data-pg="prev">‹ Prev</button>
    <span class="pg-info">Page ${s.page} of ${totalPages}</span>
    <button class="pg" ${s.page === totalPages ? "disabled" : ""} data-pg="next">Next ›</button>`;
  document.querySelectorAll("#pager .pg").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.pg === "prev" && s.page > 1) s.page--;
      if (btn.dataset.pg === "next" && s.page < totalPages) s.page++;
      renderBooksTable();
    });
  });
}

/* ============================================================ Modal */
function setupModal() {
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("book-modal").addEventListener("click", (e) => { if (e.target.id === "book-modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
}

function showModal(html, wide) {
  const modal = document.querySelector("#book-modal .modal");
  modal.classList.toggle("modal--wide", !!wide);
  document.getElementById("modal-content").innerHTML = html;
  document.getElementById("book-modal").hidden = false;
}

function wireViewButtons() {
  document.querySelectorAll("#books-body .btn-view").forEach((btn) => {
    btn.addEventListener("click", () => openBookDetail(Number(btn.dataset.id)));
  });
}

// Single-book detail. `fromKey` (optional) adds a Back link to the card list.
function openBookDetail(id, fromKey) {
  const b = Data.books.find((x) => x.id === id);
  if (!b) return;
  const back = fromKey ? `<button class="btn-ghost modal-back" id="ml-back">← Back to list</button>` : "";
  showModal(`
    ${back}
    <h3 class="modal-title">${escapeHtml(b.title)}</h3>
    <div class="modal-grid">
      <div><span class="modal-k">Price</span><span class="modal-v">${gbp(b.price)}</span></div>
      <div><span class="modal-k">Rating</span><span class="modal-v stars">${stars(b.rating)}</span></div>
      <div><span class="modal-k">Availability</span><span class="modal-v">${availabilityPill(b.availability)}</span></div>
    </div>`, false);
  if (fromKey) {
    document.getElementById("ml-back").addEventListener("click", () => openBooksModal(fromKey));
  }
}

// Drill-down list state for the card popup (search + filters scoped to it).
const modalList = { key: null, search: "", rating: "", availability: "", price: "" };

function openBooksModal(key) {
  modalList.key = key;
  modalList.search = "";
  modalList.rating = "";
  modalList.availability = "";
  modalList.price = "";

  const { title } = booksForMetric(key);
  showModal(`
    <h3 class="modal-title">${title} <span class="count-badge" id="ml-count">0</span></h3>
    <div class="modal-toolbar">
      <input type="search" id="ml-search" class="input" placeholder="Search these books…" />
      <select id="ml-rating" class="input select">
        <option value="">All ratings</option>
        <option value="5">5★</option><option value="4">4★</option><option value="3">3★</option>
        <option value="2">2★</option><option value="1">1★</option>
      </select>
      <select id="ml-availability" class="input select">
        <option value="">All availability</option>
        <option value="in">In stock</option><option value="out">Out of stock</option>
      </select>
      <select id="ml-price" class="input select">
        <option value="">All prices</option>
        <option value="0-20">£0 – £20</option><option value="20-40">£20 – £40</option><option value="40-999">£40+</option>
      </select>
    </div>
    <div class="modal-list-scroll">
      <table class="mini-table">
        <thead><tr><th>Title</th><th class="num">Price</th><th>Rating</th><th>Availability</th><th class="num">Actions</th></tr></thead>
        <tbody id="ml-body"></tbody>
      </table>
    </div>`, true);

  // Re-render only the tbody on input so the search box keeps focus.
  document.getElementById("ml-search").addEventListener("input", (e) => { modalList.search = e.target.value.toLowerCase(); updateModalList(); });
  document.getElementById("ml-rating").addEventListener("change", (e) => { modalList.rating = e.target.value; updateModalList(); });
  document.getElementById("ml-availability").addEventListener("change", (e) => { modalList.availability = e.target.value; updateModalList(); });
  document.getElementById("ml-price").addEventListener("change", (e) => { modalList.price = e.target.value; updateModalList(); });

  document.getElementById("ml-search").focus();
  updateModalList();
}

function updateModalList() {
  const base = booksForMetric(modalList.key).books;
  const rows = base.filter((b) => {
    if (modalList.search && !b.title.toLowerCase().includes(modalList.search)) return false;
    if (modalList.rating && b.rating !== Number(modalList.rating)) return false;
    if (modalList.availability === "in" && !b.availability) return false;
    if (modalList.availability === "out" && b.availability) return false;
    if (modalList.price) {
      const [lo, hi] = modalList.price.split("-").map(Number);
      if (b.price < lo || b.price >= hi) return false;
    }
    return true;
  });

  document.getElementById("ml-count").textContent = rows.length;
  document.getElementById("ml-body").innerHTML = rows.length
    ? rows.map((b) => `
        <tr>
          <td>${escapeHtml(b.title)}</td>
          <td class="num">${gbp(b.price)}</td>
          <td class="stars">${stars(b.rating)}</td>
          <td>${availabilityPill(b.availability)}</td>
          <td class="num"><button class="btn-view" data-id="${b.id}">Details</button></td>
        </tr>`).join("")
    : `<tr><td colspan="5" class="empty">No books match.</td></tr>`;

  // Clicking a row's Details opens that book, with a Back link to this list.
  document.querySelectorAll("#ml-body .btn-view").forEach((btn) => {
    btn.addEventListener("click", () => openBookDetail(Number(btn.dataset.id), modalList.key));
  });
}

function closeModal() { document.getElementById("book-modal").hidden = true; }

/* ============================================================ Shared bits */
function setupExportButtons() {
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-export]");
    if (btn) exportChartPNG(btn.dataset.export, btn.dataset.export);
  });
}

function availabilityPill(inStock) {
  return inStock
    ? `<span class="pill pill-green">In stock</span>`
    : `<span class="pill pill-red">Out of stock</span>`;
}

function truncate(str, n) { return str.length > n ? str.slice(0, n - 1) + "…" : str; }

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

init();
