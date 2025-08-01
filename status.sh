#!/bin/bash

# Script para verificar el estado del monitor sintético de Letizia

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$SCRIPT_DIR"

# Archivo PID
PID_FILE="letizia-monitor.pid"

# Función para mostrar el uso de memoria
show_memory_usage() {
    PID=$1
    # Obtener el uso de memoria en MB
    MEM_USAGE=$(ps -o rss= -p $PID | awk '{print $1/1024 " MB"}')
    echo "Uso de memoria: $MEM_USAGE"
    
    # Verificar si el uso de memoria es excesivo (más de 500MB)
    MEM_VALUE=$(ps -o rss= -p $PID | awk '{print $1/1024}')
    if (( $(echo "$MEM_VALUE > 500" | bc -l) )); then
        echo "⚠️ ADVERTENCIA: Uso de memoria elevado"
    fi
}

# Función para mostrar el uso de CPU 
show_cpu_usage() {
    PID=$1
    # Obtener el uso de CPU
    CPU_USAGE=$(ps -o %cpu= -p $PID)
    echo "Uso de CPU: $CPU_USAGE%"
    
    # Verificar si el uso de CPU es excesivo (más del 50%)
    if (( $(echo "$CPU_USAGE > 50" | bc -l) )); then
        echo "⚠️ ADVERTENCIA: Uso de CPU elevado"
    fi
}

# Función para mostrar el tiempo de ejecución
show_uptime() {
    PID=$1
    # Obtener el tiempo de inicio del proceso en formato Unix timestamp
    START_TIME=$(ps -o lstart= -p $PID | xargs -I{} date -d "{}" +%s)
    # Obtener el timestamp actual
    CURRENT_TIME=$(date +%s)
    # Calcular la diferencia en segundos
    UPTIME_SECONDS=$((CURRENT_TIME - START_TIME))
    
    # Convertir a formato legible
    DAYS=$((UPTIME_SECONDS / 86400))
    HOURS=$(( (UPTIME_SECONDS % 86400) / 3600 ))
    MINUTES=$(( (UPTIME_SECONDS % 3600) / 60 ))
    SECONDS=$((UPTIME_SECONDS % 60))
    
    echo "Tiempo en ejecución: ${DAYS}d ${HOURS}h ${MINUTES}m ${SECONDS}s"
}

# Verificar si el PID existe
if [ ! -f "$PID_FILE" ]; then
    echo "❌ El monitor de Letizia no está en ejecución (no se encontró el archivo PID)"
    exit 1
fi

# Leer el PID
PID=$(cat "$PID_FILE")

# Verificar si el proceso aún está en ejecución
if ! ps -p "$PID" > /dev/null; then
    echo "❌ El monitor de Letizia no está en ejecución (PID $PID no encontrado)"
    echo "El archivo PID existe pero el proceso no está ejecutándose."
    echo "Considera eliminar el archivo PID obsoleto: rm $PID_FILE"
    exit 1
fi

# El proceso está en ejecución
echo "✅ El monitor de Letizia está en ejecución (PID: $PID)"

# Mostrar información del proceso
echo "--------------------------------------"
show_uptime $PID
show_memory_usage $PID
show_cpu_usage $PID
echo "--------------------------------------"

# Verificar los logs recientes
echo "Últimas 5 entradas del log:"
tail -n 5 "logs/letizia-monitor.log" 2>/dev/null || echo "No se encontró el archivo de log"

# Añadir información sobre comandos útiles
echo "--------------------------------------"
echo "Comandos útiles:"
echo "  ./start.sh  - Iniciar el monitor"
echo "  ./stop.sh   - Detener el monitor"
echo "  ./status.sh - Verificar el estado"
echo "  npm test    - Ejecutar prueba en modo interactivo"
