// Configuración centralizada
const CONFIG = {
  testInterval: process.env.TEST_INTERVAL_MINUTES ? parseInt(process.env.TEST_INTERVAL_MINUTES) * 60 * 1000 : 30 * 60 * 1000,
  responseTimeout: process.env.RESPONSE_TIMEOUT ? parseInt(process.env.RESPONSE_TIMEOUT) : 60000, // 1 minuto por defecto
  criticalTimeout: process.env.CRITICAL_TIMEOUT ? parseInt(process.env.CRITICAL_TIMEOUT) : 120000, // 2 minutos por defecto
  alertChatIds: process.env.ALERT_CHAT_ID ? process.env.ALERT_CHAT_ID.split(',') : [],
  testChatIds: process.env.CHAT_ID ? process.env.CHAT_ID.split(',') : [],
  scenarioFile: process.env.SCENARIO_FILE || 'scenarios.json',
  logToFile: process.env.LOG_TO_FILE === 'true',
  logFilePath: process.env.LOG_FILE_PATH || 'monitor.log',
  logRotationSize: process.env.LOG_ROTATION_SIZE ? parseInt(process.env.LOG_ROTATION_SIZE) : 5242880, // 5MB por defecto
  statusFile: 'status.json', // Archivo para guardar el estado del último test
  // Compatibilidad con TEST_SCHEDULE
  testSchedule: process.env.TEST_SCHEDULE || 'halfhourly' // 'hourly' o 'halfhourly'
};

module.exports = CONFIG; 
