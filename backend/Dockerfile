# Backend image: FastAPI + scraper + seeding.
#
# BUILD CONTEXT = PROJECT ROOT (see docker-compose.yml). This is required because
# seed.py imports the sibling scraper/ package, so the image needs BOTH backend/
# and scraper/ copied in.

FROM python:3.11-slim

# PYTHONUNBUFFERED: logs stream out immediately (important for `docker logs`).
# PYTHONDONTWRITEBYTECODE: don't litter .pyc files in the container.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install dependencies first so this layer is cached unless requirements change.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code. Both packages live under /app so that, when we run from
# /app/backend, `import models` works and seed.py finds ../scraper.
COPY backend/ ./backend/
COPY scraper/ ./scraper/

WORKDIR /app/backend

# FastAPI listens on 8000 inside the container.
EXPOSE 8000

# start.py waits for the DB, creates tables, seeds if empty, then execs uvicorn.
CMD ["python", "start.py"]
