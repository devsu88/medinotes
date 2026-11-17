# Stage 1: static export of the web UI
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: API + static files in one container
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
COPY src ./src
RUN uv sync --frozen --no-dev
COPY --from=web /web/out ./static
ENV STATIC_DIR=/app/static PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "medinotes.app:app", "--host", "0.0.0.0", "--port", "8000"]
