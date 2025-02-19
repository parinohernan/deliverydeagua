// require("dotenv").config();
import config from "./config.js";
import TelegramBot from "node-telegram-bot-api";
import connectToDatabase from "./database/connection.js";
import { handleCommand } from "./handlers/commandHandler.js";
import { handlePedidoCallback as handleListarPedidosCallback } from "./commands/listarPedidos.js";
import { handlePedidoCallback as handleCargarPedidoCallback } from "./commands/cargarPedido.js";
import { connection } from "./database/connection.js";
import { handleResumenCallback } from "./commands/resumenPedidos.js";
import { getConversationState } from "./handlers/conversationHandler.js";

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
      FROM Vendedores 
      WHERE telegramId = '${username}' OR telegramId = '${chatId}'
    `;

    connection.query(query, "", (err, results) => {
      // console.log("Consulta SQL:", query, results);

      if (err) {
        resolve({ authorized: false });
        return;
      }
      if (results.length === 0) {
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
      console.log("Vendedor encontrado:", vendedor.nombre, vendedor.apellido);
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
  // console.log("Vendedor:", msg.vendedor);

  // Manejar comandos
  handleCommand(bot, msg);

  // Manejar el estado de la conversación
  const state = getConversationState(chatId);
  console.log("Estado de la conversación:", state);
});

// Agregar manejador de callbacks
bot.on("callback_query", async (callbackQuery) => {
  const action = callbackQuery.data.split("_")[0];
  console.log("Callback recibido en index.js:", {
    action,
    data: callbackQuery.data,
  });

  // Agregar información del vendedor al callback
  const auth = await isUserAuthorized(
    callbackQuery.message.chat.id,
    callbackQuery.from.username
  );

  callbackQuery.message.vendedor = auth.vendedor;

  // Responder al callback para quitar el "loading" del botón
  bot.answerCallbackQuery(callbackQuery.id);

  if (["entregar", "detalles", "pago"].includes(action)) {
    handleListarPedidosCallback(bot, callbackQuery);
  } else if (["selectCliente", "selectProducto", "pedido"].includes(action)) {
    handleCargarPedidoCallback(bot, callbackQuery);
  } else if (action === "resumen") {
    handleResumenCallback(bot, callbackQuery);
  }
});

// Iniciar la conexión a la base de datos
connectToDatabase();
