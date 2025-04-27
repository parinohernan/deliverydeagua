import {
  obtenerNotificaciones,
  formatearNotificaciones,
} from "../utils/notificaciones.js";

export const KEYBOARD_BUTTONS = {
  CARGAR_PEDIDO: "📝 Cargar Pedido",
  VER_PEDIDOS: "📋 Ver Pedidos",
  COBROS: "💰 Cobros",
  NUEVO_CLIENTE: "🆕 Nuevo Cliente",
  RESUMEN: "📊 Resumen",
  GESTION_PRODUCTOS: "📦 Gestión Productos",
  CANCELAR: "❌ Cancelar",
};

export const COMMANDS = {
  START: "/start",
  MENU: "/menu",
  AYUDA: "/ayuda",
  CREAR_CLIENTE: "/crearcliente",
  COBROS: "/cobros",
  CARGAR_PEDIDO: "/cargarpedido",
  LISTAR_PEDIDOS: "/listarpedidos",
  RESUMEN: "/resumen",
  INFORMES: "/informes",
  GESTION_PRODUCTOS: "/productos",
  STOCK: "/stock",
};

export const KEYBOARD_LAYOUT = {
  keyboard: [
    [KEYBOARD_BUTTONS.CARGAR_PEDIDO, KEYBOARD_BUTTONS.VER_PEDIDOS],
    [KEYBOARD_BUTTONS.NUEVO_CLIENTE, KEYBOARD_BUTTONS.RESUMEN],
    [KEYBOARD_BUTTONS.COBROS, KEYBOARD_BUTTONS.GESTION_PRODUCTOS],
    [KEYBOARD_BUTTONS.CANCELAR],
  ],
  resize_keyboard: true,
};

// Formatea la fecha en formato DD/MM/YYYY
const formatearFecha = (fecha) => {
  if (!fecha) return "No disponible";
  const date = new Date(fecha);
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")}/${date.getFullYear()}`;
};

export const getMainMenuMessage = async (empresa, vendedor) => {
  // Usar la URL de imagen de la empresa o la predeterminada
  const imageURL =
    empresa.imageURL ||
    "https://res.cloudinary.com/drgs7xuag/image/upload/f_auto,q_auto/v1/recursos/edelecjhmeytkyc6ws14.png";

  // Formatear fecha de vencimiento
  const fechaVencimiento = formatearFecha(empresa.fechaVencimiento);

  // Verificar si hay advertencia de vencimiento próximo (7 días)
  let advertenciaVencimiento = "";
  if (empresa.fechaVencimiento) {
    const hoy = new Date();
    const vencimiento = new Date(empresa.fechaVencimiento);
    const diasRestantes = Math.floor(
      (vencimiento - hoy) / (1000 * 60 * 60 * 24)
    );

    if (diasRestantes <= 0) {
      advertenciaVencimiento =
        "\n⚠️ *¡PLAN VENCIDO!* Por favor, contacte con soporte.";
    } else if (diasRestantes <= 7) {
      advertenciaVencimiento = `\n⚠️ *Advertencia:* Su plan vence en ${diasRestantes} días.`;
    }
  }

  // Obtener notificaciones para este vendedor/empresa
  let notificacionesTexto = "";
  // try {
  //   const notificaciones = await obtenerNotificaciones(
  //     vendedor.codigo,
  //     empresa.codigo
  //   );
  //   notificacionesTexto = formatearNotificaciones(notificaciones);
  // } catch (error) {
  //   console.error("Error al obtener notificaciones:", error);
  // }

  return `
[​](${imageURL})
🏢 *${empresa.razonSocial}* 
🏪 *Janus Delivery Manager* 
👤 ${vendedor.nombre} ${vendedor.apellido}
📊 Plan: *${empresa.plan || "Free"}*
📅 Vencimiento: *${fechaVencimiento}*${advertenciaVencimiento}
${empresa.textoInfo ? `\n💬 ${empresa.textoInfo}` : ""}${notificacionesTexto}

Usa los botones para navegar por el bot 
o escribe el comando que necesitas.

*Para cancelar en cualquier momento, escribe /cancelar*
`;
};

// Teclados personalizados para cargarPedido
export const PEDIDO_KEYBOARDS = {
  // Teclado para selección de cantidad
  CANTIDAD: {
    reply_markup: {
      keyboard: [
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["📝 Otra cantidad", "❌ Cancelar"],
      ],
      resize_keyboard: true,
    },
  },

  // Teclado para búsqueda de productos
  BUSQUEDA_PRODUCTOS: {
    reply_markup: {
      keyboard: [["❌ Cancelar", "🏁 Terminar Pedido"]],
      resize_keyboard: true,
    },
  },

  // Teclado para programar entrega
  PROGRAMAR_ENTREGA: {
    reply_markup: {
      keyboard: [["⏭️ Continuar sin programar entrega"], ["❌ Cancelar"]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  },

  // Teclado para selección de zona de reparto
  ZONA_REPARTO: {
    reply_markup: {
      keyboard: [["⏭️ Continuar sin asignar zona"], ["❌ Cancelar"]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  },

  // Eliminar teclado personalizado
  REMOVE_KEYBOARD: {
    reply_markup: {
      remove_keyboard: true,
    },
  },
};

// Botones inline para acciones del pedido
export const PEDIDO_INLINE_BUTTONS = {
  // Botones para finalizar o continuar pedido
  FINALIZAR_PEDIDO: {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "➕ Agregar más productos",
            callback_data: "pedido_agregarMas",
          },
          {
            text: "✅ Finalizar Pedido",
            callback_data: "pedido_finalizar",
          },
        ],
      ],
    },
  },

  // Botón para terminar pedido sin más productos
  TERMINAR_PEDIDO: {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🏁 Terminar Pedido",
            callback_data: "pedido_terminar",
          },
        ],
      ],
    },
  },

  // Botones para continuar búsqueda
  NUEVA_BUSQUEDA: (buttons) => ({
    reply_markup: {
      inline_keyboard: [
        ...buttons,
        [
          {
            text: "🔍 Nueva búsqueda",
            callback_data: "buscarProductos_nueva",
          },
          {
            text: "🏁 Terminar Pedido",
            callback_data: "pedido_terminar",
          },
        ],
      ],
    },
  }),
};

