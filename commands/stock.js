import { connection } from "../database/connection.js";
import {
  startConversation,
  getConversationState,
  nextStep,
  endConversation,
} from "../handlers/conversationHandler.js";

// Agregar este objeto para mantener el estado de las operaciones en curso
export const operacionesPendientes = {};

export const stock = async (bot, msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Actualizar Stock", callback_data: "ingresar_stock" },
          { text: "Ver Stock de Productos", callback_data: "ver_stock" },
        ],
      ],
    },
  };

  bot.sendMessage(chatId, "Selecciona la opción que deseas realizar:", options);
};

export const ingresarStock = async (bot, msg) => {
  const chatId = msg.message.chat.id;
  const empresa = msg.message.vendedor.codigoEmpresa;

  const query = `SELECT codigo, descripcion, stock FROM Productos WHERE codigoEmpresa = ?`;
  connection.query(query, [empresa], (err, results) => {
    if (err) {
      console.error("Error al obtener el stock:", err);
    } else {
      console.log("Stock obtenido:", results);
      bot.sendMessage(chatId, "Selecciona el producto y la operación:");

      results.forEach((producto) => {
        const inlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: "📥 Ingreso",
                callback_data: `ingresoStock_${producto.codigo}`,
              },
              {
                text: "📤 Salida",
                callback_data: `salidaStock_${producto.codigo}`,
              },
            ],
          ],
        };

        bot.sendMessage(
          chatId,
          `${producto.codigo} - ${producto.descripcion}\nStock actual: ${producto.stock}`,
          { reply_markup: inlineKeyboard }
        );
      });
    }
  });
};

export const listarStock = (bot, callback) => {
  const empresa = callback.message.vendedor.codigoEmpresa;
  const query = `SELECT codigo, descripcion, stock FROM Productos WHERE codigoEmpresa = ?`;
  const chatId = callback.message.chat.id;
  connection.query(query, [empresa], (err, results) => {
    if (err) {
      console.error("Error al obtener el stock:", err);
      // callback([]);
    } else {
      if (results.length === 0) {
        bot.sendMessage(chatId, "No hay productos en stock.");
      } else {
        results.forEach((producto) => {
          bot.sendMessage(chatId, `${producto.descripcion}: ${producto.stock}`);
        });
      }
    }
  });
};

export const salidaStock = (bot, callback) => {
  const chatId = callback.message.chat.id;
  const productoId = callback.data.split("_")[1];
  const tipo = callback.data.split("_")[0];

  bot.sendMessage(
    chatId,
    `Ingrese la cantidad a restar al stock del producto ${productoId}:`
  );
};

export const ingresoStock = (bot, callback) => {
  const chatId = callback.message.chat.id;
  const productoId = callback.data.split("_")[1];

  bot.sendMessage(
    chatId,
    `Ingrese la cantidad a sumar al stock del producto ${productoId}:`
  );
};

// Manejador para los callbacks de los botones
export const handleStockCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const [operacion, codigo] = callbackQuery.data.split("_");
  console.log("operacion", operacion);
  console.log("codigo", codigo);
  // Guardar la operación pendiente
  operacionesPendientes[chatId] = { operacion, codigo };

  // Preguntar la cantidad
  bot.sendMessage(
    chatId,
    `Por favor, ingresa la cantidad a ${
      operacion === "ingresoStock" ? "ingresar" : "retirar"
    }:`
  );
};

// Manejador para procesar la cantidad ingresada
export const procesarCantidadStock = async (bot, msg) => {
  const chatId = msg.chat.id;
  const cantidad = parseInt(msg.text);

  if (!operacionesPendientes[chatId]) {
    return bot.sendMessage(chatId, "❌ No hay una operación pendiente.");
  }

  if (isNaN(cantidad) || cantidad <= 0) {
    return bot.sendMessage(
      chatId,
      "❌ Por favor, ingresa un número válido mayor a 0."
    );
  }

  const { operacion, codigo } = operacionesPendientes[chatId];
  const signo = operacion === "ingresoStock" ? "+" : "-";

  const query = `
    UPDATE Productos 
    SET stock = stock ${signo} ? 
    WHERE codigo = ? AND codigoEmpresa = ?
    AND (${signo === "-" ? "stock >= ?" : "1=1"})
  `;

  const params =
    signo === "-"
      ? [cantidad, codigo, msg.vendedor.codigoEmpresa, cantidad]
      : [cantidad, codigo, msg.vendedor.codigoEmpresa];

  connection.query(query, params, (err, result) => {
    if (err) {
      console.error("Error al actualizar stock:", err);
      bot.sendMessage(chatId, "❌ Error al actualizar el stock.");
    } else if (result.affectedRows === 0) {
      bot.sendMessage(
        chatId,
        "❌ No hay suficiente stock para realizar la salida."
      );
    } else {
      // Consultar el stock actual
      connection.query(
        "SELECT stock FROM Productos WHERE codigo = ? AND codigoEmpresa = ?",
        [codigo, msg.vendedor.codigoEmpresa],
        (err, results) => {
          if (!err && results.length > 0) {
            bot.sendMessage(
              chatId,
              `✅ Stock actualizado exitosamente.\n${
                operacion === "ingresoStock" ? "Ingreso" : "Salida"
              } de ${cantidad} unidades.\nStock actual: ${results[0].stock}`
            );
          } else {
            bot.sendMessage(
              chatId,
              `✅ Stock actualizado exitosamente.\n${
                operacion === "ingresoStock" ? "Ingreso" : "Salida"
              } de ${cantidad} unidades.`
            );
          }
        }
      );
    }

    // Limpiar la operación pendiente
    delete operacionesPendientes[chatId];
  });
};
