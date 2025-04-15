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

export const handleCallback = async (bot, callbackQuery, auth) => {
  const action = callbackQuery.data.split("_")[0];
  // Agregar información del vendedor al callback
  callbackQuery.message.vendedor = auth.vendedor;

  console.log("handleCallback - action:", action);
  console.log("handleCallback - callbackQuery.data:", callbackQuery.data);

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
    actualizarprecio: () => actualizarPrecio(bot, callbackQuery),
    actualizarPrecioXCodigo: () => handleStockCallback(bot, callbackQuery),
    tipoResumen: () => handleResumenCallback(bot, callbackQuery),
    tipoInforme: () => handleResumenCallback(bot, callbackQuery),
    anular: () => handleListarPedidosCallback(bot, callbackQuery),
    confirmarAnular: () => handleListarPedidosCallback(bot, callbackQuery),
    cancelarAnular: () => handleListarPedidosCallback(bot, callbackQuery),
    calendar: () => handleResumenCallback(bot, callbackQuery),
    
  };

  // Ejecutar el manejador correspondiente
  const handler = actionHandlers[action];
  if (handler) {
    await handler();
  } else {
    console.log("Acción no manejada:", action);
    // Imprimir más información sobre el objeto callbackQuery para depuración
    console.log(
      "Objeto callbackQuery:",
      JSON.stringify(callbackQuery, null, 2)
    );
  }
};
