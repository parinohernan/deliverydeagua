import {
  COMMANDS,
  KEYBOARD_LAYOUT,
  getMainMenuMessage,
} from "../constants/messages.js";
import { getEmpresa } from "../database/empresaQueries.js";
import {
  crearCliente,
  handleCrearClienteResponse,
} from "../commands/crearCliente.js";
import { handleConsultarClienteResponse } from "../commands/consultarCliente.js";
import {
  cargarPedido,
  handleCargarPedidoResponse,
} from "../commands/cargarPedido.js";
import { listarPedidos } from "../commands/listarPedidos.js";
import { resumenPedidos } from "../commands/resumenPedidos.js";
import { handleResumenEntreFechasResponse } from "../commands/resumenPedidos.js";
import { cobros, handleCobrosResponse } from "../commands/cobros.js";
import {
  stock,
  procesarCantidadStock,
  operacionesPendientes,
} from "../commands/stock.js";
import { handleHelp } from "./helpHandler.js";
import { KEYBOARD_BUTTONS } from "../constants/messages.js";
import { conversations } from "./conversationHandler.js";

const mostrarMenuPrincipal = async (bot, chatId, vendedor) => {
  console.log("Mostrando menú principal");
  try {
    const empresa = await getEmpresa(vendedor.codigoEmpresa);
    const mensaje = getMainMenuMessage(empresa, vendedor);
    const options = {
      parse_mode: "Markdown",
      reply_markup: KEYBOARD_LAYOUT,
    };
    bot.sendMessage(chatId, mensaje, options);
  } catch (error) {
    console.error("Error al obtener datos de la empresa:", error);
    bot.sendMessage(chatId, "Error al cargar el menú principal");
  }
};

const handleActiveConversation = (bot, msg) => {
  // Verificar si hay una operación de stock pendiente
  if (operacionesPendientes[msg.chat.id]) {
    console.log("Procesando cantidad de stock...");
    procesarCantidadStock(bot, msg);
    return true;
  }

  // Primero verificamos si el mensaje es un comando o botón del menú principal
  if (
    BUTTON_TO_COMMAND[msg.text] ||
    Object.values(COMMANDS).includes(msg.text)
  ) {
    return false; // No procesar como conversación activa si es un comando
  }

  // Luego procesamos las otras conversaciones activas
  return (
    handleCrearClienteResponse(bot, msg) ||
    handleConsultarClienteResponse(bot, msg) ||
    handleCargarPedidoResponse(bot, msg) ||
    handleResumenEntreFechasResponse(bot, msg) ||
    handleCobrosResponse(bot, msg)
  );
};

const handleCancelacion = (bot, chatId) => {
  console.log("handleCancelacion: 72", chatId);
  // Limpiar operaciones pendientes de stock
  if (operacionesPendientes[chatId]) {
    delete operacionesPendientes[chatId];
  }

  // Limpiar conversaciones activas
  if (conversations.has(chatId)) {
    conversations.delete(chatId);
  }

  bot.sendMessage(
    chatId,
    "❌ Operación cancelada. Volviendo al menú principal..."
  );
  return true;
};

const commandHandlers = {
  [COMMANDS.START]: (bot, msg) =>
    mostrarMenuPrincipal(bot, msg.chat.id, msg.vendedor),
  [COMMANDS.MENU]: (bot, msg) =>
    mostrarMenuPrincipal(bot, msg.chat.id, msg.vendedor),
  [COMMANDS.AYUDA]: (bot, msg) => handleHelp(bot, msg.chat.id, "general"),
  [COMMANDS.CREAR_CLIENTE]: (bot, msg) => crearCliente(bot, msg),
  [COMMANDS.COBROS]: (bot, msg) => cobros(bot, msg),
  [COMMANDS.CARGAR_PEDIDO]: (bot, msg) => cargarPedido(bot, msg),
  [COMMANDS.LISTAR_PEDIDOS]: (bot, msg) => listarPedidos(bot, msg),
  [COMMANDS.RESUMEN]: (bot, msg) => resumenPedidos(bot, msg),
  [COMMANDS.STOCK]: (bot, msg) => stock(bot, msg),
  [COMMANDS.CANCELAR]: (bot, msg) => {
    handleCancelacion(bot, msg.chat.id);
    mostrarMenuPrincipal(bot, msg.chat.id, msg.vendedor);
  },
};

// Agregar este mapeo de botones a comandos
const BUTTON_TO_COMMAND = {
  [KEYBOARD_BUTTONS.COBROS]: COMMANDS.COBROS,
  [KEYBOARD_BUTTONS.CARGAR_PEDIDO]: COMMANDS.CARGAR_PEDIDO,
  [KEYBOARD_BUTTONS.VER_PEDIDOS]: COMMANDS.LISTAR_PEDIDOS,
  [KEYBOARD_BUTTONS.NUEVO_CLIENTE]: COMMANDS.CREAR_CLIENTE,
  [KEYBOARD_BUTTONS.RESUMEN]: COMMANDS.RESUMEN,
  [KEYBOARD_BUTTONS.STOCK]: COMMANDS.STOCK,
  [KEYBOARD_BUTTONS.CANCELAR]: COMMANDS.CANCELAR,
};

export const handleCommand = (bot, msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;

  console.log("Manejando comando:", text);
  console.log(
    "Estado de operaciones pendientes:",
    operacionesPendientes[chatId]
  );

  // Verificar si es una solicitud de ayuda
  if (text?.includes("ayuda")) {
    const comando = text.split(" ")[0].replace("/", "");
    if (handleHelp(bot, chatId, comando)) return true;
  }

  // Manejar cancelación primero
  if (
    text === "/cancelar" ||
    text === COMMANDS.CANCELAR ||
    text === KEYBOARD_BUTTONS.CANCELAR
  ) {
    handleCancelacion(bot, chatId);
    mostrarMenuPrincipal(bot, chatId, msg.vendedor);
    return true;
  }
  // Si hay una operación de stock pendiente, procesarla primero
  if (operacionesPendientes[chatId]) {
    console.log("Procesando operación de stock pendiente");
    return handleActiveConversation(bot, msg);
  }

  // Obtener el comando correspondiente al botón o usar el texto directamente
  const command = BUTTON_TO_COMMAND[text] || text;
  console.log("Comando a ejecutar:", command, text);

  // Si es un comando conocido, ejecutarlo directamente
  let handler = commandHandlers[command];
  if (handler) {
    console.log("Ejecutando handler para:", command);
    handler(bot, msg);
    return true;
  }
  // else {
  //   console.log("No se encontró handler para:", command);
  //   handler = commandHandlers["/menu"];
  //   handler(bot, msg);

  // }

  // Si no es un comando, manejar como posible conversación activa
  if (handleActiveConversation(bot, msg)) {
    console.log("En conversación activa");
    return true;
  }
  // else {
  //   console.log("No se encontró handler para:", command);
  //   handler = commandHandlers["/menu"];
  //   handler(bot, msg);
  //   return true;
  // }
};
