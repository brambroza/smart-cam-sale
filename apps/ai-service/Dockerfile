FROM python:3.11-slim

# libgl1, libglib2.0-0 — runtime deps for opencv / insightface
# gcc, g++, build-essential — needed to compile insightface from source
# purge build tools after install to keep image slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 \
      gcc g++ build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove gcc g++ build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY app ./app

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
