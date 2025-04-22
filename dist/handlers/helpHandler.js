const HELP_MESSAGES = {
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
  // ... resto de los mensajes de ayuda ...
};

export const handleHelp = (bot, chatId, comando) => {
  const ayuda = HELP_MESSAGES[comando];
  if (!ayuda) return false;

  bot.sendMessage(chatId, `*${ayuda.titulo}*\n\n${ayuda.contenido}`, {
    parse_mode: "Markdown",
  });
  return true;
};
