const logger = require('../utils/logger');
const config = require('../config');
const { 
  delay, 
  getTimeUntilNextSchedule, 
  loadScenarios, 
  saveStatus, 
  getLastStatus 
} = require('../utils/helpers');

class WhatsAppMonitor {
  constructor(client) {
    this.client = client;
    this.scenario = loadScenarios();
    this.messageListeners = new Map();
    this.testStartTime = null;
    this.criticalFailureDetected = false;
    this.lastReceivedMessages = {}; // Para guardar los últimos mensajes recibidos
    this.scheduleTimer = null;
    
    // Configurar los manejadores de eventos al instanciar
    this.setupEventHandlers();
    
    logger.log('Monitor sintético inicializado con escenario:');
    logger.log(`Mensaje inicial: "${this.scenario.initialMessage}"`);
    logger.log(`Pasos totales: ${this.scenario.steps.length}`);
  }

  setupEventHandlers() {
    logger.log('Configurando listeners de mensajes...');
    
    // Eliminar listeners antiguos si existen
    this.client.removeAllListeners('message');
    
    // Configurar nuevo listener de mensajes
    this.client.on('message', message => {
      // Guardar el último mensaje recibido para cada chat
      this.lastReceivedMessages[message.from] = message.body;
      logger.log(`Mensaje recibido de ${message.from}: "${message.body.substring(0, 50)}${message.body.length > 50 ? '...' : ''}"`);

      // Procesar el mensaje con todos los listeners registrados
      for (const [id, listener] of this.messageListeners.entries()) {
        listener(message);
      }
    });
    
    logger.log('Listeners de mensajes configurados');
  }

  scheduleNextRun() {
    // Calcular tiempo hasta la próxima hora o media hora exacta
    const waitTime = getTimeUntilNextSchedule();
    const targetTime = new Date(Date.now() + waitTime);

    logger.log(`Programando próxima ejecución para: ${targetTime.toLocaleString()}`);
    logger.log(`Esperando ${Math.floor(waitTime / 60000)} minutos y ${Math.floor((waitTime % 60000) / 1000)} segundos`);

    // Limpiar cualquier temporizador existente
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
    }

