<h1 align="center">
  <br>
  <a href="http://www.dcs.ar"><img src="https://i.imgur.com/GgjNXNl.png" alt="DCSolutions" width="200"></a>
  <br>
  WhatsApp Bot para Cotización de Autos
  <br>
</h1>

<h4 align="center">Script automatizado que interactúa con WhatsApp para realizar preguntas y respuestas sobre la cotización de autos.</h4>

<p align="center">
  <a href="#Funciones">Funciones</a> •
  <a href="#Como-se-usa">Como se usa</a> •
  <a href="#Descargar">Descargar</a> •
  <a href="#Creditos">Creditos</a> •
</p>

## Funciones

* Automatiza el proceso de enviar y responder preguntas en un chat de WhatsApp.
  - El bot envía un mensaje inicial "cotizar auto" y luego responde automáticamente a una lista de preguntas.
* Responde preguntas como:
  - ¿Tenés la patente del auto?
  - ¿Cuál es la patente de tu vehículo?
  - ¿Son correctos estos datos?
  - Y más...
* Envía un mensaje de cierre "empezar" después de completar el intercambio de preguntas y respuestas.
* Usa autenticación con código QR para iniciar sesión en WhatsApp Web.
* Los logs de las respuestas automáticas se muestran en la terminal.

## Como se usa

Para clonar este repositorio, vas a necesitar [Git](https://git-scm.com) y [Node.js](https://nodejs.org/en/) instalados en tu PC.

```bash
# Clonar el repositorio.
$ git clone https://github.com/tu_usuario/whatsapp-bot-cotizacion.git

# Ir al repositorio
$ cd whatsapp-bot-cotizacion

# Instalar dependencias
$ npm install

# Iniciar el bot
$ node index.js
