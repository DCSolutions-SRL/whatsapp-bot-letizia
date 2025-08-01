#!/bin/bash

# Script para detener el monitor sintético de Letizia que se ejecuta en segundo plano

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$SCRIPT_DIR"

# Archivo PID
PID_FILE="letizia-monitor.pid"

# Verificar si el PID existe
if [ ! -f "$PID_FILE" ]; then
    echo "No se encontró el archivo PID. El monitor de Letizia no parece estar ejecutándose."
    exit 1
fi

# Leer el PID
PID=$(cat "$PID_FILE")

# Verificar si el proceso aún está en ejecución 
if ! ps -p "$PID" > /dev/null; then
    echo "El proceso con PID $PID ya no está en ejecución."
    rm "$PID_FILE"
    exit 1
fi

# Intentar terminar el proceso gracefully
echo "Enviando señal de terminación al proceso $PID..."
kill -15 "$PID"

# Esperar hasta 10 segundos para que el proceso termine
MAX_WAIT=10
for i in $(seq 1 $MAX_WAIT); do
    if ! ps -p "$PID" > /dev/null; then
        echo "El proceso con PID $PID ha terminado correctamente."
        rm "$PID_FILE"
        exit 0
    fi
    sleep 1
done

# Si todavía está en ejecución, forzar la terminación
echo "El proceso no terminó después de $MAX_WAIT segundos. Forzando terminación..."
kill -9 "$PID"

# Verificar si se terminó
if ! ps -p "$PID" > /dev/null; then
    echo "El proceso con PID $PID ha sido terminado forzosamente."
    rm "$PID_FILE"
    exit 0
else
    echo "ERROR: No se pudo terminar el proceso con PID $PID"
    exit 1
fi
