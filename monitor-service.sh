#!/bin/bash

# Script para monitorear el servicio de Letizia y reiniciarlo si es necesario
# Se recomienda ejecutar este script vía cron cada 5 minutos:
# */5 * * * * /ruta/a/letizia-monitor/monitor-service.sh > /dev/null 2>&1

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$SCRIPT_DIR"

# Archivo PID y logs
PID_FILE="letizia-monitor.pid"
SERVICE_LOG="logs/monitor-service.log"
RESTART_COUNT_FILE="logs/restart_count.txt"

# Asegurarse de que el directorio de logs existe
mkdir -p logs

# Función para registrar mensajes
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$SERVICE_LOG"
    echo "$1"
}

# Función para reiniciar el servicio
restart_service() {
    log "Reiniciando el servicio de Letizia..."
    
    # Intentar detener gracefully primero
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null; then
            log "Enviando señal de terminación al proceso $PID..."
            kill -15 "$PID"
            
            # Esperar hasta 10 segundos
            MAX_WAIT=10
            for i in $(seq 1 $MAX_WAIT); do
                if ! ps -p "$PID" > /dev/null; then
                    break
                fi
                sleep 1
            done
            
            # Si sigue ejecutándose, forzar la terminación
            if ps -p "$PID" > /dev/null; then
                log "Forzando terminación del proceso $PID..."
                kill -9 "$PID"
                sleep 2
            fi
        fi
        
        # Eliminar el archivo PID
        rm -f "$PID_FILE"
    fi
    
    # Iniciar el servicio nuevamente
    log "Iniciando el servicio de Letizia..."
    nohup node main.js >> "logs/daemon.log" 2>&1 &
    NEW_PID=$!
    echo $NEW_PID > "$PID_FILE"
    log "Servicio reiniciado con PID: $NEW_PID"
    
    # Incrementar contador de reinicios
    if [ -f "$RESTART_COUNT_FILE" ]; then
        COUNT=$(cat "$RESTART_COUNT_FILE")
        echo $((COUNT + 1)) > "$RESTART_COUNT_FILE"
    else
        echo "1" > "$RESTART_COUNT_FILE"
    fi
}

# Verificar si el servicio está ejecutándose
if [ ! -f "$PID_FILE" ]; then
    log "El servicio de Letizia no está en ejecución (archivo PID no encontrado). Iniciando..."
    restart_service
    exit 0
fi

# Leer el PID
PID=$(cat "$PID_FILE")

# Verificar si el proceso existe
if ! ps -p "$PID" > /dev/null; then
    log "El servicio de Letizia no está en ejecución (PID $PID no encontrado). Reiniciando..."
    restart_service
    exit 0
fi

# Verificar el uso de memoria (límite: 1GB = 1000MB)
MEM_USAGE=$(ps -o rss= -p $PID | awk '{print $1/1024}')
if (( $(echo "$MEM_USAGE > 1000" | bc -l) )); then
    log "Uso de memoria excesivo: ${MEM_USAGE}MB. Reiniciando el servicio..."
    restart_service
    exit 0
fi

# Verificar el uso de CPU (límite: 80%)
CPU_USAGE=$(ps -o %cpu= -p $PID)
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    log "Uso de CPU excesivo: ${CPU_USAGE}%. Reiniciando el servicio..."
    restart_service
    exit 0
fi

# Verificar el tiempo de ejecución (reiniciar después de 7 días = 604800 segundos)
START_TIME=$(ps -o lstart= -p $PID | xargs -I{} date -d "{}" +%s)
CURRENT_TIME=$(date +%s)
UPTIME_SECONDS=$((CURRENT_TIME - START_TIME))
if [ $UPTIME_SECONDS -gt 604800 ]; then
    DAYS=$((UPTIME_SECONDS / 86400))
    log "Tiempo de ejecución excesivo: ${DAYS} días. Reiniciando el servicio..."
    restart_service
    exit 0
fi

# Si llegamos aquí, el servicio está ejecutándose correctamente
log "El servicio de Letizia está ejecutándose correctamente (PID: $PID)"
log "Memoria: ${MEM_USAGE}MB, CPU: ${CPU_USAGE}%, Uptime: $((UPTIME_SECONDS / 3600))h $((UPTIME_SECONDS % 3600 / 60))m"

exit 0
