# ═══════════════════════════════════════════════════════════════════════════════
# INSTRUCCIONES DE DESPLIEGUE — Proyecto Final
# Django + React/Vite + NeonDB (PostgreSQL externo)
# ═══════════════════════════════════════════════════════════════════════════════

## PREPARACIÓN INICIAL (haz esto UNA sola vez)

### 1. Verificar el nombre de tu carpeta de configuración Django

Ejecuta dentro de la carpeta `backend/`:
```bash
ls backend/
```
Busca la carpeta que contiene `settings.py` y `wsgi.py` (no es `pedidos`, no es `venv`).
Podría llamarse `config`, `core`, `app`, o el nombre de tu proyecto.

**Luego reemplaza `config` en estos archivos:**
- `backend/Dockerfile` → línea del CMD de gunicorn
- `k8s/secrets.yaml` → DJANGO_SETTINGS_MODULE

### 2. Ajustar las URLs de la API en el frontend

El frontend debe llamar a la API con rutas relativas (/api/...) para que nginx
pueda hacer el proxy. Revisa tus archivos en `frontend/src/`:

- Si ves llamadas como `http://localhost:8000/api/pedidos/` → cámbialas a `/api/pedidos/`
- O configura `frontend/.env.production` con: `VITE_API_URL=`  (vacío, rutas relativas)

### 3. Variables de entorno del backend

Verifica que tu `backend/.env` tenga al menos:
```
DATABASE_URL=postgres://...@...neon.tech/...
SECRET_KEY=tu-secret-key
DEBUG=True
```

---

## ════════════════════════════════════════════════════════════
## FASE 1 — Docker Compose (máquina local)
## ════════════════════════════════════════════════════════════

### Paso 1: Construir las imágenes
```bash
# Desde la raíz del proyecto (donde está docker-compose.yml)
docker compose build
```

### Paso 2: Levantar los servicios
```bash
docker compose up -d
```

### Paso 3: Verificar que todo está corriendo
```bash
docker compose ps
docker compose logs backend --tail=30
docker compose logs frontend --tail=20
```

### Paso 4: Acceder a la aplicación
- Frontend: http://localhost
- API Django: http://localhost/api/
- Admin Django: http://localhost/admin/

### Paso 5: Prueba de carga con JMeter
- Objetivo de la prueba: GET http://localhost/api/<tu-endpoint-principal>/
- Configura JMeter con diferentes números de usuarios concurrentes (ej: 10, 50, 100)
- Anota: Tiempo medio de respuesta (ms) y Throughput (req/s)

### Paso 6: Detener
```bash
docker compose down
```

---

## ════════════════════════════════════════════════════════════
## FASE 2 — Kubernetes 1 nodo (Minikube o kind)
## ════════════════════════════════════════════════════════════

### Opción A: Minikube (recomendado si tienes Hyper-V/VirtualBox)

#### Paso 1: Iniciar Minikube (1 nodo)
```bash
minikube start --cpus=4 --memory=4096
```

#### Paso 2: Construir imágenes DENTRO de Minikube
```bash
# Apunta Docker al daemon de Minikube
eval $(minikube docker-env)       # Linux/Mac
# En Windows PowerShell:
# & minikube -p minikube docker-env | Invoke-Expression

# Construir imágenes (ya quedan dentro de Minikube)
docker build -t tienda-backend:latest ./backend
docker build -t tienda-frontend:latest ./frontend
```

### Opción B: kind

#### Paso 1: Crear clúster de 1 nodo
```bash
kind create cluster --name tienda-1nodo
```

#### Paso 2: Construir y cargar imágenes en kind
```bash
docker build -t tienda-backend:latest ./backend
docker build -t tienda-frontend:latest ./frontend

kind load docker-image tienda-backend:latest --name tienda-1nodo
kind load docker-image tienda-frontend:latest --name tienda-1nodo
```

---

### Paso 3: Crear el Secret con tus variables de entorno
```bash
# Codifica tu DATABASE_URL en base64
echo -n "postgres://user:pass@host.neon.tech/dbname" | base64

# Codifica tu SECRET_KEY
echo -n "tu-django-secret-key" | base64

# Edita k8s/secrets.yaml y pega los valores codificados, luego:
kubectl apply -f k8s/secrets.yaml
```

### Paso 4: Desplegar la aplicación

#### Escenario 2A — 1 réplica
```bash
# Asegúrate que backend.yaml y frontend.yaml tienen replicas: 1
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml

kubectl get pods -w    # espera a que estén Running
```

#### Medir con JMeter (1 réplica)
- Minikube: obtén la URL con `minikube service frontend --url`
- kind: http://localhost:30080
- Ejecuta JMeter y anota métricas

#### Escenario 2B — 2 réplicas
```bash
kubectl scale deployment backend --replicas=2
kubectl scale deployment frontend --replicas=2
kubectl get pods -w
# → Medir con JMeter
```

#### Escenario 2C — 3 réplicas
```bash
kubectl scale deployment backend --replicas=3
kubectl scale deployment frontend --replicas=3
kubectl get pods -w
# → Medir con JMeter
```

