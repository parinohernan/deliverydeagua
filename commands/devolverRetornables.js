import {
  startConversation,
  getConversationState,
  nextStep,
  endConversation,
} from "../handlers/conversationHandler.js";
import {
  buscarClientesPorNombre,
  modificarSaldoRetornables,
  obtenerClientePorCodigo,
} from "../database/clienteQueries.js";

const CANCELAR_COMMAND = "/cancelar";

const handleCancelacion = (bot, chatId) => {
  bot.sendMessage(
    chatId,
    "❌ Operación de devolución de retornables cancelada."
  );
  endConversation(chatId);
  return true;
};

// Inicia la conversación para devolver retornables
export const devolverRetornables = async (bot, msg) => {
  const chatId = msg.chat.id;
  console.log(
    "Iniciando conversación devolverRetornables para chatId:",
    chatId
  );
  try {
    startConversation(chatId, "devolverRetornables");
    const state = getConversationState(chatId);
    state.data = {
      codigoEmpresa: msg.vendedor.codigoEmpresa,
    };
    bot.sendMessage(
      chatId,
      `🧴 *Devolver Retornables*

Escribe parte del nombre o apellido para buscar al cliente.
Para cancelar, escribe ${CANCELAR_COMMAND}`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error al iniciar devolución de retornables:", error);
    bot.sendMessage(
      chatId,
      `❌ Error al iniciar la devolución: ${error.message}`
    );
  }
};

// Maneja las respuestas durante la conversación de devolución
export const handleDevolverRetornablesResponse = async (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);
  const texto = msg.text;

  console.log("===== handleDevolverRetornablesResponse - texto:", texto);
  console.log("===== handleDevolverRetornablesResponse - state:", state);

  if (!state || state.command !== "devolverRetornables") return false;

  if (texto.toLowerCase() === CANCELAR_COMMAND) {
    return handleCancelacion(bot, chatId);
  }

  try {
    switch (state.step) {
      case 0: // Búsqueda de cliente
        console.log("Paso 0: Búsqueda de cliente con texto:", texto);
        try {
          const clientes = await buscarClientesPorNombre(
            texto,
            state.data.codigoEmpresa
          );
          console.log("Clientes encontrados para retornar:", clientes);

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
            mensaje += `*${cliente.codigo}* - ${cliente.nombre} ${
              cliente.apellido
            } (🧴 ${cliente.retornables || 0})\n`;
          });
          mensaje += `
Ingresa el código del cliente que realiza la devolución o ${CANCELAR_COMMAND} para cancelar:`;

          state.data.clientesEncontrados = clientes;
          nextStep(chatId);
          bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown" });
          return true;
        } catch (error) {
          console.error("Error en búsqueda de clientes para retornar:", error);
          bot.sendMessage(
            chatId,
            `❌ Error buscando clientes. Intenta nuevamente o escribe ${CANCELAR_COMMAND}.`
          );
          return true;
        }

      case 1: // Selección de cliente y solicitud de cantidad
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

        // Guardamos el cliente seleccionado. Ya tenemos el saldo de la búsqueda inicial.
        state.data.clienteSeleccionado = clienteSeleccionado;
        const saldoActual = clienteSeleccionado.retornables || 0;
        console.log("Cliente seleccionado:", clienteSeleccionado);

        nextStep(chatId);
        bot.sendMessage(
          chatId,
          `*Cliente:* ${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}
*Saldo actual de retornables:* 🧴 ${saldoActual}

¿Cuántos envases está devolviendo?
(Ingresa un número positivo)`,
          { parse_mode: "Markdown" }
        );
        return true;

      case 2: // Recepción de cantidad y actualización
        console.log("Paso 2: Cantidad devuelta recibida:", texto);
        const cantidadDevuelta = parseInt(texto);

        if (isNaN(cantidadDevuelta) || cantidadDevuelta <= 0) {
          bot.sendMessage(
            chatId,
            `❌ Por favor, ingresa un número válido y positivo para la cantidad devuelta.
Intenta nuevamente o escribe ${CANCELAR_COMMAND}.`
          );
          return true; // Permanecer en el mismo paso
        }

        const cliente = state.data.clienteSeleccionado;
        const saldoAnterior = cliente.retornables || 0;
        const cambio = -cantidadDevuelta; // Negativo porque es una devolución
        const nuevoSaldo = saldoAnterior + cambio;

        console.log(
          `Actualizando saldo para cliente ${cliente.codigo}: ${saldoAnterior} + (${cambio}) = ${nuevoSaldo}`
        );

        try {
          await modificarSaldoRetornables(
            cliente.codigo,
            cambio,
            state.data.codigoEmpresa
          );

          bot.sendMessage(
            chatId,
            `✅ ¡Devolución registrada!
*Cliente:* ${cliente.nombre} ${cliente.apellido}
*Retornables devueltos:* ${cantidadDevuelta}
*Nuevo saldo:* 🧴 ${nuevoSaldo}`,
            { parse_mode: "Markdown" }
          );
          endConversation(chatId);
          return true;
        } catch (error) {
          console.error("Error actualizando saldo de retornables:", error);
          bot.sendMessage(
            chatId,
            `❌ Error al registrar la devolución: ${error.message}.
Intenta nuevamente o escribe ${CANCELAR_COMMAND}.`
          );
          // Volver al paso anterior podría ser útil aquí
          // previousStep(chatId);
          return true;
        }

      default:
        console.warn("Paso desconocido en devolverRetornables:", state.step);
        bot.sendMessage(
          chatId,
          "❌ Error en el proceso. Por favor, inicia nuevamente."
        );
        endConversation(chatId);
        return true;
    }
  } catch (error) {
    console.error("Error general en handleDevolverRetornablesResponse:", error);
    bot.sendMessage(
      chatId,
      `❌ Ocurrió un error inesperado. ${CANCELAR_COMMAND} para cancelar.`
    );
    endConversation(chatId);
    return true;
  }
};
