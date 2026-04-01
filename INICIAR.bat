@echo off
title Bot BP Pizza
color 0A
cls

echo.
echo  ============================================
echo    BP Pizza - Bot de Pedidos
echo  ============================================
echo.

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Node.js no esta instalado.
    echo  [!] Abriendo descarga...
    start https://nodejs.org/en/download
    echo  Instala Node.js y volvé a abrir este archivo.
    pause
    exit
)
echo  [OK] Node.js detectado.

if not exist ".env" (
    echo.
    echo  [!] No se encontro el archivo .env
    echo  [!] Creando ejemplo...
    (
        echo SUPABASE_URL=tu_url_de_supabase_aqui
        echo SUPABASE_KEY=tu_anon_key_de_supabase_aqui
        echo GEMINI_API_KEY=tu_api_key_de_gemini_aqui
    ) > .env
    echo  [!] Completa las keys en el archivo .env que se abrio.
    start notepad .env
    pause
    exit
)

findstr /C:"tu_url_de_supabase_aqui" .env >nul 2>&1
if %errorlevel% equ 0 (
    echo  [!] El .env tiene valores de ejemplo. Completalo primero.
    start notepad .env
    pause
    exit
)
echo  [OK] Archivo .env encontrado.

if not exist "node_modules" (
    echo.
    echo  [..] Instalando dependencias por primera vez...
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] Fallo la instalacion. Verifica internet.
        pause
        exit
    )
    echo  [OK] Dependencias instaladas.
)

echo.
echo  [..] Abriendo el dashboard...
timeout /t 3 /nobreak >nul
start http://localhost:3000/dashboard.html

echo.
echo  ============================================
echo    Sistema iniciado!
echo.
echo    Dashboard: http://localhost:3000/dashboard.html
echo.
echo    Para vincular WhatsApp, ir a la
echo    tab "WhatsApp" en el dashboard.
echo.
echo    NO cierres esta ventana.
echo  ============================================
echo.

node whatsapp.js

echo.
echo  [!] El bot se detuvo.
pause >nul
