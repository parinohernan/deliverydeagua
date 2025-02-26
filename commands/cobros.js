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

  // Si no hay estado de conversación, retornar false
  if (!state || state.command !== "cobros") return false;

  // Verificar cancelación en cualquier paso
  if (texto.toLowerCase() === CANCELAR_COMMAND) {
    return handleCancelacion(bot, chatId);
  }

  try {
    switch (state.step) {
      case 0: // Búsqueda de cliente
        const clientes = await buscarClientesPorNombre(
          texto,
          state.data.codigoEmpresa
        );
        if (clientes.length === 0) {
          bot.sendMessage(
            chatId,
            "❌ No se encontraron clientes con ese nombre.\nIntenta nuevamente o escribe /cancelar para cancelar."
          );
          return true;
        }

        let mensaje = "*Clientes encontrados:*\n\n";
        clientes.forEach((cliente) => {
          mensaje += `*${cliente.codigo}* - ${cliente.nombre} ${cliente.apellido}\n`;
          mensaje += `💰 Saldo pendiente: $${cliente.saldo || 0}\n\n`;
        });
        mensaje +=
          "\nIngresa el código del cliente seleccionado o /cancelar para cancelar:";

        state.data.clientes = clientes;
        nextStep(chatId);
        bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown" });
        return true;

      case 1: // Selección de cliente
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
        const pedidosImpagos = await obtenerPedidosImpagosPorCliente(
          clienteSeleccionado.codigo,
          state.data.codigoEmpresa
        );

        if (pedidosImpagos.length === 0) {
          bot.sendMessage(
            chatId,
            "✅ Este cliente no tiene pedidos pendientes de pago."
          );
          endConversation(chatId);
          return true;
        }

        let mensajePedidos = "*Pedidos pendientes de pago:*\n\n";
        pedidosImpagos.forEach((pedido) => {
          const fechaFormateada = new Date(
            pedido.FechaPedido
          ).toLocaleDateString("es-ES");
          mensajePedidos += `*#${pedido.codigo}* - Fecha: ${fechaFormateada}\n`;
          mensajePedidos += `💰 Monto: $${pedido.total}\n\n`;
        });
        mensajePedidos +=
          "Ingresa números de pedido a pagar o /cancelar para cancelar:";

        state.data.pedidos = pedidosImpagos;
        nextStep(chatId);
        bot.sendMessage(chatId, mensajePedidos, { parse_mode: "Markdown" });
        return true;

      case 2: // Procesamiento de pagos
        const pedidosSeleccionados = texto.split(",").map((num) => num.trim());
        const pedidosValidos = state.data.pedidos.filter((p) =>
          pedidosSeleccionados.includes(p.codigo.toString())
        );

        if (pedidosValidos.length === 0) {
          bot.sendMessage(
            chatId,
            "❌ No se seleccionaron pedidos válidos.\nIntenta nuevamente o escribe /cancelar para cancelar."
          );
          return true;
        }

        // Marcar pedidos como pagados
        for (const pedido of pedidosValidos) {
          await marcarPedidoComoPagado(pedido.codigo);
        }

        const totalCobrado = pedidosValidos.reduce(
          (sum, p) => sum + p.total,
          0
        );
        bot.sendMessage(
          chatId,
          `✅ *Cobro registrado exitosamente*\n\nPedidos pagados: ${pedidosValidos.length}\nTotal cobrado: $${totalCobrado}`,
          { parse_mode: "Markdown" }
        );

        endConversation(chatId);
        return true;
    }
  } catch (error) {
    console.error("Error en cobros:", error);
    bot.sendMessage(
      chatId,
      "❌ Ocurrió un error al procesar el cobro.\nPuedes intentar nuevamente o escribir /cancelar para cancelar."
    );
    return true;
  }

  return false;
};
