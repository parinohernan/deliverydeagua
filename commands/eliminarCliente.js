import {
  startConversation,
  getConversationState,
  nextStep,
  endConversation,
} from "../handlers/conversationHandler.js";
import {
  buscarClientesPorNombre,
  marcarClienteComoInactivo,
} from "../database/clienteQueries.js";

const CANCELAR_COMMAND = "/cancelar";

const handleCancelacion = (bot, chatId) => {
  bot.sendMessage(chatId, "❌ Operación de eliminación cancelada.");
  endConversation(chatId);
  return true;
};

// Inicia la conversación para eliminar cliente
export const eliminarCliente = async (bot, msg) => {
  const chatId = msg.chat.id;
  console.log("Iniciando conversación eliminarCliente para chatId:", chatId);
  try {
    startConversation(chatId, "eliminarCliente");
    const state = getConversationState(chatId);
    state.data = {
      codigoEmpresa: msg.vendedor.codigoEmpresa,
    };
    bot.sendMessage(
      chatId,
      `🗑️ *Eliminar Cliente*

Escribe parte del nombre o apellido para buscar al cliente que deseas eliminar (marcar como inactivo).
Solo se mostrarán clientes activos.
Para cancelar, escribe ${CANCELAR_COMMAND}`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error al iniciar eliminación de cliente:", error);
    bot.sendMessage(
      chatId,
      `❌ Error al iniciar la eliminación: ${error.message}`
    );
  }
};

// Maneja las respuestas durante la conversación de eliminación
export const handleEliminarClienteResponse = async (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);
  const texto = msg.text;

  console.log("===== handleEliminarClienteResponse - texto:", texto);
  console.log("===== handleEliminarClienteResponse - state:", state);

  if (!state || state.command !== "eliminarCliente") return false;

  // Cancelación por comando funciona en cualquier paso
  if (texto?.toLowerCase() === CANCELAR_COMMAND) {
    return handleCancelacion(bot, chatId);
  }

  try {
    switch (state.step) {
      case 0: // Búsqueda de cliente (activos)
        console.log("Paso 0: Búsqueda de cliente activo con texto:", texto);
        try {
          // buscarClientesPorNombre ya filtra por activo = 1
          const clientes = await buscarClientesPorNombre(
            texto,
            state.data.codigoEmpresa
          );
          console.log("Clientes activos encontrados:", clientes);

          if (!clientes || clientes.length === 0) {
            bot.sendMessage(
              chatId,
              `❌ No se encontraron clientes activos con "${texto}".
Intenta nuevamente o escribe ${CANCELAR_COMMAND} para cancelar.`
            );
            return true;
          }

          let mensaje = `*Clientes activos encontrados:*

`;
          clientes.forEach((cliente) => {
            mensaje += `*${cliente.codigo}* - ${cliente.nombre} ${cliente.apellido}\n`;
            // Añadir saldo y retornables
            mensaje += `  (Saldo: $${cliente.saldo || 0}, Retornables: ${
              cliente.retornables || 0
            })\n`;
          });
          mensaje += `
Ingresa el código del cliente que deseas eliminar (marcar como inactivo) o ${CANCELAR_COMMAND} para cancelar:`;

          state.data.clientesEncontrados = clientes;
          nextStep(chatId);
          bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown" });
          return true;
        } catch (error) {
          console.error("Error en búsqueda de clientes para eliminar:", error);
          bot.sendMessage(
            chatId,
            `❌ Error buscando clientes. Intenta nuevamente o escribe ${CANCELAR_COMMAND}.`
          );
          return true;
        }

      case 1: // Selección de cliente y confirmación
        console.log("Paso 1: Selección de cliente con código:", texto);
        const clienteSeleccionado = state.data.clientesEncontrados.find(
          (c) => c.codigo.toString() === texto
        );

        if (!clienteSeleccionado) {
          bot.sendMessage(
            chatId,
            `❌ Código de cliente inválido.
Intenta nuevamente o escribe ${CANCELAR_COMMAND}.`
          );
          return true;
        }

        state.data.clienteAEliminar = clienteSeleccionado;
        console.log("Cliente a eliminar:", clienteSeleccionado);

        const opcionesConfirmacion = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Sí, Eliminar (Inactivar)",
                  callback_data: `eliminar_confirmar_SI_${clienteSeleccionado.codigo}`,
                },
              ],
              [
                {
                  text: "❌ No, Cancelar",
                  callback_data: `eliminar_confirmar_NO_${clienteSeleccionado.codigo}`,
                },
              ],
            ],
          },
          parse_mode: "Markdown",
        };

        // Mostramos también saldo y retornables en la confirmación
        let mensajeConfirmacion = `*¿Estás seguro que deseas eliminar (marcar como inactivo) al siguiente cliente?*

`;
        mensajeConfirmacion += `*Código:* ${clienteSeleccionado.codigo}
`;
        mensajeConfirmacion += `*Nombre:* ${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}
`;
        mensajeConfirmacion += `*Saldo Pendiente:* $${
          clienteSeleccionado.saldo || 0
        }
`;
        mensajeConfirmacion += `*Retornables Pendientes:* ${
          clienteSeleccionado.retornables || 0
        }

`;
        mensajeConfirmacion += `⚠️ *Esta acción marcará al cliente como inactivo y no aparecerá en búsquedas futuras.*`;

        // No avanzamos de paso aquí, esperamos el callback
        bot.sendMessage(chatId, mensajeConfirmacion, opcionesConfirmacion);
        return true;

      case 2: // Este paso se maneja realmente en el callbackHandler
        console.log(
          "Paso 2 alcanzado en handleEliminarClienteResponse (inesperado, debería manejarse por callback)"
        );
        bot.sendMessage(chatId, "Por favor, usa los botones de confirmación.");
        return true;

      default:
        console.warn("Paso desconocido en eliminarCliente:", state.step);
        bot.sendMessage(
          chatId,
          "❌ Error en el proceso. Por favor, inicia nuevamente."
        );
        endConversation(chatId);
        return true;
    }
  } catch (error) {
    console.error("Error general en handleEliminarClienteResponse:", error);
    bot.sendMessage(
      chatId,
      `❌ Ocurrió un error inesperado. ${CANCELAR_COMMAND} para cancelar.`
    );
    endConversation(chatId);
    return true;
  }
};
