const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');

/**
 * Inicializa y devuelve un cliente de WhatsApp Web
 * @param {Object} options Opciones de configuración para el cliente
 * @returns {Client} Cliente de WhatsApp Web inicializado
 */
function createWhatsAppClient(options = {}) {
  const clientOptions = {
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    },
    ...options
  };

  const client = new Client(clientOptions);

  // Eventos básicos del cliente
  client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    logger.log('Escanea el código QR con tu teléfono para autenticar');
  });

  client.on('authenticated', () => {
    logger.success('Cliente autenticado');
  });

  client.on('auth_failure', (msg) => {
    logger.error(`Fallo de autenticación: ${msg}`);
  });

  client.on('disconnected', (reason) => {
    logger.error(`Cliente desconectado: ${reason}`);
  });

  return client;
}

module.exports = createWhatsAppClient;
