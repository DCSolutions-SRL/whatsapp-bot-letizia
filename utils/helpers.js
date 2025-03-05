const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const config = require('../config');

// Utilidades comunes

// Función para esperar un tiempo determinado
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Función para calcular el tiempo hasta la próxima hora o media hora exacta
function getTimeUntilNextSchedule() {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const milliseconds = now.getMilliseconds();
  let delayMs;

  // Considerar la configuración de TEST_SCHEDULE
  if (config.testSchedule === 'hourly') {
    // Si está configurado como 'hourly', siempre apuntar a la siguiente hora exacta
    delayMs = ((60 - minutes) * 60 - seconds) * 1000 - milliseconds;
  } else {
    // Configuración 'halfhourly' (por defecto)
    if (minutes < 30) {
      // Calcular tiempo hasta HH:30:00
      delayMs = ((30 - minutes) * 60 - seconds) * 1000 - milliseconds;
    } else {
      // Calcular tiempo hasta (HH+1):00:00
      delayMs = ((60 - minutes) * 60 - seconds) * 1000 - milliseconds;
    }
  }

  return delayMs;
}

// Cargar escenarios desde archivo
function loadScenarios() {
  try {
    if (!fs.existsSync(config.scenarioFile)) {
      // Si el archivo no existe, usar el escenario predeterminado y guardarlo
      const defaultScenario = {
        initialMessage: "cotizar auto",
        steps: [
          { 
            waitForMultiple: [
              { type: "media", mediaType: "sticker", errorMessage: "No ingresó Sticker Letizia" },
              { type: "text", value: "¿Tenés la patente del auto?" }
            ],
            respond: "SI"
          },
          { waitFor: { type: "text", text: "¿Cuál es la patente de tu vehículo?" }, respond: "AA877WW" },
          { waitFor: { type: "text", text: "¿Son correctos estos datos?" }, respond: "NO" },
          { waitFor: { type: "text", text: "Marca" }, respond: "Ford" },
          { waitFor: { type: "text", text: "Año" }, respond: "2020" },
          { waitFor: { type: "text", text: "Modelo" }, respond: "KA" },
          { waitFor: { type: "text", text: "¿Cuál de estas versiones de vehículo es el tuyo?" }, respond: "1" },
          { waitFor: { type: "text", text: "¿El vehículo cuenta con GNC?" }, respond: "SI" },
          { waitFor: { type: "text", text: "¿Cuál es el uso que le das a tu auto?" }, respond: "SI" },
          { waitFor: { type: "text", text: "¿Cuál es tu código postal?" }, respond: "1405" },
          { waitFor: { type: "media", mediaType: "image", errorMessage: "No ingresó documentación" } },
          { delay: 5000 },
          { send: "empezar" }
        ]
      };
      fs.writeFileSync(config.scenarioFile, JSON.stringify(defaultScenario, null, 2));
      return defaultScenario;
    }

    const data = fs.readFileSync(config.scenarioFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Error al cargar los escenarios: ${error.message}`);
    process.exit(1);
  }
}

// Gestión del estado del sistema
function saveStatus(chatId, statusData) {
  try {
    let allStatus = {};
    
    // Intentar cargar el estado anterior si existe
    if (fs.existsSync(config.statusFile)) {
      allStatus = JSON.parse(fs.readFileSync(config.statusFile, 'utf8'));
    }
    
    // Actualizar el estado para el chat específico
    allStatus[chatId] = {
      lastStatus: statusData.status || 'unknown',
      timestamp: new Date().toISOString(),
      failedSteps: statusData.failedSteps || [],
      // Si se envió una alerta de recuperación, guardarlo para no enviar más hasta un nuevo fallo
      recoveryAlertSent: statusData.recoveryAlertSent || false
    };
    
    // Guardar el estado actualizado
    fs.writeFileSync(config.statusFile, JSON.stringify(allStatus, null, 2));
    logger.log(`Estado guardado para ${chatId}: ${statusData.status}`);
    
  } catch (error) {
    logger.error(`Error al guardar el estado: ${error.message}`);
  }
}

function getLastStatus(chatId) {
  try {
    if (fs.existsSync(config.statusFile)) {
      const statusData = JSON.parse(fs.readFileSync(config.statusFile, 'utf8'));
      return statusData[chatId] || { 
        lastStatus: 'unknown',
        recoveryAlertSent: false,
        failedSteps: []
      };
    }
    return { 
      lastStatus: 'unknown',
      recoveryAlertSent: false,
      failedSteps: []
    };
  } catch (error) {
    logger.error(`Error al obtener el último estado: ${error.message}`);
    return { 
      lastStatus: 'unknown',
      recoveryAlertSent: false,
      failedSteps: []
    };
  }
}

// Función para crear directorios de log si no existen
function ensureLogDirectory() {
  if (config.logToFile) {
    const logDir = path.dirname(config.logFilePath);
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
        logger.log(`Directorio de logs creado: ${logDir}`);
      } catch (error) {
        console.error(`Error al crear directorio de logs: ${error.message}`);
      }
    }
  }
}

module.exports = {
  delay,
  getTimeUntilNextSchedule,
  loadScenarios,
  saveStatus,
  getLastStatus,
  ensureLogDirectory
};
