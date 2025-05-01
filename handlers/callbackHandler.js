import { handlePedidoCallback as handleListarPedidosCallback } from "../commands/listarPedidos.js";
import { handlePedidoCallback as handleCargarPedidoCallback } from "../commands/cargarPedido.js";
import { handleResumenCallback } from "../commands/resumenPedidos.js";
import {
  listarStock,
  ingresarStock,
  handleStockCallback,
  actualizarPrecio,
  // actualizarPrecioXCodigo,
} from "../commands/stock.js";
import { handleProductosCallback } from "../commands/productos.js";
import { handleContactoCallback } from "../commands/contacto.js";
import { crearCliente } from "../commands/crearCliente.js";
import { cobros } from "../commands/cobros.js";
import { editarCliente } from "../commands/editarCliente.js";
import { eliminarCliente } from "../commands/eliminarCliente.js";
import {
  getConversationState,
  nextStep,
  endConversation,
} from "./conversationHandler.js";
import { marcarClienteComoInactivo } from "../database/clienteQueries.js";

export const handleCallback = async (bot, callbackQuery, auth) => {
  const action = callbackQuery.data.split("_")[0];
  const callbackData = callbackQuery.data;
  // Agregar información del vendedor al callback
  callbackQuery.message.vendedor = auth.vendedor;

  console.log("handleCallback - action:", action);
  console.log("handleCallback - callbackQuery.data:", callbackData);

  // Comprobar primero si es un callback de contacto
  if (callbackData.startsWith("contacto_")) {
    console.log("Detectado callback de contacto:", callbackData);
    const resultado = handleContactoCallback(bot, callbackQuery);
    console.log("Resultado de handleContactoCallback:", resultado);
    return resultado;
  }

  // Reintroducir el bloque para manejar callbacks del submenú Clientes
  if (callbackData.startsWith("clientes_")) {
    console.log(`Detectado callback de submenú clientes: ${callbackData}`);
    bot.answerCallbackQuery(callbackQuery.id);
    if (callbackData === "clientes_nuevo") {
      return crearCliente(bot, callbackQuery.message);
    }
    if (callbackData === "clientes_cobros") {
      return cobros(bot, callbackQuery.message);
    }
    if (callbackData === "clientes_editar") {
      return editarCliente(bot, callbackQuery.message);
    }
    if (callbackData === "clientes_eliminar") {
      return eliminarCliente(bot, callbackQuery.message);
    }
    // No incluir clientes_retornables aquí
    console.warn("Callback de cliente desconocido:", callbackData);
    return false; // Indicar que no se manejó o fue desconocido
  }

  // --- Manejo de callbacks de Edición de Cliente (editar_campo) ---
  if (callbackData.startsWith("editar_")) {
    const chatId = callbackQuery.message.chat.id;
    const state = getConversationState(chatId);
    console.log(`Detectado callback de edición: ${callbackData}`);

    // Verificar que estamos en la conversación correcta y en el paso de selección de campo (paso 2)
    if (state && state.command === "editarCliente" && state.step === 2) {
      const campo = callbackData.split("_")[1]; // Extraer el campo (nombre, apellido, etc.)

      if (campo === "cancelar") {
        console.log("Edición cancelada por callback.");
        bot.answerCallbackQuery(callbackQuery.id, {
          text: "Edición cancelada",
        });
        bot
          .deleteMessage(chatId, callbackQuery.message.message_id)
          .catch(console.error); // Borrar botones
        endConversation(chatId);
      } else {
        state.data.campoAEditar = campo;
        console.log(`Campo a editar guardado: ${campo}`);
        nextStep(chatId, 3); // Establecer explícitamente el paso 3 para esperar el nuevo valor
        console.log("Avanzando al paso 3 para recibir nuevo valor");
        bot.answerCallbackQuery(callbackQuery.id); // Confirmar recepción del callback

        // Editar el mensaje original para quitar los botones y pedir el nuevo valor
        const nombreCampo = campo.charAt(0).toUpperCase() + campo.slice(1); // Poner mayúscula inicial
        bot
          .editMessageText(`✏️ Ingresa el nuevo valor para *${nombreCampo}*:`, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            parse_mode: "Markdown",
            reply_markup: {}, // Quitar teclado inline
          })
          .catch(console.error);
      }
    } else {
      console.warn(
        "Callback de edición recibido en estado/paso inesperado:",
        state
      );
      bot.answerCallbackQuery(callbackQuery.id, {
        text: "Opción no válida en este momento.",
        show_alert: true,
      });
    }
    return true; // Indicar que el callback fue manejado
  }
  // --- Fin Manejo de callbacks de Edición de Cliente ---

  // --- Manejo de callbacks de Confirmación de Eliminación ---
  if (callbackData.startsWith("eliminar_confirmar_")) {
    const chatId = callbackQuery.message.chat.id;
    const state = getConversationState(chatId);
    console.log(
      `Detectado callback de confirmación de eliminación: ${callbackData}`
    );

    // Verificar que estamos en la conversación correcta y en el paso de confirmación (paso 1)
    if (state && state.command === "eliminarCliente" && state.step === 1) {
      const parts = callbackData.split("_");
      const decision = parts[2]; // SI o NO
      const clienteId = parseInt(parts[3]);

      // Borrar mensaje de confirmación con botones
      bot
        .deleteMessage(chatId, callbackQuery.message.message_id)
        .catch(console.error);

      if (decision === "SI") {
        // Verificar que el ID del callback coincide con el cliente en el estado
        if (
          state.data.clienteAEliminar &&
          state.data.clienteAEliminar.codigo === clienteId
        ) {
          try {
            await marcarClienteComoInactivo(
              clienteId,
              state.data.codigoEmpresa
            );
            bot.answerCallbackQuery(callbackQuery.id, {
              text: "Cliente eliminado (inactivo)",
            });
            bot.sendMessage(
              chatId,
              `✅ Cliente *${state.data.clienteAEliminar.nombre} ${state.data.clienteAEliminar.apellido}* (#${clienteId}) marcado como inactivo.`,
              { parse_mode: "Markdown" }
            );
            endConversation(chatId);
          } catch (error) {
            console.error(
              "Error al marcar cliente como inactivo por callback:",
              error
            );
            bot.answerCallbackQuery(callbackQuery.id, {
              text: `Error: ${error.message}`,
              show_alert: true,
            });
            bot.sendMessage(
              chatId,
              `❌ Error al eliminar cliente: ${error.message}. Puedes intentar de nuevo o cancelar.`
            );
            // No terminamos la conversación aquí, podría intentar de nuevo
          }
        } else {
          console.error(
            "Discrepancia de ID de cliente entre callback y estado:",
            clienteId,
            state.data.clienteAEliminar
          );
          bot.answerCallbackQuery(callbackQuery.id, {
            text: "Error: Discrepancia de datos",
            show_alert: true,
          });
          bot.sendMessage(
            chatId,
            "❌ Error interno al confirmar la eliminación. Por favor, inicia de nuevo."
          );
          endConversation(chatId);
        }
      } else {
        // Decision === "NO"
        bot.answerCallbackQuery(callbackQuery.id, {
          text: "Eliminación cancelada",
        });
        bot.sendMessage(chatId, "❌ Eliminación cancelada por el usuario.");
        endConversation(chatId);
      }
    } else {
      console.warn(
        "Callback de confirmación de eliminación recibido en estado/paso inesperado:",
        state
      );
      bot.answerCallbackQuery(callbackQuery.id, {
        text: "Opción no válida en este momento.",
        show_alert: true,
      });
    }
    return true; // Indicar que el callback fue manejado
  }
  // --- Fin Manejo de callbacks de Confirmación de Eliminación ---

  // Si es un callback de productos, manejarlo directamente
  if (
    callbackData.startsWith("ingresar_") ||
    callbackData.startsWith("ver_") ||
    callbackData.startsWith("actualizarprecio_") ||
    callbackData.includes("Stock_")
  ) {
    console.log("Detectado callback de productos:", callbackData);
    return handleProductosCallback(bot, callbackQuery);
  }

  // Responder al callback para quitar el "loading" del botón
  // (Movido a los casos específicos o al final si no se maneja antes)
  // bot.answerCallbackQuery(callbackQuery.id);

  // Objeto que mapea acciones con sus manejadores
  const actionHandlers = {
    entregar: () => handleListarPedidosCallback(bot, callbackQuery),
    detalles: () => handleListarPedidosCallback(bot, callbackQuery),
    pago: () => handleListarPedidosCallback(bot, callbackQuery),
    selectCliente: () => handleCargarPedidoCallback(bot, callbackQuery),
    selectProducto: () => handleCargarPedidoCallback(bot, callbackQuery),
    pedido: () => handleCargarPedidoCallback(bot, callbackQuery),
    resumen: () => handleResumenCallback(bot, callbackQuery),
    ver: () => listarStock(bot, callbackQuery),
    ingresar: () => ingresarStock(bot, callbackQuery),
    ingresoStock: () => handleStockCallback(bot, callbackQuery),
    salidaStock: () => handleStockCallback(bot, callbackQuery),
    actualizarprecio: () => actualizarPrecio(bot, callbackQuery),
    actualizarPrecioXCodigo: () => handleStockCallback(bot, callbackQuery),
    tipoResumen: () => handleResumenCallback(bot, callbackQuery),
    tipoInforme: () => handleResumenCallback(bot, callbackQuery),
    anular: () => handleListarPedidosCallback(bot, callbackQuery),
    confirmarAnular: () => handleListarPedidosCallback(bot, callbackQuery),
    cancelarAnular: () => handleListarPedidosCallback(bot, callbackQuery),
    calendar: () => handleResumenCallback(bot, callbackQuery),
    // Nuevos handlers para zonas y programación
    zona: () => handleListarPedidosCallback(bot, callbackQuery),
    asignarZona: () => handleListarPedidosCallback(bot, callbackQuery),
    nuevaZona: () => handleListarPedidosCallback(bot, callbackQuery),
    sinZona: () => handleListarPedidosCallback(bot, callbackQuery),
    programar: () => handleListarPedidosCallback(bot, callbackQuery),
    // Nuevo handler para listar pedidos por zona
    listarPedidosZona: () => handleListarPedidosCallback(bot, callbackQuery),
  };

  // Ejecutar el manejador correspondiente si la acción existe
  const handler = actionHandlers[action];
  if (handler) {
    bot.answerCallbackQuery(callbackQuery.id); // Responder aquí para handlers genéricos
    await handler();
  } else if (
    !callbackData.startsWith("clientes_") &&
    !callbackData.startsWith("contacto_") &&
    !callbackData.startsWith("editar_") &&
    !callbackData.startsWith("ingresar_") &&
    !callbackData.startsWith("ver_") &&
    !callbackData.startsWith("actualizarprecio_") &&
    !callbackData.includes("Stock_")
  ) {
    // Solo responder si no fue manejado por casos específicos anteriores
    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Acción no reconocida.",
    });
    console.log("Acción no manejada:", action, callbackData);
    // Imprimir más información sobre el objeto callbackQuery para depuración
    console.log(
      "Objeto callbackQuery:",
      JSON.stringify(callbackQuery, null, 2)
    );
  }
};
