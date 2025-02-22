export const KEYBOARD_BUTTONS = {
  CARGAR_PEDIDO: "📝 Cargar Pedido",
  VER_PEDIDOS: "📋 Ver Pedidos",
  COBROS: "💰 Cobros",
  NUEVO_CLIENTE: "🆕 Nuevo Cliente",
  RESUMEN: "📊 Resumen",
  STOCK: "📦 Stock",
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
  STOCK: "/stock",
};

export const KEYBOARD_LAYOUT = {
  keyboard: [
    [KEYBOARD_BUTTONS.CARGAR_PEDIDO, KEYBOARD_BUTTONS.VER_PEDIDOS],
    [KEYBOARD_BUTTONS.NUEVO_CLIENTE, KEYBOARD_BUTTONS.RESUMEN],
    [KEYBOARD_BUTTONS.COBROS, KEYBOARD_BUTTONS.STOCK],
    [KEYBOARD_BUTTONS.CANCELAR],
  ],
  resize_keyboard: true,
};

export const getMainMenuMessage = (empresa, vendedor) => `
🏢 *${empresa.razonSocial}* 
🏪 *Sistema de Gestión de Pedidos* 
👤 ${vendedor.nombre} ${vendedor.apellido}
`;
