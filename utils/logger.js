const fs = require('fs');
const path = require('path');
const config = require('../config');

// Función para rotar logs si son demasiado grandes
function rotateLogIfNeeded() {
  if (!config.logToFile) return;
  
  try {
    // Verificar si el archivo de log existe
    if (fs.existsSync(config.logFilePath)) {
      const stats = fs.statSync(config.logFilePath);
      
      // Si el archivo excede el tamaño máximo, rotarlo
      if (stats.size > config.logRotationSize) {
        const logDir = path.dirname(config.logFilePath);
        const baseName = path.basename(config.logFilePath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newPath = path.join(logDir, `${baseName}.${timestamp}.old`);
        
        fs.renameSync(config.logFilePath, newPath);
        console.log(`Log rotado: ${config.logFilePath} -> ${newPath}`);
      }
    }
  } catch (error) {
    console.error(`Error al rotar logs: ${error.message}`);
  }
}

// Función auxiliar para asegurar que el directorio de logs exista
function ensureLogDirectory() {
  if (!config.logToFile) return;
  
  try {
    const logDir = path.dirname(config.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (error) {
    console.error(`Error al crear directorio de logs: ${error.message}`);
  }
}

// Logger mejorado
const logger = {
  log: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}`;
    console.log(logMessage);
    if (config.logToFile) {
      ensureLogDirectory();
      rotateLogIfNeeded();
      fs.appendFileSync(config.logFilePath, logMessage + '\n');
    }
  },
  error: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}`;
    console.error(logMessage);
    if (config.logToFile) {
      ensureLogDirectory();
      rotateLogIfNeeded();
      fs.appendFileSync(config.logFilePath, logMessage + '\n');
    }
  },
  success: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] SUCCESS: ${message}`;
    console.log(logMessage);
    if (config.logToFile) {
      ensureLogDirectory();
      rotateLogIfNeeded();
      fs.appendFileSync(config.logFilePath, logMessage + '\n');
    }
  },
  warning: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARNING: ${message}`;
    console.log(logMessage);
    if (config.logToFile) {
      ensureLogDirectory();
      rotateLogIfNeeded();
      fs.appendFileSync(config.logFilePath, logMessage + '\n');
    }
  },
  critical: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] CRITICAL: ${message}`;
    console.error(logMessage);
    if (config.logToFile) {
      ensureLogDirectory();
      rotateLogIfNeeded();
      fs.appendFileSync(config.logFilePath, logMessage + '\n');
    }
  }
};

module.exports = logger;
