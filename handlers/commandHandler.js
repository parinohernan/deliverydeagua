import {
  crearCliente,
  handleCrearClienteResponse,
} from "../commands/crearCliente.js";
import {
  consultarCliente,
  handleConsultarClienteResponse,
} from "../commands/consultarCliente.js";
import {
  cargarPedido,
  handleCargarPedidoResponse,
} from "../commands/cargarPedido.js";

import { listarPedidos } from "../commands/listarPedidos.js";
import { resumenPedidos } from "../commands/resumenPedidos.js";
import { handleResumenEntreFechasResponse } from "../commands/resumenPedidos.js";
import { getEmpresa } from "../database/empresaQueries.js";
import { cobros, handleCobrosResponse } from "../commands/cobros.js";
import { stock } from "../commands/stock.js";

const mostrarMenuPrincipal = async (bot, chatId, vendedor) => {
  console.log("estoy mostrando menu principal");
  try {
    const empresa = await getEmpresa(vendedor.codigoEmpresa);
    const mensaje = `
🏢 *${empresa.razonSocial}* 
🏪 *Sistema de Gestión de Pedidos* 
👤 ${vendedor.nombre} ${vendedor.apellido}

`;
    // 📋 *Comandos Disponibles:*

    // *Clientes*
    // 🆕 /crearcliente - Crear nuevo cliente
    // 🔍 /consultarcliente - Buscar clientes

    // *Pedidos*
    // 📝 /cargarpedido - Cargar nuevo pedido
    // 📋 /listarpedidos - Ver pedidos pendientes

    // *Informes*
    // 📊 /resumen - Estadísticas y resúmenes
    //   • Pedidos del día
    //   • Entregas realizadas
    //   • Resumen semanal
    //   • Resumen mensual

    // *Cobros*
    // 💰 /cobros - Registrar un cobro

    // 💡 _Tip: Usa /cancelar durante cualquier operación para cancelarla._

    // 🔔 _Para recibir ayuda sobre un comando específico, escríbelo seguido de "ayuda" (ej: /crearcliente ayuda)_
    // `;

    const options = {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          ["📝 Cargar Pedido", "📋 Ver Pedidos"],
          ["🆕 Nuevo Cliente", "📊 Resumen"],
          ["💰 Cobros", "📦 Stock"],
          ["❌ Cancelar"],
        ],
        resize_keyboard: true,
      },
    };
    console.log("enviando mensaje", mensaje);
    bot.sendMessage(chatId, mensaje, options);
  } catch (error) {
    console.error("Error al obtener datos de la empresa:", error);
    // Mostrar menú sin datos de la empresa
    // const mensajeSinEmpresa = mensaje.replace(
    //   "🏢 *${empresa.razonSocial}*\n",
    //   ""
    // );
    // bot.sendMessage(chatId, "sin empresa asociada", options);
  }
};

