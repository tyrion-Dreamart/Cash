# Dreamart Cash Control — Setup en Windows Server
# Ejecutar en PowerShell como Administrador

# ─────────────────────────────────────────
# PASO 1 — Crear base de datos PostgreSQL
# ─────────────────────────────────────────
# Abre pgAdmin o ejecuta en psql:
#
#   CREATE USER dreamart WITH PASSWORD 'dreamart123';
#   CREATE DATABASE dreamart_cash OWNER dreamart;
#
# Cambia la contraseña en backend/.env por una segura.

# ─────────────────────────────────────────
# PASO 2 — Backend (Python / FastAPI)
# ─────────────────────────────────────────

cd C:\dreamart-cash-control\backend

# Crear entorno virtual
python -m venv venv
.\venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt

# Copiar archivo de entorno
copy .env.example .env
# Editar .env con tus credenciales reales de PostgreSQL

# Arrancar servidor backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# El backend queda disponible en:
#   http://<tailscale-ip>:8000
#   Documentación: http://<tailscale-ip>:8000/docs

# ─────────────────────────────────────────
# PASO 3 — Frontend (Next.js)
# ─────────────────────────────────────────

cd C:\dreamart-cash-control\frontend

# Editar .env.local:
#   NEXT_PUBLIC_API_URL=http://<tailscale-ip>:8000

# Instalar dependencias
npm install

# Modo desarrollo (para empezar hoy)
npm run dev

# El frontend queda disponible en:
#   http://<tailscale-ip>:3000

# ─────────────────────────────────────────
# PASO 4 — Producción (opcional, semana 2+)
# ─────────────────────────────────────────

# Build del frontend
npm run build
npm run start

# Para que los servicios arranquen solos con Windows:
# Instalar NSSM (Non-Sucking Service Manager)
# https://nssm.cc/download
#
# nssm install DreamartBackend "C:\dreamart-cash-control\backend\venv\Scripts\uvicorn.exe"
# nssm set DreamartBackend AppParameters "main:app --host 0.0.0.0 --port 8000"
# nssm set DreamartBackend AppDirectory "C:\dreamart-cash-control\backend"
# nssm start DreamartBackend
#
# nssm install DreamartFrontend "C:\Program Files\nodejs\node.exe"
# nssm set DreamartFrontend AppParameters "node_modules\.bin\next start -p 3000"
# nssm set DreamartFrontend AppDirectory "C:\dreamart-cash-control\frontend"
# nssm start DreamartFrontend

# ─────────────────────────────────────────
# VERIFICACIÓN RÁPIDA
# ─────────────────────────────────────────
# 1. Backend health: http://<tailscale-ip>:8000/health
# 2. API docs:       http://<tailscale-ip>:8000/docs
# 3. App:            http://<tailscale-ip>:3000