### Ver estado de pods y distribución
```bash
kubectl get pods -o wide          # muestra en qué nodo está cada pod
kubectl top pods                  # consumo de CPU/RAM (requiere metrics-server)
```

### Limpiar Fase 2
```bash
kubectl delete -f k8s/backend.yaml
kubectl delete -f k8s/frontend.yaml
kubectl delete -f k8s/secrets.yaml

# Eliminar clúster:
minikube delete   # o: kind delete cluster --name tienda-1nodo
```

---

## ════════════════════════════════════════════════════════════
## FASE 3 — Kubernetes 2 nodos
## ════════════════════════════════════════════════════════════

### Opción A: Minikube con 2 nodos
```bash
minikube start --nodes=2 --cpus=2 --memory=3072

# Cargar imágenes en todos los nodos
eval $(minikube docker-env)
docker build -t tienda-backend:latest ./backend
docker build -t tienda-frontend:latest ./frontend

# Verifica los nodos
kubectl get nodes
```

### Opción B: kind con 2 nodos
```bash
kind create cluster --name tienda-2nodos --config k8s/kind-2nodes.yaml

# Cargar imágenes
docker build -t tienda-backend:latest ./backend
docker build -t tienda-frontend:latest ./frontend
kind load docker-image tienda-backend:latest --name tienda-2nodos
kind load docker-image tienda-frontend:latest --name tienda-2nodos
```

### Desplegar y medir (igual que Fase 2)
```bash
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml

kubectl get pods -o wide   # verás pods distribuidos en 2 nodos

# → Medir con 1 réplica, luego escalar a 2 y 3
kubectl scale deployment backend --replicas=2
kubectl scale deployment frontend --replicas=2
# → Medir
kubectl scale deployment backend --replicas=3
kubectl scale deployment frontend --replicas=3
# → Medir
```

---

## ════════════════════════════════════════════════════════════
## CONFIGURACIÓN DE JMETER (guía rápida)
## ════════════════════════════════════════════════════════════

Para cada escenario, crea un Test Plan con:

1. **Thread Group** (grupo de usuarios):
   - Number of Threads (usuarios): 10 → 50 → 100
   - Ramp-up Period: 10 segundos
   - Loop Count: 10

2. **HTTP Request Sampler**:
   - Server: `localhost` (Docker Compose) o IP del nodo (K8s)
   - Port: 80 (Docker) o 30080 (K8s con kind)
   - Path: `/api/<tu-endpoint>/`
   - Method: GET

3. **Listeners** (resultados):
   - Summary Report → anota "Average" (tiempo medio ms) y "Throughput" (req/s)
   - Response Time Graph (opcional)

**Exporta los resultados** en CSV para usarlos en el Jupyter Notebook.

---

## ════════════════════════════════════════════════════════════
## TABLA DE MÉTRICAS (llena esta tabla para el notebook)
## ════════════════════════════════════════════════════════════

| Escenario          | Réplicas | Usuarios | T. Medio (ms) | Throughput (req/s) |
|--------------------|----------|----------|---------------|---------------------|
| Docker Compose     | 1        | 10       |               |                     |
| Docker Compose     | 1        | 50       |               |                     |
| Docker Compose     | 1        | 100      |               |                     |
| K8s 1 nodo         | 1        | 10       |               |                     |
| K8s 1 nodo         | 1        | 50       |               |                     |
| K8s 1 nodo         | 1        | 100      |               |                     |
| K8s 1 nodo         | 2        | 10       |               |                     |
| K8s 1 nodo         | 2        | 50       |               |                     |
| K8s 1 nodo         | 2        | 100      |               |                     |
| K8s 1 nodo         | 3        | 10       |               |                     |
| K8s 1 nodo         | 3        | 50       |               |                     |
| K8s 1 nodo         | 3        | 100      |               |                     |
| K8s 2 nodos        | 1        | 10       |               |                     |
| K8s 2 nodos        | 1        | 50       |               |                     |
| K8s 2 nodos        | 1        | 100      |               |                     |
| K8s 2 nodos        | 2        | 10       |               |                     |
| K8s 2 nodos        | 2        | 50       |               |                     |
| K8s 2 nodos        | 2        | 100      |               |                     |
| K8s 2 nodos        | 3        | 10       |               |                     |
| K8s 2 nodos        | 3        | 50       |               |                     |
| K8s 2 nodos        | 3        | 100      |               |                     |

---

## ESTRUCTURA FINAL DEL REPOSITORIO

```
PROYECTO_SOFTWAREII/
├── backend/
│   ├── pedidos/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env              ← NO subir a GitHub (agregar a .gitignore)
│   └── Dockerfile        ← NUEVO
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── nginx.conf        ← NUEVO
│   └── Dockerfile        ← NUEVO
├── k8s/
│   ├── secrets.yaml      ← NO subir con valores reales
│   ├── backend.yaml
│   ├── frontend.yaml
│   └── kind-2nodes.yaml
├── docker-compose.yml    ← NUEVO
├── notebooks/
│   └── analisis.ipynb    ← Jupyter (pendiente)
└── INSTRUCCIONES.md      ← Este archivo
```