// Mensajes para el flujo de carga de pedido
export const PEDIDO_MESSAGES = {
  SOLICITAR_CLIENTE:
    "Escribe parte del nombre para buscar el cliente.\nPara cancelar el pedido en cualquier momento, escribe /cancelar",

  SELECCIONAR_CLIENTE: "Selecciona un cliente:",

  NO_CLIENTES: "No se encontraron clientes. Intenta con otro nombre o código:",

  ERROR_BUSQUEDA: (error) => `Error en la búsqueda: ${error.message}`,

  SELECCIONAR_PRODUCTO: (cliente) =>
    `🛍️ Pedido de *${cliente.nombre} ${cliente.apellido}*\n\nSelecciona un producto de la lista:`,

  BUSCAR_PRODUCTOS: (cliente, totalProductos) =>
    `🛍️ Pedido de *${cliente.nombre} ${cliente.apellido}*\n\nHay ${totalProductos} productos disponibles. Escribe parte del nombre del producto para buscarlo:`,

  NO_PRODUCTOS:
    "No hay productos disponibles. Por favor, agrega productos primero.",

  NO_RESULTADOS_BUSQUEDA:
    "No se encontraron productos con ese término. Intenta con otra búsqueda:",

  MUCHOS_RESULTADOS:
    "Hay demasiados productos con esa descripción. Por favor, intenta con una búsqueda más específica:",

  RESULTADOS_BUSQUEDA: (cliente, textoBusqueda) =>
    `🛍️ Pedido de *${cliente.nombre} ${cliente.apellido}*\n\nResultados de búsqueda para "${textoBusqueda}":\nSelecciona un producto de la lista:`,

  SELECCIONAR_CANTIDAD: (producto) =>
    `Seleccionaste: ${producto.descripcion}\nPrecio: $${producto.precio}\n\nIngresa la cantidad:`,

  SOLICITAR_OTRA_CANTIDAD: "Ingresa la cantidad deseada (solo números):",

  CANTIDAD_INVALIDA: "Por favor ingresa un número válido mayor a cero:",

  PRODUCTO_AGREGADO: (producto, cantidad, subtotal, total) =>
    `✅ Producto agregado: ${producto.descripcion}\nCantidad: ${cantidad}\nSubtotal: $${subtotal}\n\nTotal actual: $${total}`,

  PRODUCTO_NO_ENCONTRADO:
    "Error: Producto no encontrado. Inicia el proceso nuevamente.",

  PROGRAMAR_ENTREGA: (diaEjemplo, mesEjemplo, anioEjemplo) =>
    `🗓️ *Programar entrega*\n\nIngrese la fecha y hora de entrega en formato:\nDD/MM/YYYY HH:MM\n\nEjemplo: ${diaEjemplo}/${mesEjemplo}/${anioEjemplo} 10:00\n\nO seleccione "Continuar sin programar entrega" para finalizar sin especificar una fecha.`,

  FORMATO_FECHA_INCORRECTO:
    "❌ Formato de fecha y hora incorrecto. Por favor, use el formato DD/MM/YYYY HH:MM",

  PEDIDO_CONFIRMADO: (
    pedidoId,
    cliente,
    detalleProductos,
    total,
    mensajeFecha
  ) =>
    `✅ *Pedido #${pedidoId} guardado correctamente*\n\n` +
    `📋 *Detalle del pedido:*\n` +
    `Cliente: ${cliente.nombre} ${cliente.apellido}\n\n` +
    `${detalleProductos}\n` +
    `*Total: $${total.toFixed(2)}*${mensajeFecha}`,

  PEDIDO_ERROR: (error) =>
    `❌ Ocurrió un error al guardar el pedido: ${error.message}. Por favor, intente nuevamente.`,

  PEDIDO_CANCELADO: "❌ Pedido cancelado",

  PROCESANDO_PEDIDO: "Procesando pedido...",

  ERROR_OCURRIDO: "Se ha producido un error...",

  CANCELANDO_PEDIDO: "Cancelando pedido...",

  SESION_EXPIRADA:
    "⚠️ La sesión ha expirado. Por favor, inicie el proceso nuevamente con /cargarPedido",

  SESION_INVALIDA:
    "⚠️ La sesión es inválida. Por favor, inicie el proceso nuevamente con /cargarPedido",

  PEDIDO_FINALIZADO_CONTINUAR:
    "✅ El pedido ha sido procesado correctamente. ¿En qué más puedo ayudarte hoy?",

  SOLICITAR_ZONA:
    '🚚 *Zona de reparto*\n\nSeleccione la zona de reparto para este pedido o escriba una nueva zona.\n\nPuede seleccionar "Continuar sin asignar zona" para finalizar sin especificar una zona.',

  ZONA_ASIGNADA: (zona) => `✅ Zona de reparto asignada: ${zona}`,

  ZONA_NO_ASIGNADA: "⚠️ Este pedido no tiene una zona de reparto asignada.",
};
