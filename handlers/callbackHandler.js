import { handlePedidoCallback as handleListarPedidosCallback } from "../commands/listarPedidos.js";
import { handlePedidoCallback as handleCargarPedidoCallback } from "../commands/cargarPedido.js";
import { handleResumenCallback } from "../commands/resumenPedidos.js";
import {
  listarStock,
  ingresarStock,
  handleStockCallback,
} from "../commands/stock.js";

export const handleCallback = async (bot, callbackQuery, auth) => {
  const action = callbackQuery.data.split("_")[0];

  // Agregar información del vendedor al callback
  callbackQuery.message.vendedor = auth.vendedor;

  // Responder al callback para quitar el "loading" del botón
  bot.answerCallbackQuery(callbackQuery.id);

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
  };

  // Ejecutar el manejador correspondiente
  const handler = actionHandlers[action];
  if (handler) {
    await handler();
  } else {
    console.log("Acción no manejada:", action);
  }
};
