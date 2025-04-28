import { buscarClientesPorNombre } from "../database/clienteQueries.js";
import {
  obtenerPedidosImpagosPorCliente,
  marcarPedidoComoPagado,
} from "../database/pedidoQueries.js";
import {
  startConversation,
  getConversationState,
  nextStep,
  endConversation,
} from "../handlers/conversationHandler.js";

const CANCELAR_COMMAND = "/cancelar";

const handleCancelacion = (bot, chatId) => {
  bot.sendMessage(chatId, "❌ Operación de cobro cancelada.");
  endConversation(chatId);
  return true;
};

export const cobros = async (bot, msg) => {
  const chatId = msg.chat.id;

  try {
    startConversation(chatId, "cobros");
    const state = getConversationState(chatId);
    state.data = {
      items: [],
      total: 0,
      codigoVendedor: msg.vendedor.codigo,
      codigoEmpresa: msg.vendedor.codigoEmpresa,
    };
    bot.sendMessage(
      chatId,
      `🔍 
Escribe * para buscar todos los clientes con saldo pendiente.
Escribe parte del nombre para buscar un cliente en particular.
Para cancelar, escribe /cancelar`
    );
  } catch (error) {
    bot.sendMessage(chatId, `Error: ${error.message}`);
  }
};

export const handleCobrosResponse = async (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);
  const texto = msg.text;

  console.log("===== handleCobrosResponse - texto:", texto);
  console.log("===== handleCobrosResponse - state:", state);

  // Si no hay estado de conversación, retornar false
  if (!state || state.command !== "cobros") return false;

  // Verificar cancelación en cualquier paso
  if (texto.toLowerCase() === CANCELAR_COMMAND) {
    return handleCancelacion(bot, chatId);
  }

  try {
    switch (state.step) {
      case 0: // Búsqueda de cliente
        console.log("Paso 0: Búsqueda de cliente con texto:", texto);
        console.log("Código de empresa:", state.data.codigoEmpresa);

        try {
          const clientes = await buscarClientesPorNombre(
            texto,
            state.data.codigoEmpresa
          );
          console.log("Clientes encontrados:", clientes);

          if (!clientes || clientes.length === 0) {
            bot.sendMessage(
              chatId,
              "❌ No se encontraron clientes con saldo pendiente.\nIntenta nuevamente o escribe /cancelar para cancelar."
            );
            return true;
          }

          let mensaje = "*Clientes encontrados con saldo pendiente:*\n\n";
          clientes.forEach((cliente) => {
            mensaje += `*${cliente.codigo}* - ${cliente.nombre} ${cliente.apellido}\n`;
            mensaje += `💰 Saldo pendiente: $${cliente.saldo || 0}\n`;

            // Mostrar información de retornables solo si hay alguno pendiente
            if (cliente.retornables > 0) {
              mensaje += `🧴 Retornables pendientes: ${cliente.retornables}\n`;
            }

            mensaje += "\n";
          });
          mensaje +=
            "\nIngresa el código del cliente seleccionado o /cancelar para cancelar:";

          state.data.clientes = clientes;
          nextStep(chatId);
          console.log(
            "Avanzando al paso 1, estado actualizado:",
            getConversationState(chatId)
          );
          bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown" });
          return true;
        } catch (error) {
          console.error("Error en búsqueda de clientes:", error);
          bot.sendMessage(
            chatId,
            "❌ Error buscando clientes. Intenta nuevamente o escribe /cancelar para cancelar."
          );
          return true;
        }

      case 1: // Selección de cliente
        console.log("Paso 1: Selección de cliente con texto:", texto);
        console.log("Clientes disponibles:", state.data.clientes);

        const clienteSeleccionado = state.data.clientes.find(
          (c) => c.codigo.toString() === texto
        );

        if (!clienteSeleccionado) {
          bot.sendMessage(
            chatId,
            "❌ Código de cliente inválido.\nIntenta nuevamente o escribe /cancelar para cancelar."
          );
          return true;
        }

        console.log("Cliente seleccionado:", clienteSeleccionado);

        // Guardar la información del cliente seleccionado para usarla más tarde
        state.data.clienteSeleccionado = clienteSeleccionado;

        try {
          const pedidosImpagos = await obtenerPedidosImpagosPorCliente(
            clienteSeleccionado.codigo,
            state.data.codigoEmpresa
          );

          console.log("Pedidos impagos encontrados:", pedidosImpagos);

          if (!pedidosImpagos || pedidosImpagos.length === 0) {
            // Mostrar mensaje actualizado que incluye los retornables aunque no tenga pedidos pendientes
            let mensaje = `✅ *Cliente:* ${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}\n\n`;
            mensaje += "Este cliente no tiene pedidos pendientes de pago.";

            // Agregar información de retornables si corresponde
            if (clienteSeleccionado.retornables > 0) {
              mensaje += `\n\n🧴 *Retornables pendientes:* ${clienteSeleccionado.retornables}`;
              mensaje +=
                "\n\n*Nota:* Los retornables no se cobran monetariamente, se deben gestionar por separado.";
            }

            bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown" });
            endConversation(chatId);
            return true;
          }

          let mensajePedidos = `*Cliente:* ${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}\n`;
          mensajePedidos += `*Saldo total pendiente:* $${clienteSeleccionado.saldo}\n`;

          // Agregar información de retornables si corresponde
          if (clienteSeleccionado.retornables > 0) {
            mensajePedidos += `*Retornables pendientes:* ${clienteSeleccionado.retornables}\n`;
            mensajePedidos +=
              "*Nota:* Los retornables no se cobran monetariamente, se deben gestionar por separado.\n";
          }

          mensajePedidos += "\n*Pedidos pendientes de pago:*\n\n";
          pedidosImpagos.forEach((pedido) => {
            const fechaFormateada = new Date(
              pedido.FechaPedido
            ).toLocaleDateString("es-ES");
            mensajePedidos += `*#${pedido.codigo}* - Fecha: ${fechaFormateada}\n`;
            mensajePedidos += `💰 Monto: $${pedido.total}\n\n`;
          });
          mensajePedidos +=
            "Ingresa números de pedido a pagar separados por coma (ej: 1,2,3) o /cancelar para cancelar:";

          state.data.pedidos = pedidosImpagos;
          nextStep(chatId);
          console.log(
            "Avanzando al paso 2, estado actualizado:",
            getConversationState(chatId)
          );
          bot.sendMessage(chatId, mensajePedidos, { parse_mode: "Markdown" });
          return true;
        } catch (error) {
          console.error("Error obteniendo pedidos impagos:", error);
          bot.sendMessage(
            chatId,
            "❌ Error obteniendo pedidos. Intenta nuevamente o escribe /cancelar para cancelar."
          );
          return true;
        }

      case 2: // Procesamiento de pagos
        console.log("Paso 2: Procesamiento de pagos con texto:", texto);

        const pedidosSeleccionados = texto.split(",").map((num) => num.trim());
        console.log("Pedidos seleccionados:", pedidosSeleccionados);

        const pedidosValidos = state.data.pedidos.filter((p) =>
          pedidosSeleccionados.includes(p.codigo.toString())
        );
        console.log("Pedidos válidos encontrados:", pedidosValidos);

        if (!pedidosValidos || pedidosValidos.length === 0) {
          bot.sendMessage(
            chatId,
            "❌ No se seleccionaron pedidos válidos.\nIntenta nuevamente o escribe /cancelar para cancelar."
          );
          return true;
        }

        try {
          // Marcar pedidos como pagados
          for (const pedido of pedidosValidos) {
            await marcarPedidoComoPagado(pedido.codigo);
            console.log("Pedido marcado como pagado:", pedido.codigo);
          }

          const totalCobrado = pedidosValidos.reduce(
            (sum, p) => sum + p.total,
            0
          );

          let mensajeConfirmacion = `✅ *Cobro registrado exitosamente*\n\nPedidos pagados: ${pedidosValidos.length}\nTotal cobrado: $${totalCobrado}`;

          // Agregar recordatorio sobre retornables si el cliente tiene pendientes
          const clienteSeleccionado = state.data.clienteSeleccionado;
          if (clienteSeleccionado && clienteSeleccionado.retornables > 0) {
            mensajeConfirmacion += `\n\n🧴 *Recordatorio:* El cliente tiene ${clienteSeleccionado.retornables} retornables pendientes.`;
            mensajeConfirmacion +=
              "\nLos retornables se deben gestionar por separado desde la opción de entrega de pedidos.";
          }

          bot.sendMessage(chatId, mensajeConfirmacion, {
            parse_mode: "Markdown",
          });

          endConversation(chatId);
          console.log("Conversación finalizada");
          return true;
        } catch (error) {
          console.error("Error procesando pagos:", error);
          bot.sendMessage(
            chatId,
            "❌ Error procesando pagos. Intenta nuevamente o escribe /cancelar para cancelar."
          );
          return true;
        }

      default:
        console.log("Paso desconocido:", state.step);
        bot.sendMessage(
          chatId,
          "❌ Error en el proceso. Por favor, inicia nuevamente el comando."
        );
        endConversation(chatId);
        return true;
    }
  } catch (error) {
    console.error("Error general en cobros:", error);
    bot.sendMessage(
      chatId,
      "❌ Ocurrió un error al procesar el cobro.\nPuedes intentar nuevamente o escribir /cancelar para cancelar."
    );
    return true;
  }

  return false;
};
