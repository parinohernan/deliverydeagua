import {
  startConversation,
  getConversationState,
  nextStep,
  endConversation,
} from "../handlers/conversationHandler.js";
import {
  buscarClientesPorNombre,
  obtenerClientePorCodigo,
  actualizarCliente,
} from "../database/clienteQueries.js";

const CANCELAR_COMMAND = "/cancelar";

const handleCancelacion = (bot, chatId) => {
  bot.sendMessage(chatId, "❌ Operación de edición cancelada.");
  endConversation(chatId);
  return true;
};

// Inicia la conversación para editar cliente
export const editarCliente = async (bot, msg) => {
  const chatId = msg.chat.id;
  console.log("Iniciando conversación editarCliente para chatId:", chatId);
  try {
    startConversation(chatId, "editarCliente");
    const state = getConversationState(chatId);
    state.data = {
      codigoEmpresa: msg.vendedor.codigoEmpresa,
    };
    bot.sendMessage(
      chatId,
      `✏️ *Editar Cliente*

Escribe parte del nombre o apellido para buscar al cliente que deseas editar.
Para cancelar, escribe ${CANCELAR_COMMAND}`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error al iniciar edición de cliente:", error);
    bot.sendMessage(chatId, `❌ Error al iniciar la edición: ${error.message}`);
  }
};

// Maneja las respuestas durante la conversación de edición
export const handleEditarClienteResponse = async (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);
  const texto = msg.text;

  console.log("===== handleEditarClienteResponse - texto:", texto);
  console.log("===== handleEditarClienteResponse - state:", state);

  if (!state || state.command !== "editarCliente") return false;

  if (texto.toLowerCase() === CANCELAR_COMMAND) {
    return handleCancelacion(bot, chatId);
  }

  try {
    switch (state.step) {
      case 0: // Búsqueda de cliente
        console.log("Paso 0: Búsqueda de cliente con texto:", texto);
        try {
          // Reutilizamos la búsqueda existente, que ahora incluye clientes sin saldo > 0
          const clientes = await buscarClientesPorNombre(
            texto,
            state.data.codigoEmpresa
          );
          console.log("Clientes encontrados:", clientes);

          if (!clientes || clientes.length === 0) {
            bot.sendMessage(
              chatId,
              `❌ No se encontraron clientes con "${texto}".
Intenta nuevamente o escribe ${CANCELAR_COMMAND} para cancelar.`
            );
            return true;
          }

          let mensaje = `*Clientes encontrados:*

`;
          clientes.forEach((cliente) => {
            mensaje += `*${cliente.codigo}* - ${cliente.nombre} ${cliente.apellido}\n`;
          });
          mensaje += `
Ingresa el código del cliente que deseas editar o ${CANCELAR_COMMAND} para cancelar:`;

          state.data.clientesEncontrados = clientes;
          nextStep(chatId);
          bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown" });
          return true;
        } catch (error) {
          console.error("Error en búsqueda de clientes para editar:", error);
          bot.sendMessage(
            chatId,
            `❌ Error buscando clientes. Intenta nuevamente o escribe ${CANCELAR_COMMAND}.`
          );
          return true;
        }

      case 1: // Selección de cliente y campo a editar
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

        // Obtenemos detalles completos (aunque buscarClientes ya trae varios)
        // Podríamos optimizar y usar directamente clienteSeleccionado si tiene todos los datos
        const clienteDetalles = await obtenerClientePorCodigo(
          clienteSeleccionado.codigo
        );
        if (!clienteDetalles) {
          bot.sendMessage(
            chatId,
            `❌ Error al obtener detalles del cliente ${clienteSeleccionado.codigo}. ${CANCELAR_COMMAND} para cancelar.`
          );
          return true;
        }

        state.data.clienteAEditar = clienteDetalles;
        console.log("Cliente a editar:", clienteDetalles);

        const opcionesEdicion = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Nombre", callback_data: "editar_nombre" },
                { text: "Apellido", callback_data: "editar_apellido" },
              ],
              [
                { text: "Dirección", callback_data: "editar_direccion" },
                { text: "Teléfono", callback_data: "editar_telefono" },
              ],
              [{ text: "Cancelar", callback_data: "editar_cancelar" }],
            ],
          },
          parse_mode: "Markdown",
        };

        let mensajeDatos = `*Editando a:* ${clienteDetalles.nombre} ${clienteDetalles.apellido} (#${clienteDetalles.codigo})

`;
        mensajeDatos += `*Nombre:* ${clienteDetalles.nombre}
`;
        mensajeDatos += `*Apellido:* ${clienteDetalles.apellido}\n`;
        mensajeDatos += `*Dirección:* ${clienteDetalles.direccion || "-"}\n`;
        mensajeDatos += `*Teléfono:* ${clienteDetalles.telefono || "-"}\n\n`;
        mensajeDatos += `¿Qué dato deseas modificar?`;

        nextStep(chatId); // Avanzamos al paso donde esperamos el callback del botón
        bot.sendMessage(chatId, mensajeDatos, opcionesEdicion);
        return true;

      case 2: // Esperando nuevo valor (este paso se activa por callback)
        // La lógica principal de este paso está en el callbackHandler (ver paso 3)
        // Aquí solo podríamos poner un mensaje si el usuario escribe texto en lugar de usar botones
        bot.sendMessage(
          chatId,
          `Por favor, selecciona qué dato editar usando los botones de arriba. O escribe ${CANCELAR_COMMAND}.`
        );
        return true;

      case 3: // Recibiendo nuevo valor y actualizando
        const campoAEditar = state.data.campoAEditar;
        const nuevoValor = texto;
        const cliente = state.data.clienteAEditar;

        console.log(
          `Paso 3: Actualizando campo '${campoAEditar}' con valor '${nuevoValor}' para cliente ${cliente.codigo}`
        );

        try {
          await actualizarCliente(
            cliente.codigo,
            campoAEditar,
            nuevoValor,
            state.data.codigoEmpresa
          );

          bot.sendMessage(
            chatId,
            `✅ ¡Cliente actualizado!
*${
              campoAEditar.charAt(0).toUpperCase() + campoAEditar.slice(1)
            }:* ${nuevoValor}`
          );
          endConversation(chatId);
          return true;
        } catch (error) {
          console.error("Error actualizando cliente:", error);
          bot.sendMessage(
            chatId,
            `❌ Error al actualizar el cliente. Intenta nuevamente o escribe ${CANCELAR_COMMAND}.`
          );
          // Podríamos querer volver al paso anterior o cancelar
          return true;
        }

      default:
        console.warn("Paso desconocido en editarCliente:", state.step);
        bot.sendMessage(
          chatId,
          "❌ Error en el proceso. Por favor, inicia nuevamente."
        );
        endConversation(chatId);
        return true;
    }
  } catch (error) {
    console.error("Error general en handleEditarClienteResponse:", error);
    bot.sendMessage(
      chatId,
      `❌ Ocurrió un error inesperado. ${CANCELAR_COMMAND} para cancelar.`
    );
    // Considerar terminar la conversación aquí también
    // endConversation(chatId);
    return true;
  }
};
