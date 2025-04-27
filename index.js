// require("dotenv").config();
import config from "./config.js";
import TelegramBot from "node-telegram-bot-api";
import connectToDatabase from "./database/connection.js";
import { handleCommand } from "./handlers/commandHandler.js";
import { connection } from "./database/connection.js";
import {
  getConversationState,
  endConversation,
} from "./handlers/conversationHandler.js";
import { handleCallback } from "./handlers/callbackHandler.js";
import { handleCobrosResponse } from "./commands/cobros.js";
// import { operacionesPendientes } from "./handlers/conversationHandler.js";
// import { procesarEntrada } from "./commands/stock.js";
// Configuración del bot
const bot = new TelegramBot(config.telegram.token, { polling: true });
// Función para verificar si un usuario está autorizado
const isUserAuthorized = async (chatId, username) => {
  console.log(
    "Verificando autorización para el usuario, chatID:",
    username,
    chatId
  );
  return new Promise((resolve) => {
    const query = `
      SELECT * 
      FROM vendedores 
      WHERE telegramId = '${username}' OR telegramId = '${chatId}'
    `;
    connection.query(query, "", (err, results) => {
      // console.log("Consulta SQL:", query, results);
      if (err) {
        console.log("Error en la consulta:", err);
        resolve({ authorized: false });
        return;
      }
      if (results.length === 0) {
        console.log("No se encontró ningún vendedor para el usuario:", results);
        resolve({
          authorized: true,
          vendedor: {
            codigo: 4,
            codigoEmpresa: 1,
            nombre: "test",
            apellido: "user",
          },
        });

        return;
      }
      // Guardar información del vendedor para uso posterior
      const vendedor = results[0];
      resolve({
        authorized: true,
        vendedor: {
          codigo: vendedor.codigo,
          codigoEmpresa: vendedor.codigoEmpresa,
          nombre: vendedor.nombre,
          apellido: vendedor.apellido,
        },
      });
    });
  });
};
// Manejador principal de mensajes
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;
  const text = msg.text?.toLowerCase();

  console.log("Mensaje recibido:", text);

  // Verificar autorización o la conexión a la base de datos
  const auth = await isUserAuthorized(chatId, username);
  if (!auth.authorized) {
    bot.sendMessage(
      chatId,
      "Error: conexión a la base de datos perdida. Intenta nuevamente más tarde."
    );
    connectToDatabase();
    return;
  }

  // Agregar información del vendedor al mensaje
  msg.vendedor = auth.vendedor;

  // Verificar si hay estado de conversación activo
  const state = getConversationState(chatId);

  // Verificar primero si es una respuesta a contacto
  if (state && state.command === "contacto") {
    console.log("Se detectó estado de contacto, procesando respuesta...");
    const { handleContactoResponse } = await import("./commands/contacto.js");
    const handled = handleContactoResponse(bot, msg);
    if (handled) return;
  }

  // Verificar si es una respuesta a cobros
  if (state && state.command === "cobros") {
    console.log("Se detectó estado de cobros, procesando respuesta...");
    const handled = await handleCobrosResponse(bot, msg);
    if (handled) return;
  }

  // // Verificar si hay una operación pendiente
  // if (operacionesPendientes[chatId]) {
  //   procesarEntrada(bot, msg);
  //   return;
  // }

  // Verificar si es el comando cancelar
  if (text === "/cancelar") {
    if (state) {
      endConversation(chatId);
    }
    handleCommand(bot, msg);
    return;
  }
  // Manejar comandos y mostrar menú si es necesario
  const commandHandled = handleCommand(bot, msg);
  // Si no se manejó ningún comando y no hay conversación activa, mostrar menú principal
  if (!commandHandled) {
    if (!state) {
      handleCommand(bot, { ...msg, text: "/menu" });
    }
  }
});
// Simplificar el manejador de callbacks
bot.on("callback_query", async (callbackQuery) => {
  const auth = await isUserAuthorized(
    callbackQuery.message.chat.id,
    callbackQuery.from.username
  );

  // Añadir información del vendedor al mensaje del callback
  callbackQuery.message.vendedor = auth.vendedor;

  handleCallback(bot, callbackQuery, auth);
});
// Iniciar la conexión a la base de datos
connectToDatabase();

connection.connect((err) => {
  if (err) {
    console.error("Error de conexión: " + err.stack);
    return;
  }
  console.log("Conectado como ID " + connection.threadId);
});
