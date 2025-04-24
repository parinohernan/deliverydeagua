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
  try {
    const notificaciones = await obtenerNotificaciones(
      vendedor.codigo,
      empresa.codigo
    );
    notificacionesTexto = formatearNotificaciones(notificaciones);
  } catch (error) {
    console.error("Error al obtener notificaciones:", error);
  }

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
