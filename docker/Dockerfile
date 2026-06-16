FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
    libffi-dev libcairo2 fonts-dejavu && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY static/ ./static/
COPY scripts/ ./scripts/

RUN mkdir -p /app/data/inbox /app/data/processed && \
    useradd -m appuser && chown -R appuser:appuser /app

USER appuser
EXPOSE 7777

ENV PROJECT_ROOT=/app
CMD ["python3", "src/server.py"]
