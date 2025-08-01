#!/bin/bash

# Script para iniciar el monitor sintético de Letizia en segundo plano

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$SCRIPT_DIR"

# Asegurarse de que el directorio de logs existe
mkdir -p logs

# Nombre para el archivo de logs del daemon
DAEMON_LOG="logs/daemon.log"
# Archivo PID para rastrear el proceso
PID_FILE="letizia-monitor.pid"

# Verificar si el proceso ya está ejecutándose
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null; then
        echo "El monitor de Letizia ya está ejecutándose con PID $PID"
        exit 1
    else
        echo "Encontrado PID anterior ($PID) que ya no está en ejecución. Continuando..."
        rm "$PID_FILE"
    fi
fi

echo "Iniciando el monitor de Letizia en segundo plano..."

# Iniciar el proceso en segundo plano, redirigiendo la salida a logs
nohup node main.js >> "$DAEMON_LOG" 2>&1 &

# Guardar el PID del proceso 
PID=$!
echo $PID > "$PID_FILE"

echo "Monitor de Letizia iniciado con PID: $PID"
echo "Los logs se están guardando en: $DAEMON_LOG"
echo "Para detener el servicio, ejecuta: ./stop.sh"
