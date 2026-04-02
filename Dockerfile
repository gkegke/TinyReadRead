# --- STAGE 1: Build Frontend ---
FROM node:20-slim AS frontend-builder
WORKDIR /web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# --- STAGE 2: Python Runtime ---
FROM python:3.11-slim
WORKDIR /app

# [CRITICAL] System dependencies for audio processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN useradd -m -u 1000 trruser
RUN mkdir -p /app/data/audio /app/data/hf_cache && chown -R trruser:trruser /app/data

# Install Python dependencies
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY server/app ./app
# Copy the built frontend
COPY --from=frontend-builder /web/dist ./app/dist

# Environment Variables
ENV STORAGE_DIR=/app/data/audio
ENV HF_HOME=/app/data/hf_cache
ENV PYTHONUNBUFFERED=1
ENV PORT=7777

USER trruser

# Pre-download default model if requested
ARG PRE_DOWNLOAD=false
RUN if [ "$PRE_DOWNLOAD" = "true" ] ; then \
    python3 -c "from huggingface_hub import snapshot_download; snapshot_download('KittenML/kitten-tts-mini-0.8', cache_dir='/app/data/hf_cache')"; \
    fi

EXPOSE 7777

# Use absolute path to the module
CMD ["python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7777"]
