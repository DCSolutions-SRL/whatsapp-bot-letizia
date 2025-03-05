/**
 * Script para verificar la configuración y probar la conexión a WhatsApp
 * sin realizar pruebas completas
 * 
 * Ejecutar con: node debug.js
 */

require('dotenv').config();
const logger = require('./utils/logger');
const createWhatsAppClient = require('./services/client');
const { loadScenarios, ensureLogDirectory } = require('./utils/helpers');
const config = require('./config');

// Función principal de depuración
async function debug() {
  logger.log('=== Modo de depuración ===');
  
  // Asegurar que el directorio de logs exista
  ensureLogDirectory();
  
  // Verificar configuración
  logger.log('\n--- Configuración actual ---');
  logger.log(`Chats de prueba: ${config.testChatIds.length > 0 ? config.testChatIds.join(', ') : 'NINGUNO CONFIGURADO'}`);
  logger.log(`Chats de alerta: ${config.alertChatIds.length > 0 ? config.alertChatIds.join(', ') : 'NINGUNO CONFIGURADO'}`);
  logger.log(`Timeout respuesta: ${config.responseTimeout}ms`);
  logger.log(`Timeout crítico: ${config.criticalTimeout}ms`);
  logger.log(`Programación: ${config.testSchedule === 'hourly' ? 'Cada hora' : 'Cada media hora'}`);
  logger.log(`Archivo de escenarios: ${config.scenarioFile}`);
  logger.log(`Log a archivo: ${config.logToFile ? 'Activado' : 'Desactivado'}`);
  if (config.logToFile) {
    logger.log(`Ruta del log: ${config.logFilePath}`);
    logger.log(`Rotación de logs: ${Math.round(config.logRotationSize/1024/1024*100)/100}MB`);
  }
  
  // Verificar escenarios
  try {
    const scenario = loadScenarios();
    logger.log('\n--- Escenario cargado ---');
    logger.log(`Mensaje inicial: "${scenario.initialMessage}"`);
    logger.log(`Número de pasos: ${scenario.steps.length}`);
    
    // Mostrar un resumen de los pasos
    scenario.steps.forEach((step, index) => {
      let stepDescription = `Paso ${index + 1}: `;
      
      if (step.waitForMultiple) {
        stepDescription += `Esperar múltiples eventos: [`;
        step.waitForMultiple.forEach((event, idx) => {
          if (event.type === 'text') {
            stepDescription += `texto "${event.value}"`;
          } else if (event.type === 'media') {
            stepDescription += `media tipo "${event.mediaType}"`;
          }
          if (idx < step.waitForMultiple.length - 1) {
            stepDescription += ', ';
          }
        });
        stepDescription += ']';
        if (step.respond) {
          stepDescription += ` y responder "${step.respond}"`;
        }
      }
      else if (step.waitFor) {
        if (step.waitFor.type === 'text') {
          stepDescription += `Esperar texto "${step.waitFor.text}"`;
          if (step.respond) {
            stepDescription += ` y responder "${step.respond}"`;
          }
        } else if (step.waitFor.type === 'media') {
          stepDescription += `Esperar media tipo "${step.waitFor.mediaType}"`;
        }
      } else if (step.delay) {
        stepDescription += `Esperar ${step.delay}ms`;
      } else if (step.send) {
        stepDescription += `Enviar "${step.send}"`;
      }
      logger.log(stepDescription);
    });
  } catch (error) {
    logger.error(`Error al cargar escenarios: ${error.message}`);
  }
  
  // Probar conexión a WhatsApp
  logger.log('\n--- Probando conexión a WhatsApp ---');
  logger.log('Iniciando cliente (escanea el QR si es necesario)...');
  
  const client = createWhatsAppClient();
  
  client.on('ready', () => {
    logger.success('Cliente conectado correctamente');
    logger.log('\nINFO: Para ejecutar el test completo, usa: npm test');
    logger.log('INFO: Para ejecutar el monitor programado, usa: npm start');
    
    setTimeout(() => {
      logger.log('\nCerrando cliente...');
      client.destroy().then(() => {
        logger.success('Cliente cerrado correctamente');
        process.exit(0);
      }).catch(error => {
        logger.error(`Error al cerrar cliente: ${error.message}`);
        process.exit(1);
      });
    }, 3000);
  });
  
  client.initialize().catch(error => {
    logger.error(`Error al inicializar cliente: ${error.message}`);
    process.exit(1);
  });
}

// Ejecutar la función de depuración
debug().catch(error => {
  logger.error(`Error en depuración: ${error.message}`);
  process.exit(1);
});