const mostrarAyuda = (bot, chatId, comando) => {
  const ayudas = {
    crearcliente: {
      titulo: "Crear Cliente - Ayuda",
      contenido: `📝 Este comando te permite crear un nuevo cliente en el sistema.

*Pasos:*
1. Ingresa el nombre del cliente
2. Ingresa el apellido
3. Ingresa la dirección
4. Ingresa el teléfono

❌ Puedes cancelar en cualquier momento usando /cancelar`,
    },

    consultarcliente: {
      titulo: "Consultar Cliente - Ayuda",
      contenido: `🔍 Este comando te permite buscar clientes existentes.

*Uso:*
• Ingresa el código del cliente para búsqueda exacta
• O ingresa parte del nombre/apellido para búsqueda parcial

*Resultados:*
• Muestra código, nombre, dirección y teléfono
• Si hay varios resultados, los lista todos
• Limitado a 10 resultados máximo

❌ Puedes cancelar en cualquier momento usando /cancelar`,
    },

    cargarpedido: {
      titulo: "Cargar Pedido - Ayuda",
      contenido: `📝 Este comando te permite cargar un nuevo pedido.

*Pasos:*
1. Seleccionar cliente:
   • Ingresa código del cliente
   • O busca por nombre/apellido
2. Seleccionar productos:
   • Verás lista de productos disponibles
   • Ingresa código del producto
   • Ingresa cantidad
3. Agregar más productos:
   • Responde "si" para agregar otro
   • Responde "no" para finalizar

*Características:*
• Muestra precios unitarios
• Calcula subtotales
• Muestra resumen antes de finalizar

❌ Puedes cancelar en cualquier momento usando /cancelar`,
    },

    listarpedidos: {
      titulo: "Listar Pedidos - Ayuda",
      contenido: `📋 Este comando muestra los pedidos pendientes de entrega.

*Información mostrada:*
• Número de pedido
• Fecha del pedido
• Datos del cliente
• Dirección de entrega
• Total del pedido

*Acciones disponibles:*
✅ Marcar como entregado
📋 Ver detalles del pedido

*Detalles del pedido:*
• Lista de productos
• Cantidades
• Precios
• Total`,
    },

    resumen: {
      titulo: "Resumen - Ayuda",
      contenido: `📊 Este comando genera informes de pedidos.

*Tipos de resumen:*
• Pedidos de hoy
• Entregados hoy
• Pedidos de la semana
• Entregados esta semana
• Pedidos del mes
• Entregados este mes
• Entre fechas personalizadas

*Información mostrada:*
• Cantidad de pedidos
• Productos vendidos
• Cantidades por producto
• Totales por producto
• Total general

*En resumen entre fechas:*
1. Selecciona tipo (todos/entregados)
2. Ingresa fecha inicial (DD/MM/YYYY)
3. Ingresa fecha final (DD/MM/YYYY)

❌ Puedes cancelar en cualquier momento usando /cancelar`,
    },
  };

  const ayuda = ayudas[comando];
  if (!ayuda) return false;

  bot.sendMessage(chatId, `*${ayuda.titulo}*\n\n${ayuda.contenido}`, {
    parse_mode: "Markdown",
  });
  return true;
};

export const handleCommand = (bot, msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;

  // Verificar si es una solicitud de ayuda
  if (text?.includes("ayuda")) {
    const comando = text.split(" ")[0].replace("/", "");
    if (mostrarAyuda(bot, chatId, comando)) return;
  }
  console.log("estoy manejando comandos", text);
  // Manejar botones del teclado personalizado
  const comandosPorBoton = {
    "📝 Cargar Pedido": "/cargarpedido",
    "📋 Ver Pedidos": "/listarpedidos",
    "💰 Cobros": "/cobros",
    "🆕 Nuevo Cliente": "/crearcliente",
    "📊 Resumen": "/resumen",
    "📦 Stock": "/stock",
    "❌ Cancelar": "/cancelar",
  };

  // Si el mensaje es un botón del teclado, convertirlo al comando correspondiente
  if (comandosPorBoton[text]) {
    msg.text = comandosPorBoton[text];
  }

  // Verificar si estamos en medio de una conversación
  if (
    handleCrearClienteResponse(bot, msg) ||
    handleConsultarClienteResponse(bot, msg) ||
    handleCargarPedidoResponse(bot, msg) ||
    handleResumenEntreFechasResponse(bot, msg) ||
    handleCobrosResponse(bot, msg)
  ) {
    console.log("estoy en una conversacion");
    // return;
  }
  // Si no hay conversación activa, manejar comandos
  switch (msg.text) {
    case "/start":
    case "/menu":
    case "/ayuda":
      mostrarMenuPrincipal(bot, chatId, msg.vendedor);
      break;

    case "/crearcliente":
      crearCliente(bot, msg);
      break;

    // case "/consultarcliente":
    //   consultarCliente(bot, msg);
    //   break;
    case "/cobros":
      cobros(bot, msg);
      break;

    case "/cargarpedido":
      cargarPedido(bot, msg);
      break;

    case "/listarpedidos":
      listarPedidos(bot, msg);
      break;

    case "/resumen":
      resumenPedidos(bot, msg);
      break;
    case "/informes":
      informes(bot, msg);
      break;
    case "/stock":
      stock(bot, msg);
      break;
    // case "/query":
    //   // Tu lógica existente para queries
    //   break;

    default:
      mostrarMenuPrincipal(bot, chatId, msg.vendedor);
  }
};
