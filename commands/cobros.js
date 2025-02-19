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
Para cancelar en cualquier momento, escribe /cancelar`
    );
  } catch (error) {
    bot.sendMessage(chatId, `Error: ${error.message}`);
  }
};

export const handleCobrosResponse = async (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);

  // Si no hay estado de conversación, retornar false
  if (!state || state.command !== "cobros") return false;

  const texto = msg.text;

  // Manejar cancelación
  if (texto.toLowerCase() === "/cancelar") {
    bot.sendMessage(chatId, "❌ Cobro cancelado.");
    endConversation(chatId);
    return true;
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
            "❌ No se encontraron clientes con ese nombre."
          );
          endConversation(chatId);
          return true;
        }

        let mensaje = "*Clientes encontrados:*\n\n";
        clientes.forEach((cliente) => {
          mensaje += `*${cliente.codigo}* - ${cliente.nombre} ${cliente.apellido}\n`;
          mensaje += `💰 Saldo pendiente: $${cliente.saldo || 0}\n\n`;
        });
        mensaje += "\nIngresa el código del cliente seleccionado:";

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
            "❌ Código de cliente inválido. Intenta nuevamente."
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
        // mensajePedidos +=
        //   "Ingresa los números de pedido a pagar separados por coma (ej: 1,2,3):";
        mensajePedidos += "Ingresa números de pedido a pagar:";

        state.data.pedidos = pedidosImpagos;
        nextStep(chatId);
        bot.sendMessage(chatId, mensajePedidos, { parse_mode: "Markdown" });
        return true;

      case 2: // Procesamiento de pagos
        const pedidosSeleccionados = texto.split(",").map((num) => num.trim());
        // nsole.log("pedidosSeleccionados", pedidosSeleccionados);
        const pedidosValidos = state.data.pedidos.filter((p) =>
          pedidosSeleccionados.includes(p.codigo.toString())
        );

        if (pedidosValidos.length === 0) {
          bot.sendMessage(chatId, "❌ No se seleccionaron pedidos válidos.");
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
      "❌ Ocurrió un error al procesar el cobro. Por favor, intenta nuevamente."
    );
    endConversation(chatId);
    return true;
  }

  return false;
};
