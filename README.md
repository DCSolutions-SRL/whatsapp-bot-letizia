<h1 align="center">
  <br>
  <a href="http://www.dcs.ar"><img src="https://i.imgur.com/GgjNXNl.png" alt="DCSolutions" width="200"></a>
  <br>
  Monitor Sintético para WhatsApp - Letizia
  <br>
</h1>

<h4 align="center">Sistema automatizado de monitoreo que supervisa la correcta operación del chatbot Letizia en WhatsApp.</h4>

<p align="center">
  <a href="#características">Características</a> •
  <a href="#estructura-del-proyecto">Estructura</a> •
  <a href="#instalación">Instalación</a> •
  <a href="#uso">Uso</a> •
  <a href="#configuración">Configuración</a> •
  <a href="#solución-de-problemas">Solución de Problemas</a> •
  <a href="#créditos">Créditos</a>
</p>

## Características

* **Monitoreo automático del bot de cotización**
  - Pruebas programadas a horas exactas (HH:00 y HH:30)
  - Verificación de tiempos de respuesta y detección de fallos
  - Alertas automáticas ante problemas detectados
  - Notificaciones de recuperación cuando el sistema vuelve a funcionar

* **Proceso de cotización simulado**
  - Envía mensaje inicial "cotizar auto"
  - Espera y responde preguntas del chatbot en secuencia
  - Soporta espera de múltiples eventos en cualquier orden
  - Completa todo el flujo de cotización automáticamente

* **Gestión avanzada del servicio**
  - Ejecución en segundo plano con bajo consumo de recursos
  - Reinicio automático en caso de fallos o uso excesivo de recursos
  - Monitoreo continuo del estado del servicio
  - Sistema de logs con rotación automática

* **Sistema de alertas multi-canal**
  - Alertas por WhatsApp con niveles de severidad (🟡 🔴 🟢)
  - Alertas por correo cuando el servicio requiere atención manual
  - Formato 24 horas en las notificaciones
  - Alertas en grupo o usuarios individuales

## Estructura del Proyecto

```
letizia-monitor/
├── main.js                # Punto de entrada principal
├── config.js              # Configuración centralizada
├── debug.js               # Herramienta de diagnóstico
├── utils/
│   ├── logger.js          # Utilidad de logging con rotación
│   └── helpers.js         # Funciones auxiliares
├── services/
│   ├── client.js          # Cliente de WhatsApp
│   └── monitor.js         # Servicio principal de monitoreo
├── scenarios.json         # Definición de escenarios de prueba
├── status.json            # Archivo para mantener el estado
├── .env                   # Variables de entorno
├── start.sh               # Script para iniciar en segundo plano
├── stop.sh                # Script para detener el servicio
├── status.sh              # Script para verificar el estado
├── monitor-service.sh     # Script de monitoreo con reinicio automático
└── install-dependencies.sh # Instalador de dependencias
```

## Instalación

### Requisitos:

- Node.js 16.x o superior
- Servidor Linux con Postfix/Sendmail para alertas por email (opcional)

```bash
# Clonar el repositorio
$ git clone https://github.com/DCSolutions-SRL/whatsapp-bot-letizia.git

# Entrar al directorio del proyecto
$ cd whatsapp-bot-letizia

# Instalar todas las dependencias (sistema y npm)
$ chmod +x install-dependencies.sh
$ ./install-dependencies.sh

# Configurar el archivo .env
$ cp .env.example .env
$ nano .env
```

### Configuración del archivo .env:

```
# IDs de chat para pruebas y alertas
CHAT_ID=5491148577777@c.us
ALERT_CHAT_ID=5491168999360@c.us,5491187654321@c.us

# Configuración de monitoreo
TEST_SCHEDULE=hourly
RESPONSE_TIMEOUT=65000
CRITICAL_TIMEOUT=125000

# Configuración de logs
LOG_TO_FILE=true
LOG_FILE_PATH=logs/letizia-monitor.log

# Configuración de alertas por email
ALERT_EMAIL_TO=mdantesarco@dcs.ar
ALERT_EMAIL_ENABLED=true
```

### Configuración del monitoreo automático:

```bash
# Establecer permisos de ejecución
$ chmod +x *.sh

# Configurar el cron job para monitoreo automático
$ sudo ./setup-cron.sh
```

## Uso

### Verificar configuración y realizar prueba manual:

```bash
# Verificar que todo está configurado correctamente
$ node debug.js

# Ejecutar una prueba manual (muestra QR en terminal)
$ npm test
```

### Gestión del servicio:

```bash
# Iniciar el servicio en segundo plano
$ ./start.sh

# Verificar el estado del servicio
$ ./status.sh

# Detener el servicio
$ ./stop.sh
```

## Configuración

### Escenario de cotización:

El archivo `scenarios.json` define el flujo de interacción con el bot. Puedes personalizarlo para adaptarlo a cambios en el chatbot.

```json
{
  "initialMessage": "cotizar auto",
  "steps": [
    { 
      "waitForMultiple": [
        { "type": "media", "mediaType": "sticker" },
        { "type": "text", "value": "¿Tenés la patente del auto?" }
      ],
      "respond": "SI"
    },
    ...
  ]
}
```

### Límites de recursos:

En el archivo `monitor-service.sh` puedes ajustar los límites para el reinicio automático:
- Uso de memoria máximo (por defecto: 1GB)
- Uso de CPU máximo (por defecto: 80%)
- Tiempo máximo de ejecución continua (por defecto: 7 días)

## Solución de Problemas

### Escaneo del código QR

Para iniciar sesión en WhatsApp Web, necesitas escanear un código QR la primera vez. Ejecuta `npm test` desde una terminal con acceso a interfaz gráfica para ver el código QR.

### Logs y diagnóstico

Los logs se guardan en:
- Logs principales: `logs/letizia-monitor.log`
- Logs del servicio: `logs/daemon.log`
- Logs del monitor: `logs/monitor-service.log`

### El servicio no inicia

Verifica los mensajes de error en los logs:
```bash
$ tail -n 50 logs/daemon.log
```

### Problemas de permisos

Asegúrate de que todos los scripts tienen permisos de ejecución:
```bash
$ chmod +x *.sh
```

## Créditos

* [matuDEV](https://github.com/tutedcs) 🐧
* [matutEv](https://github.com/matiasdante) 🎮

---

<p align="center">
  © 2025 DCSolutions - Desarrollado para monitorear el chatbot Letizia de manera confiable y eficiente.
</p>
