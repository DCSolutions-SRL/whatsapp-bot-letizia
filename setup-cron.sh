#!/bin/bash

# Script para configurar el cron job que monitorea el servicio de Letizia

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
MONITOR_SCRIPT="$SCRIPT_DIR/monitor-service.sh"

# Verificar que se ejecuta como root (necesario para configurar cron)
if [ "$EUID" -ne 0 ]; then
    echo "Este script debe ejecutarse como root para configurar crontab"
    echo "Por favor, ejecute: sudo $0"
    exit 1
fi

# Verificar que el script de monitoreo existe
if [ ! -f "$MONITOR_SCRIPT" ]; then
    echo "ERROR: No se encontró el script de monitoreo: $MONITOR_SCRIPT"
    exit 1
fi

# Asegurarse de que el script tiene permisos de ejecución
chmod +x "$MONITOR_SCRIPT"

# Crear entrada de crontab para ejecutar el monitor cada 5 minutos
CRON_JOB="*/5 * * * * $MONITOR_SCRIPT > /dev/null 2>&1"

# Verificar si la entrada ya existe en crontab
if crontab -l 2>/dev/null | grep -q "$MONITOR_SCRIPT"; then
    echo "La tarea cron para monitoreo ya está configurada."
else
    # Añadir la nueva entrada de cron
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Tarea cron configurada para ejecutar el monitoreo cada 5 minutos."
fi

echo "Configuración completada."
echo "El monitor de servicio de Letizia se ejecutará automáticamente cada 5 minutos."
