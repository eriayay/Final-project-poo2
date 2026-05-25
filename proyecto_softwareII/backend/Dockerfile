# ─── Backend Django - Dockerfile ───────────────────────────────────────────
FROM python:3.11-slim

# Variables de entorno para Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependencias del sistema necesarias para psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Recolectar archivos estáticos (para admin de Django)
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

# Gunicorn: 3 workers, escucha en 0.0.0.0:8000
# ⚠️  REEMPLAZA "config" por el nombre de tu carpeta que tiene wsgi.py y settings.py
#     Puedes verificarlo con: ls backend/ (busca la carpeta que NO sea pedidos, venv, etc.)
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120", "config.wsgi:application"]
