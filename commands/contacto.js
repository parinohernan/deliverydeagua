/**
 * Comando para enviar un mensaje de contacto al administrador
 */
import {
  startConversation,
  getConversationState,
  nextStep,
  endConversation,
  updateConversationState,
} from "../handlers/conversationHandler.js";

// ID del grupo de administradores
// IMPORTANTE: Reemplazar este valor con el ID real del grupo de Telegram
// Para obtener el ID del grupo, agrega el bot @RawDataBot a tu grupo y
// verás el chat_id en el mensaje que envía
const ADMIN_GROUP_ID = -4679244718; // Reemplazar con el ID real del grupo

/**
 * Maneja el comando de contacto e inicia el proceso de creación del mensaje
 * @param {Object} bot - Instancia del bot de Telegram
 * @param {Object} msg - Mensaje recibido
 */
export const contacto = (bot, msg) => {
  const chatId = msg.chat.id;
  const vendedor = msg.vendedor;

  // Inicio de la conversación
  startConversation(chatId, "contacto");

  // Guardar datos del usuario en el estado de la conversación
  const state = getConversationState(chatId);
  state.data = {
    vendedor: vendedor
      ? {
          nombre: vendedor.nombre,
          apellido: vendedor.apellido,
          codigoEmpresa: vendedor.codigoEmpresa,
        }
      : {
          nombre: "Usuario",
          apellido: "desconocido",
          codigoEmpresa: "No disponible",
        },
    timestamp: new Date().toLocaleString(),
  };

  // Actualizar el estado
  updateConversationState(chatId, state);

  // Solicitar motivo de consulta
  bot.sendMessage(chatId, "📝 Por favor, indique el motivo de su consulta:");
};

/**
 * Maneja las respuestas del usuario durante el proceso de contacto
 * @param {Object} bot - Instancia del bot de Telegram
 * @param {Object} msg - Mensaje recibido
 * @returns {Boolean} - Si se manejó el mensaje como parte de una conversación activa
 */