    // Programar la próxima ejecución
    this.scheduleTimer = setTimeout(() => {
      logger.log(`Ejecutando pruebas programadas a las ${new Date().toLocaleString()}`);
      this.runTests();
      
      // Después de ejecutar el test, programar el siguiente
      setInterval(() => this.runTests(), config.testInterval);
    }, waitTime);
  }

  async runTests() {
    const startTime = new Date();
    logger.log(`Iniciando pruebas sintéticas: ${startTime.toLocaleString()}`);

    if (config.testChatIds.length === 0) {
      logger.error('No hay chats configurados para pruebas. Verifica la configuración CHAT_ID en el archivo .env');
      return false;
    }

    let allTestsSuccessful = true;

    for (const chatId of config.testChatIds) {
      logger.log(`Ejecutando prueba en chat: ${chatId}`);
      try {
        const success = await this.runTestForChat(chatId);
        if (!success) {
          allTestsSuccessful = false;
        }
      } catch (error) {
        logger.error(`Error en prueba para ${chatId}: ${error.message}`);
        logger.error(error.stack);
        allTestsSuccessful = false;
      }
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    logger.log(`Pruebas sintéticas completadas en ${duration} segundos`);
    return allTestsSuccessful;
  }

  async runTestForChat(chatId) {
    const failedSteps = [];
    this.testStartTime = Date.now();
    this.criticalFailureDetected = false;
    this.lastReceivedMessages[chatId] = ""; // Inicializar el registro del último mensaje
    let testStatus = 'success'; // Por defecto asumimos éxito

    try {
      // Obtener el último estado conocido
      const lastStatus = getLastStatus(chatId);
      logger.log(`Estado anterior para ${chatId}: ${JSON.stringify(lastStatus)}`);
      
      // Enviar mensaje inicial
      logger.log(`Enviando mensaje inicial a ${chatId}: "${this.scenario.initialMessage}"`);
      await this.client.sendMessage(chatId, this.scenario.initialMessage);
      logger.success(`Mensaje inicial enviado a ${chatId}`);

      // Ejecutar cada paso del escenario
      for (const [index, step] of this.scenario.steps.entries()) {
        // Si ya se detectó un fallo crítico, finalizar inmediatamente con 'empezar'
        if (this.criticalFailureDetected) {
          logger.critical("Finalizando prueba debido a fallo crítico detectado");
          await this.client.sendMessage(chatId, "empezar");
          testStatus = 'critical';
          break;
        }

        logger.log(`Ejecutando paso ${index + 1}/${this.scenario.steps.length} para ${chatId}`);

        // Manejar diferentes tipos de pasos
        if (step.waitForMultiple) {
          // Paso especial para esperar múltiples eventos en cualquier orden
          logger.log(`Esperando múltiples eventos en cualquier orden`);
          const result = await this.waitForMultipleEvents(
            chatId,
            step.waitForMultiple,
            failedSteps,
            index + 1
          );

          // Si se detectó un error crítico, finalizar inmediatamente
          if (result && result.error === 'critical_timeout') {
            this.criticalFailureDetected = true;
            testStatus = 'critical';
            continue;
          }

          // Si el paso tiene una respuesta y se completaron todos los eventos
          if (step.respond && result && (result.message || result.completed)) {
            logger.log(`Enviando respuesta después de eventos múltiples: "${step.respond}"`);
            if (result.message) {
              await this.sendResponse(result.message, step.respond);
            } else {
              // Si no hay mensaje específico pero los eventos se completaron, enviar directamente
              await this.client.sendMessage(chatId, step.respond);
              logger.success(`Respuesta enviada: "${step.respond}"`);
            }
          }
        }
        else if (step.waitFor) {
          if (step.waitFor.type === "text") {
            logger.log(`Esperando texto: "${step.waitFor.text}"`);
            const result = await this.waitForResponse(
              chatId,
              step.waitFor.text,
              failedSteps,
              index + 1,
              step
            );

            // Si se detectó un error crítico, finalizar inmediatamente
            if (result && result.error === 'critical_timeout') {
              this.criticalFailureDetected = true;
              testStatus = 'critical';
              continue;
            }

            if (result && result.message && step.respond) {
              logger.log(`Enviando respuesta: "${step.respond}"`);
              await this.sendResponse(result.message, step.respond);
            }
          }
          else if (step.waitFor.type === "media") {
            logger.log(`Esperando media de tipo: "${step.waitFor.mediaType}"`);
            const result = await this.waitForMedia(
              chatId,
              step.waitFor.mediaType,
              step.waitFor.errorMessage,
              failedSteps,
              index + 1,
              step
            );

            // Si se detectó un error crítico, finalizar inmediatamente
            if (result && result.error === 'critical_timeout') {
              this.criticalFailureDetected = true;
              testStatus = 'critical';
              continue;
            }
          }
        }
        else if (step.delay) {
          logger.log(`Esperando ${step.delay}ms...`);
          await delay(step.delay);
        }
        else if (step.send) {
          logger.log(`Enviando mensaje: "${step.send}"`);
          await this.client.sendMessage(chatId, step.send);
          logger.success(`Mensaje enviado a ${chatId}: '${step.send}'`);
        }
      }

      const testDuration = (Date.now() - this.testStartTime) / 1000;
      
      // Determinar el estado final de la prueba
      if (failedSteps.length > 0 && !this.criticalFailureDetected) {
        testStatus = 'warning';
      }
      
      logger.success(`Test completado en ${chatId} (${testDuration}s) - ${testStatus === 'success' ? 'Exitoso' : 'Con errores'}`);
      
      // Determinar si debemos enviar alertas
      if (failedSteps.length > 0) {
        // Si hay fallos, enviar alerta y actualizar estado
        await this.sendAlert(failedSteps, chatId, testStatus);
        
        // Guardar el estado de la prueba con fallos
        saveStatus(chatId, {
          status: testStatus,
          failedSteps: failedSteps,
          // Reiniciar el flag de recuperación ya que volvió a fallar
          recoveryAlertSent: false
        });
      } 
      else if ((lastStatus.lastStatus === 'warning' || lastStatus.lastStatus === 'critical') && 
              !lastStatus.recoveryAlertSent) {
        // Si el test anterior falló pero este tuvo éxito Y NO se ha enviado una alerta de recuperación aún,
        // enviar alerta de recuperación y marcar que se envió
        await this.sendRecoveryAlert(chatId, lastStatus.lastStatus);
        
        // Guardar el estado exitoso con bandera de que ya se envió la alerta de recuperación
        saveStatus(chatId, {
          status: testStatus,
          failedSteps: [],
          recoveryAlertSent: true
        });
      } else {
        // Si el test fue exitoso y no hay que enviar alerta de recuperación, simplemente guardar el estado
        saveStatus(chatId, {
          status: testStatus,
          failedSteps: [],
          // Mantener el estado de recoveryAlertSent
          recoveryAlertSent: lastStatus.recoveryAlertSent || false
        });
      }
      
      return testStatus === 'success';
    }
    catch (error) {
      logger.error(`Error al ejecutar test en ${chatId}: ${error.message}`);
      logger.error(error.stack);
      failedSteps.push(`Error crítico: ${error.message}`);
      testStatus = 'critical';
      
      // Guardar el estado de error
      saveStatus(chatId, {
        status: testStatus,
        failedSteps: failedSteps,
        // Reiniciar el flag de recuperación ya que hubo un error
        recoveryAlertSent: false
      });
      
      // Enviar alerta de error
      await this.sendAlert(failedSteps, chatId, testStatus);
      
      return false;
    }
  }

  // Función mejorada para esperar mensajes y media en cualquier orden
  async waitForMultipleEvents(chatId, events, failedSteps, stepNumber) {
    logger.log(`Esperando múltiples eventos: ${JSON.stringify(events)}`);
    
    // Array para almacenar promesas de cada tipo de espera
    const waitPromises = [];
    
    // Crear un objeto para rastrear qué eventos ya se han completado
    const completedEvents = {};
    events.forEach(event => {
      completedEvents[`${event.type}_${event.value || event.mediaType}`] = false;
    });
    
    // Convertir cada evento en una promesa
    for (const event of events) {
      if (event.type === 'text') {
        waitPromises.push(
          this.waitForResponse(
            chatId, 
            event.value, 
            failedSteps, 
            stepNumber, 
            null, 
            completedEvents
          )
        );
      } else if (event.type === 'media') {
        waitPromises.push(
          this.waitForMedia(
            chatId, 
            event.mediaType, 
            event.errorMessage || `No se recibió media ${event.mediaType}`, 
            failedSteps, 
            stepNumber, 
            null, 
            completedEvents
          )
        );
      }
    }
    
    // Esperar a que se completen todos los eventos
    try {
      const results = await Promise.allSettled(waitPromises);
      
      // Verificar si todos los eventos se completaron con éxito
      const allCompleted = Object.values(completedEvents).every(completed => completed);
      
      if (allCompleted) {
        logger.success(`Todos los eventos esperados fueron recibidos`);
        // Devolver el último mensaje recibido (para responder si es necesario)
        const successResults = results
          .filter(r => r.status === 'fulfilled' && r.value && r.value.message)
          .map(r => r.value);
        
        return successResults.length > 0 ? successResults[successResults.length - 1] : { completed: true };
      } else {
        // Identificar qué eventos no se completaron
        const incompleteEvents = Object.entries(completedEvents)
          .filter(([_, completed]) => !completed)
          .map(([key]) => key);
        
        logger.error(`Algunos eventos no se completaron: ${incompleteEvents.join(', ')}`);
        return { error: 'incomplete_events' };
      }
    } catch (error) {
      logger.error(`Error al esperar múltiples eventos: ${error.message}`);
      return { error: 'wait_error' };
    }
  }

  // Función modificada para esperar respuesta de texto
  waitForResponse(chatId, expectedText, failedSteps, stepNumber, step, completedEvents = null) {
    return new Promise((resolve) => {
      const listenerId = `text_${Date.now()}_${Math.random()}`;
      const startWaitTime = Date.now();
      let timeoutHandled = false;
      let warningReported = false;
      
      const eventKey = `text_${expectedText}`;

      logger.log(`Configurando listener para esperar texto: "${expectedText}"`);

      const messageHandler = (message) => {
        if (message.from === chatId) {
          logger.log(`Recibido en espera de "${expectedText}": "${message.body}"`);
          
          if (message.body.includes(expectedText)) {
            // Limpiar listener cuando encontramos respuesta
            this.messageListeners.delete(listenerId);
            timeoutHandled = true;
            logger.success(`Respuesta esperada recibida: "${expectedText}"`);
            
            // Marcar este evento como completado si estamos en modo de múltiples eventos
            if (completedEvents !== null) {
              completedEvents[eventKey] = true;
            }
            
            resolve({ message, type: 'text', value: expectedText });
          }
        }
      };

      // Registrar el listener
      this.messageListeners.set(listenerId, messageHandler);
      logger.log(`Listener ${listenerId} registrado para esperar: "${expectedText}"`);

      // Usar setTimeout en vez de múltiples timers
      const checkTimeout = () => {
        if (timeoutHandled) return;

        const waitTime = Date.now() - startWaitTime;
        
        // Si estamos en modo multi-evento y este evento ya se completó, finalizar
        if (completedEvents !== null && completedEvents[eventKey]) {
          this.messageListeners.delete(listenerId);
          timeoutHandled = true;
          return;
        }
        
        logger.log(`Esperando respuesta "${expectedText}" - ${Math.floor(waitTime / 1000)}s transcurridos`);

        if (waitTime >= config.criticalTimeout) {
          // Si superamos el tiempo crítico
          this.messageListeners.delete(listenerId);
          timeoutHandled = true;

          // Mensaje detallado de fallo con número de paso y contexto
          const lastMessage = this.lastReceivedMessages[chatId] || "No se recibió ningún mensaje";
          const criticalErrorMsg = `Fallo en Step #${stepNumber}: Esperaba "${expectedText}" pero recibió "${lastMessage}"`;
          failedSteps.push(criticalErrorMsg);
          logger.critical(criticalErrorMsg);
          resolve({ error: 'critical_timeout', type: 'text', value: expectedText });
        }
        else if (waitTime >= config.responseTimeout && !this.criticalFailureDetected) {
          // Si superamos el tiempo normal pero no el crítico
          if (!warningReported) {
            const warningMsg = `Tiempo de espera excedido en Step #${stepNumber}: Esperaba "${expectedText}"`;
            failedSteps.push(warningMsg);
            logger.warning(warningMsg);
            warningReported = true;
          }

          // Continuar esperando
          setTimeout(checkTimeout, 1000);
        }
        else {
          // Todavía no alcanzamos ningún timeout, seguir esperando
          setTimeout(checkTimeout, 1000);
        }
      };

      // Iniciar la verificación de timeout
      setTimeout(checkTimeout, 1000);
    });
  }

  // Función modificada para esperar media
  waitForMedia(chatId, mediaType, errorMessage, failedSteps, stepNumber, step, completedEvents = null) {
    return new Promise((resolve) => {
      const listenerId = `media_${Date.now()}_${Math.random()}`;
      const startWaitTime = Date.now();
      let timeoutHandled = false;
      let warningReported = false;
      
      const eventKey = `media_${mediaType}`;

      logger.log(`Configurando listener para esperar media tipo: "${mediaType}"`);

      const messageHandler = (message) => {
        if (message.from === chatId && message.hasMedia) {
          logger.log(`Recibido media de tipo ${message.type} (esperando ${mediaType})`);
          
          if ((mediaType === 'sticker' && message.type === 'sticker') ||
              (mediaType === 'image' && message.type === 'image')) {
            // Limpiar listener cuando encontramos el medio
            this.messageListeners.delete(listenerId);
            timeoutHandled = true;
            logger.success(`Media ${mediaType} recibido correctamente`);
            
            // Marcar este evento como completado si estamos en modo de múltiples eventos
            if (completedEvents !== null) {
              completedEvents[eventKey] = true;
            }
            
            resolve({ message, type: 'media', mediaType });
          }
        }
      };

      // Registrar el listener
      this.messageListeners.set(listenerId, messageHandler);
      logger.log(`Listener ${listenerId} registrado para esperar media: "${mediaType}"`);

      // Usar setTimeout en vez de múltiples timers
      const checkTimeout = () => {
        if (timeoutHandled) return;
        
        // Si estamos en modo multi-evento y este evento ya se completó, finalizar
        if (completedEvents !== null && completedEvents[eventKey]) {
          this.messageListeners.delete(listenerId);
          timeoutHandled = true;
          return;
        }

        const waitTime = Date.now() - startWaitTime;
        logger.log(`Esperando media "${mediaType}" - ${Math.floor(waitTime / 1000)}s transcurridos`);

        if (waitTime >= config.criticalTimeout) {
          // Si superamos el tiempo crítico
          this.messageListeners.delete(listenerId);
          timeoutHandled = true;

          // Mensaje detallado de fallo
          const detailedErrorMsg = `Fallo en Step #${stepNumber}: Esperaba recibir media tipo "${mediaType}" pero no se recibió`;
          failedSteps.push(detailedErrorMsg);
          logger.critical(detailedErrorMsg);
          resolve({ error: 'critical_timeout', type: 'media', mediaType });
        }
        else if (waitTime >= config.responseTimeout && !this.criticalFailureDetected) {
          // Solo registramos el warning una vez, pero seguimos esperando
          if (!warningReported) {
            const warningMsg = `Tiempo de espera excedido en Step #${stepNumber}: ${errorMessage}`;
            failedSteps.push(warningMsg);
            logger.warning(warningMsg);
            warningReported = true;
          }

          // Continuar esperando
          setTimeout(checkTimeout, 1000);
        }
        else {
          // Todavía no alcanzamos ningún timeout, seguir esperando
          setTimeout(checkTimeout, 1000);
        }
      };

      // Iniciar la verificación de timeout
      setTimeout(checkTimeout, 1000);
    });
  }

  async sendResponse(message, response) {
    try {
      await message.reply(response);
      logger.success(`Respondido: "${response}"`);
    } catch (error) {
      logger.error(`Error al enviar respuesta "${response}": ${error.message}`);
      logger.error(error.stack);
    }
  }

  async sendAlert(failedSteps, chatId, testStatus) {
    if (failedSteps.length === 0) return;

    // Opción de formato que incluye explícitamente formato de 24 horas
    const dateFormatOptions = { 
      timeZone: "America/Argentina/Buenos_Aires",
      hour12: false, // Esto es clave para usar formato de 24 horas
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };

    const now = new Date().toLocaleString("es-AR", dateFormatOptions);

    // Determinar severidad basada en el estado del test
    const severityIcon = testStatus === 'critical' ? "🔴" : "🟡";

    const formattedMessage = `${severityIcon} Alerta de Monitor Sintético: Letizia
Fecha y hora: ${now}
${testStatus === 'critical' ? "ALERTA CRÍTICA: Fallo en la cotización" : "Alerta: Tiempos de respuesta excedidos"}
Detalles del problema:
${failedSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`;

    // Enviar alerta a todos los chats configurados en ALERT_CHAT_ID
    for (const alertChatId of config.alertChatIds) {
      try {
        // Verificar si el ID parece ser de un grupo
        const isGroup = alertChatId.includes('@g.us');
        
        logger.log(`Enviando alerta a ${isGroup ? 'grupo' : 'chat'}: ${alertChatId}`);
        await this.client.sendMessage(alertChatId, formattedMessage);
        logger.success(`Alerta enviada a ${isGroup ? 'grupo' : 'chat'}: ${alertChatId}`);
      } catch (error) {
        logger.error(`Error al enviar alerta a ${alertChatId}: ${error.message}`);
        logger.error(error.stack);
      }
    }
  }

  async sendRecoveryAlert(chatId, previousStatus) {
    // Opción de formato que incluye explícitamente formato de 24 horas
    const dateFormatOptions = { 
      timeZone: "America/Argentina/Buenos_Aires",
      hour12: false, // Esto es clave para usar formato de 24 horas
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };

    const now = new Date().toLocaleString("es-AR", dateFormatOptions);
    
    const formattedMessage = `🟢 Recuperación de Monitor Sintético: Letizia
Fecha y hora: ${now}
INFO: El sistema se ha recuperado correctamente
Detalles: El sistema ha vuelto a funcionar normalmente después de reportar ${previousStatus === 'critical' ? 'una alerta crítica' : 'un tiempo de respuesta excedido'}.`;

    // Enviar alerta a todos los chats configurados en ALERT_CHAT_ID
    for (const alertChatId of config.alertChatIds) {
      try {
        // Verificar si el ID parece ser de un grupo
        const isGroup = alertChatId.includes('@g.us');
        
        logger.log(`Enviando alerta de recuperación a ${isGroup ? 'grupo' : 'chat'}: ${alertChatId}`);
        await this.client.sendMessage(alertChatId, formattedMessage);
        logger.success(`Alerta de recuperación enviada a ${isGroup ? 'grupo' : 'chat'}: ${alertChatId}`);
      } catch (error) {
        logger.error(`Error al enviar alerta de recuperación a ${alertChatId}: ${error.message}`);
        logger.error(error.stack);
      }
    }
  }
}

module.exports = WhatsAppMonitor;
