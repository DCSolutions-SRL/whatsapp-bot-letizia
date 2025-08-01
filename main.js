require('dotenv').config();
const logger = require('./utils/logger');
const WhatsAppMonitor = require('./services/monitor');
const createWhatsAppClient = require('./services/client');
const config = require('./config');

// Verificar si se está ejecutando en modo test
const isTestMode = process.argv.includes('--test');

// Variables globales 
let monitor = null;

// Verificar la configuración
if (!config.testChatIds || config.testChatIds.length === 0) {
  logger.error('ERROR: No hay chats configurados para pruebas. Verifica la variable CHAT_ID en el archivo .env');
  process.exit(1);
}

// Asegurar que el directorio de logs exista
const { ensureLogDirectory } = require('./utils/helpers');
ensureLogDirectory();

logger.log(`Configuración cargada:`);
logger.log(`- Chats para pruebas: ${config.testChatIds.join(', ')}`);
logger.log(`- Chats para alertas: ${config.alertChatIds.join(', ')}`);
logger.log(`- Timeout respuesta: ${config.responseTimeout}ms`);
logger.log(`- Timeout crítico: ${config.criticalTimeout}ms`);
logger.log(`- Programación: ${config.testSchedule === 'hourly' ? 'Cada hora' : 'Cada media hora'}`);
logger.log(`- Log a archivo: ${config.logToFile ? config.logFilePath : 'desactivado'}`);
if (config.logToFile) {
  logger.log(`- Rotación de logs: ${Math.round(config.logRotationSize/1024/1024*100)/100}MB`);
}

// Crear el cliente de WhatsApp
const client = createWhatsAppClient();

// Inicialización cuando el cliente está listo
client.on('ready', async () => {
  logger.success('Cliente conectado y listo. Preparando monitoreo sintético...');
  
  try {
    // Crear una instancia del monitor
    monitor = new WhatsAppMonitor(client);
    
    // Si estamos en modo test, iniciar las pruebas inmediatamente
    if (isTestMode) {
      logger.log('Ejecutando en modo test. Comenzando pruebas en 3 segundos...');
      
      // En modo test, ejecutamos directamente las pruebas después de un breve delay
      setTimeout(async () => {
        try {
          logger.log('Iniciando pruebas en modo test...');
          const success = await monitor.runTests();
          
          if (success) {
            logger.success('Pruebas en modo test completadas correctamente');
          } else {
            logger.error('Pruebas en modo test completadas con errores');
          }
          
          // En modo test, mantenemos el proceso activo hasta que el usuario lo cierre
          logger.log('Pruebas finalizadas. Presiona Ctrl+C para salir.');
        } catch (error) {
          logger.error(`Error crítico al ejecutar pruebas en modo test: ${error.message}`);
          logger.error(error.stack);
        }
      }, 3000); // Mayor retraso para asegurar que el cliente esté completamente inicializado
    } else {
      // En modo normal, programar la próxima ejecución a la hora o media hora
      monitor.scheduleNextRun();
    }
  } catch (error) {
    logger.error(`Error al inicializar el monitor: ${error.message}`);
    logger.error(error.stack);
  }
});

// Inicializar cliente
logger.log('Inicializando cliente WhatsApp...');
client.initialize().catch(error => {
  logger.error(`Error al inicializar el cliente: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  logger.log('Cerrando el monitor sintético...');
  try {
    await client.destroy();
  } catch (error) {
    logger.error(`Error al cerrar cliente: ${error.message}`);
  }
  process.exit(0);
});