export const handleContactoResponse = (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);

  console.log(
    "[handleContactoResponse] Iniciando verificación - chatId:",
    chatId
  );

  // Verificar si existe una conversación activa de contacto
  if (!state || state.command !== "contacto") {
    console.log(
      "[handleContactoResponse] No hay conversación de contacto activa"
    );
    return false;
  }

  console.log(
    `[handleContactoResponse] chatId: ${chatId}, step: ${state.step}, texto: ${msg.text}`
  );

  // Manejar según el paso actual
  switch (state.step) {
    case 0: // Paso 0: Recibir motivo de consulta
      console.log(
        "[handleContactoResponse] Procesando paso 0: Recibiendo motivo"
      );
      // Guardar el motivo
      state.data.motivo = msg.text;
      updateConversationState(chatId, state);

      // Mostrar confirmación antes de enviar
      bot.sendMessage(
        chatId,
        `📋 *Resumen de su consulta:*\n\n` +
          `*Motivo:* ${state.data.motivo}\n\n` +
          `¿Desea enviar esta consulta al equipo de soporte?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Enviar", callback_data: "contacto_enviar" },
                { text: "❌ Cancelar", callback_data: "contacto_cancelar" },
              ],
            ],
          },
        }
      );

      // Avanzar al siguiente paso
      nextStep(chatId);
      console.log("[handleContactoResponse] Avanzando al paso 1");
      return true;

    default:
      console.log(`[handleContactoResponse] Paso no manejado: ${state.step}`);
      return false;
  }
};

/**
 * Maneja las callbacks de los botones en el proceso de contacto
 * @param {Object} bot - Instancia del bot de Telegram
 * @param {Object} query - Query de callback
 * @returns {Boolean} - Si se manejó el callback
 */
export const handleContactoCallback = (bot, query) => {
  const chatId = query.message.chat.id;
  const state = getConversationState(chatId);

  console.log("[handleContactoCallback] Callback recibido:", query.data);

  // Verificar si existe una conversación activa
  if (!state || state.command !== "contacto") {
    console.log(
      "[handleContactoCallback] No hay una conversación activa de contacto"
    );
    return false;
  }

  console.log(
    `[handleContactoCallback] chatId: ${chatId}, step: ${state.step}, callback: ${query.data}`
  );

  // Procesar la acción según el callback
  switch (query.data) {
    case "contacto_enviar":
      console.log("[handleContactoCallback] Procesando envío del mensaje");
      // Enviar el mensaje al grupo de administradores
      enviarMensajeAlGrupo(bot, state.data, chatId);

      // Confirmar al usuario
      bot.answerCallbackQuery(query.id, {
        text: "Mensaje enviado correctamente",
      });
      bot.sendMessage(
        chatId,
        "📬 Tu consulta ha sido enviada al equipo de soporte técnico. Pronto nos pondremos en contacto contigo."
      );

      // Finalizar conversación
      endConversation(chatId);
      console.log(
        "[handleContactoCallback] Finalizada la conversación de contacto"
      );
      return true;

    case "contacto_cancelar":
      console.log("[handleContactoCallback] Cancelando envío");
      // Cancelar el envío
      bot.answerCallbackQuery(query.id, { text: "Operación cancelada" });
      bot.sendMessage(chatId, "❌ Envío de consulta cancelado.");

      // Finalizar conversación
      endConversation(chatId);
      console.log(
        "[handleContactoCallback] Finalizada la conversación de contacto (cancelada)"
      );
      return true;

    default:
      console.log(
        `[handleContactoCallback] Callback no manejado: ${query.data}`
      );
      return false;
  }
};

/**
 * Envía el mensaje al grupo de administradores
 * @param {Object} bot - Instancia del bot
 * @param {Object} data - Datos del mensaje
 * @param {Number} userChatId - ID del chat del usuario
 */
const enviarMensajeAlGrupo = (bot, data, userChatId) => {
  // Preparar el mensaje para el grupo
  const adminMessage = `
🔔 *Nueva solicitud de contacto*

👤 *De:* ${data.vendedor.nombre} ${data.vendedor.apellido}
🆔 *Chat ID:* ${userChatId}
🏢 *Empresa:* ${data.vendedor.codigoEmpresa}
⏰ *Fecha:* ${data.timestamp}

📝 *Motivo de la consulta:*
${data.motivo}

Para responder, pueden usar:
\`/responder ${userChatId} Su respuesta\`
`;

  // Enviar mensaje al grupo de administradores
  bot
    .sendMessage(ADMIN_GROUP_ID, adminMessage, { parse_mode: "Markdown" })
    .then(() => {
      console.log(
        `Mensaje de contacto enviado al grupo de administradores. Solicitante: ${data.vendedor.nombre} ${data.vendedor.apellido}`
      );
    })
    .catch((error) => {
      console.error(
        "Error al enviar mensaje al grupo de administradores:",
        error
      );
      // Notificar al usuario que hubo un problema
      bot.sendMessage(
        userChatId,
        "❌ Hubo un problema al contactar con soporte. Por favor intenta más tarde."
      );
    });
};

/**
 * Función para responder a un usuario desde el grupo de administradores
 * @param {Object} bot - Instancia del bot
 * @param {Object} adminMsg - Mensaje del administrador
 * @returns {Boolean} - Si se manejó el mensaje como un comando de respuesta
 */
export const responderUsuario = (bot, adminMsg) => {
  const text = adminMsg.text;

  // Formato esperado: /responder ID_CHAT Mensaje
  if (text.startsWith("/responder ")) {
    const parts = text.split(" ");
    if (parts.length >= 3) {
      const targetChatId = parts[1];
      const responseMessage = parts.slice(2).join(" ");

      bot
        .sendMessage(
          targetChatId,
          `📩 *Respuesta del soporte:*\n\n${responseMessage}`,
          {
            parse_mode: "Markdown",
          }
        )
        .then(() => {
          // Respuesta confirmación de envío al grupo
          bot.sendMessage(
            adminMsg.chat.id,
            "✅ Mensaje enviado correctamente al usuario"
          );
        })
        .catch((error) => {
          bot.sendMessage(
            adminMsg.chat.id,
            `❌ Error al enviar mensaje: ${error.message}`
          );
        });
      return true;
    }
  }
  return false;
};
