import { connection } from "../database/connection.js";
import {
  startConversation,
  getConversationState,
  endConversation,
} from "../handlers/conversationHandler.js";

export const consultarCliente = async (bot, msg) => {
  const chatId = msg.chat.id;

  try {
    startConversation(chatId, "consultarCliente");
    bot.sendMessage(
      chatId,
      "Ingresa el nombre o apellido del cliente a buscar:"
    );
  } catch (error) {
    bot.sendMessage(chatId, `Error: ${error.message}`);
  }
};

export const handleConsultarClienteResponse = (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);

  if (!state || state.command !== "consultarCliente") return false;

  const searchTerm = msg.text;
  const query = `
    SELECT codigo, nombre, apellido, direccion, telefono, saldo 
    FROM Clientes 
    WHERE (nombre LIKE ? OR apellido LIKE ?) 
    AND codigoEmpresa = ?  -- Filtrar por la empresa del vendedor
    LIMIT 10
  `;

  const empresa = msg.vendedor.codigoEmpresa; // Obtener el código de la empresa del vendedor

  connection.query(
    query,
    [`%${searchTerm}%`, `%${searchTerm}%`, empresa], // Pasar el código de la empresa como parámetro
    (err, results) => {
      if (err) {
        bot.sendMessage(chatId, `Error en la búsqueda: ${err.message}`);
        endConversation(chatId);
        return;
      }

      if (results.length === 0) {
        bot.sendMessage(chatId, "No se encontraron clientes con ese criterio.");
      } else {
        const clientesList = results
          .map(
            (cliente) =>
              `📋 ID: ${cliente.codigo}
👤 ${cliente.nombre} ${cliente.apellido}
📍 ${cliente.direccion}
📱 ${cliente.telefono}
💰 Saldo: ${cliente.saldo}`
          )
          .join("\n\n");

        bot.sendMessage(chatId, `Clientes encontrados:\n\n${clientesList}`);
      }
      endConversation(chatId);
    }
  );

  return true;
};
