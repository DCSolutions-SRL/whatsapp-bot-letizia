#!/bin/bash

# Script para monitorear el servicio de Letizia y reiniciarlo si es necesario
# Se recomienda ejecutar este script vía cron cada 5 minutos:
# */5 * * * * /ruta/a/letizia-monitor/monitor-service.sh > /dev/null 2>&1

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$SCRIPT_DIR"

# Cargar configuración desde .env si existe
if [ -f ".env" ]; then
    source <(grep -v '^#' .env | sed -E 's/(.*)=(.*)/export \1="\2"/')
fi

# Variables para email (pueden definirse en .env)
ALERT_EMAIL_TO=mdantesarco@dcs.ar
ALERT_EMAIL_ENABLED=true

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

# Función para enviar alerta por email
send_email_alert() {
    local reason="$1"
    local details="$2"
    
    if [ "$ALERT_EMAIL_ENABLED" != "true" ]; then
        log "Alertas por email desactivadas. No se enviará email."
        return
    fi
    
    local hostname=$(hostname)
    local fecha=$(date '+%Y-%m-%d %H:%M:%S')
    local subject="⚠️ ALERTA: Monitor Letizia reiniciado en $hostname"
    
    # Crear un archivo temporal con el contenido HTML del email
    local tmpfile=$(mktemp)
    
    # Escribir el contenido HTML
    cat > "$tmpfile" << EOF
<html>
<head>
<style>
body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
.header { background-color: #ff7700; color: white; padding: 10px; border-radius: 5px; }
.content { margin: 20px 0; }
.reason { font-weight: bold; color: #ff5500; }
.details { background-color: #f5f5f5; border-left: 4px solid #ff7700; padding: 10px; margin: 10px 0; }
.footer { font-size: 0.8em; color: #777; border-top: 1px solid #ddd; padding-top: 10px; }
</style>
</head>
<body>
<div class="header">
<h2>⚠️ Alerta: Servicio Monitor Letizia Reiniciado</h2>
</div>
<div class="content">
<p>El servicio de monitoreo de Letizia ha sido reiniciado automáticamente.</p>
<p class="reason">Razón: $reason</p>
<div class="details">
<pre>$details</pre>
</div>
<p>Servidor: $hostname</p>
<p>Fecha y hora: $fecha</p>
</div>
<div class="footer">
<p>Este es un mensaje automático del monitor de servicios de Letizia.</p>
</div>
</body>
</html>
EOF

    # Enviar el email usando el comando mail
    if ! cat "$tmpfile" | mail -a "Content-Type: text/html" -s "$subject" "$ALERT_EMAIL_TO"; then
        log "Error al enviar email de alerta a $ALERT_EMAIL_TO"
    else
        log "Email de alerta enviado a $ALERT_EMAIL_TO"
    fi
    
    # Eliminar el archivo temporal
    rm -f "$tmpfile"
}

# Función para recolectar detalles del sistema para la alerta
get_system_details() {
    {
        echo "=== Información del Sistema ==="
        echo "Hostname: $(hostname)"
        echo "Fecha y Hora: $(date)"
        echo "Uptime: $(uptime)"
        echo ""
        echo "=== Uso de Recursos ==="
        echo "Memoria:"
        free -h
        echo ""
        echo "Espacio en disco:"
        df -h | grep -v tmpfs
        echo ""
        echo "Procesos con mayor consumo de CPU:"
        ps aux --sort=-%cpu | head -5
        echo ""
        echo "Procesos con mayor consumo de memoria:"
        ps aux --sort=-%mem | head -5
        echo ""
        echo "=== Últimas Entradas del Log ==="
        tail -n 10 "logs/letizia-monitor.log" 2>/dev/null || echo "No se encontró el archivo de log"
    } | sed 's/$/\\n/' | tr -d '\n'
}

# Función para reiniciar el servicio
restart_service() {
    local reason="$1"
    local details=$(get_system_details)
    
    log "Reiniciando el servicio de Letizia por: $reason"
    
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
    
    # Enviar alerta por email
    send_email_alert "$reason" "$details"
}

# Verificar si el servicio está ejecutándose
if [ ! -f "$PID_FILE" ]; then
    log "El servicio de Letizia no está en ejecución (archivo PID no encontrado). Iniciando..."
    restart_service "Servicio no encontrado - Archivo PID faltante"
    exit 0
fi

# Leer el PID
PID=$(cat "$PID_FILE")

# Verificar si el proceso existe
if ! ps -p "$PID" > /dev/null; then
    log "El servicio de Letizia no está en ejecución (PID $PID no encontrado). Reiniciando..."
    restart_service "Proceso terminado - PID no encontrado"
    exit 0
fi

# Verificar el uso de memoria (límite: 1GB = 1000MB)
MEM_USAGE=$(ps -o rss= -p $PID | awk '{print $1/1024}')
if (( $(echo "$MEM_USAGE > 1000" | bc -l) )); then
    log "Uso de memoria excesivo: ${MEM_USAGE}MB. Reiniciando el servicio..."
    restart_service "Consumo de memoria excesivo: ${MEM_USAGE}MB"
    exit 0
fi

# Verificar el uso de CPU (límite: 80%)
CPU_USAGE=$(ps -o %cpu= -p $PID)
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    log "Uso de CPU excesivo: ${CPU_USAGE}%. Reiniciando el servicio..."
    restart_service "Consumo de CPU excesivo: ${CPU_USAGE}%"
    exit 0
fi

# Verificar el tiempo de ejecución (reiniciar después de 7 días = 604800 segundos)
START_TIME=$(ps -o lstart= -p $PID | xargs -I{} date -d "{}" +%s)
CURRENT_TIME=$(date +%s)
UPTIME_SECONDS=$((CURRENT_TIME - START_TIME))
if [ $UPTIME_SECONDS -gt 604800 ]; then
    DAYS=$((UPTIME_SECONDS / 86400))
    log "Tiempo de ejecución excesivo: ${DAYS} días. Reiniciando el servicio..."
    restart_service "Tiempo de ejecución excesivo: ${DAYS} días"
    exit 0
fi

# Si llegamos aquí, el servicio está ejecutándose correctamente
log "El servicio de Letizia está ejecutándose correctamente (PID: $PID)"
log "Memoria: ${MEM_USAGE}MB, CPU: ${CPU_USAGE}%, Uptime: $((UPTIME_SECONDS / 3600))h $((UPTIME_SECONDS % 3600 / 60))m"

exit 0
