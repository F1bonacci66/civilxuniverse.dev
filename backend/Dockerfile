# syntax=docker/dockerfile:1.7

ARG PYTHON_VERSION=3.10
FROM python:${PYTHON_VERSION}-slim AS builder

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts

FROM python:${PYTHON_VERSION}-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive

# Wine требует поддержки i386
RUN set -eux; \
    dpkg --add-architecture i386; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i 's|http://deb.debian.org/debian-security|http://mirror.yandex.ru/debian-security|g' /etc/apt/sources.list.d/debian.sources; \
        sed -i 's|http://deb.debian.org/debian|http://mirror.yandex.ru/debian|g' /etc/apt/sources.list.d/debian.sources; \
    fi; \
    if [ -f /etc/apt/sources.list ]; then \
        sed -i 's|deb.debian.org|mirror.yandex.ru|g' /etc/apt/sources.list; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        wget \
        xauth \
        xvfb \
        winbind \
        wine64 \
        wine32 \
        wine \
        fonts-wine \
        gosu \
    && rm -rf /var/lib/apt/lists/* \
    && (curl -L --connect-timeout 30 --max-time 120 https://raw.githubusercontent.com/Winetricks/winetricks/master/src/winetricks -o /usr/local/bin/winetricks 2>&1 || wget --timeout=30 --tries=2 -O /usr/local/bin/winetricks https://raw.githubusercontent.com/Winetricks/winetricks/master/src/winetricks 2>&1) \
    && chmod +x /usr/local/bin/winetricks \
    && winetricks --version || echo "winetricks installed but version check failed"

RUN ln -sf /usr/lib/wine/wine64 /usr/bin/wine || true

COPY --from=builder /install /usr/local
COPY --from=builder /app /app

RUN useradd --no-create-home --uid 1001 backend \
    && chown -R backend:backend /app

USER backend
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

