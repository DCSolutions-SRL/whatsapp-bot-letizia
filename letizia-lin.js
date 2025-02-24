const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Cliente conectado y listo. Esperando la siguiente ejecución programada...');
    await waitForNextExecution();
    startBot();
    setInterval(startBot, 30 * 60 * 1000); // Ejecutar cada 30 minutos
});

const questionsAndResponses = [
    { question: "¿Tenés la patente del auto?", answer: "SI" },
    { question: "¿Cuál es la patente de tu vehículo?", answer: "AA877WW" },
    { question: "¿Son correctos estos datos?", answer: "NO" },
    { question: "Marca", answer: "Ford" },
    { question: "Año", answer: "2020"},
    { question: "Modelo", answer: "KA"},
    { question: "¿Cuál de estas versiones de vehículo es el tuyo?", answer: "1"},
    { question: "¿El vehículo cuenta con GNC?", answer: "SI" },
    { question: "¿Cuál es el uso que le das a tu auto?", answer: "SI" },
    { question: "¿Cuál es tu código postal?", answer: "1405" }
];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const waitForResponse = (chatId, expectedText, timeout = 60000) => new Promise((resolve, reject) => {
    const start = Date.now();
    const listener = (message) => {
        if (message.from === chatId && message.body.includes(expectedText)) {
            client.removeListener('message', listener);
            resolve(message);
        }
    };
    client.on('message', listener);
    setTimeout(() => {
        client.removeListener('message', listener);
        reject(new Error(`Timeout esperando: ${expectedText}`));
    }, timeout);
});

const sendResponse = async (message, response) => {
    await message.reply(response);
    console.log(`✅ Respondido: ${response}`);
};

const startBot = async () => {
    const chatId = "5491148577777@c.us";
    await client.sendMessage(chatId, "cotizar auto");
    console.log(`📤 Mensaje enviado: "cotizar auto"`);

    for (const { question, answer } of questionsAndResponses) {
        console.log(`Esperando el mensaje: ${question}`);
        try {
            const messageToReply = await waitForResponse(chatId, question);
            await sendResponse(messageToReply, answer);
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            break;
        }
    }

    console.log("⏳ Esperando 30 segundos antes de enviar 'empezar'...");
    await delay(30000);
    await client.sendMessage(chatId, "empezar");
    console.log(`📤 Mensaje enviado: "empezar"`);
};

const waitForNextExecution = async () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const secondsToWait = ((30 - (minutes % 30)) * 60) - now.getSeconds();
    console.log(`⌛ Esperando ${secondsToWait} segundos hasta la siguiente ejecución a las HH:00 o HH:30`);
    await delay(secondsToWait * 1000);
};

client.initialize();

