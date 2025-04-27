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
        [
          {
            text: "Actualizar Precio",
            callback_data: "actualizarprecio_producto",
          },
        ],
      ],
    },
  };

  bot.sendMessage(chatId, "Selecciona la opción que deseas realizar:", options);
};

export const ingresarStock = async (bot, msg) => {
  const chatId = msg.message.chat.id;
  const empresa = msg.message.vendedor.codigoEmpresa;

  const query = `SELECT codigo, descripcion, stock FROM productos WHERE codigoEmpresa = ?`;
  connection.query(query, [empresa], (err, results) => {
    if (err) {
      console.error("Error al obtener el stock:", err);
    } else {
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
  const query = `SELECT codigo, descripcion, stock FROM productos WHERE codigoEmpresa = ?`;
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
export const nuevoPrecio = (bot, callback) => {
  const chatId = callback.message.chat.id;
  const productoId = callback.data.split("_")[1];

  bot.sendMessage(
    chatId,
    `Ingrese el nuevo precio para el producto ${productoId}:`
  );
};

export const actualizarPrecio = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const empresa = callbackQuery.message.vendedor.codigoEmpresa;

  const query = `SELECT codigo, descripcion, precio FROM productos WHERE codigoEmpresa = ?`;
  connection.query(query, [empresa], (err, results) => {
    if (err) {
      console.error("Error al obtener los productos:", err);
      bot.sendMessage(chatId, "Error al obtener los productos.");
    } else {
      if (results.length === 0) {
        bot.sendMessage(
          chatId,
          "No hay productos disponibles para actualizar."
        );
      } else {
        bot.sendMessage(
          chatId,
          "Selecciona el producto para actualizar el precio:"
        );

        results.forEach((producto) => {
          const inlineKeyboard = {
            inline_keyboard: [
              [
                {
                  text: "Actualizar Precio",
                  callback_data: `actualizarPrecioXCodigo_${producto.codigo}`,
                },
              ],
            ],
          };

          bot.sendMessage(
            chatId,
            `${producto.codigo} - ${producto.descripcion}\nPrecio actual: ${producto.precio}`,
            { reply_markup: inlineKeyboard }
          );
        });
      }
    }
  });
};

// Manejador para los callbacks de los botones actualisar stock y precio
export const handleStockCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const [operacion, codigo] = callbackQuery.data.split("_");
  // Guardar la operación pendiente
  operacionesPendientes[chatId] = { operacion, codigo };

  switch (operacion) {
    case "actualizarPrecioXCodigo":
      bot.sendMessage(
        chatId,
        `Por favor, ingresa el nuevo precio para el producto ${codigo}:`
      );
      break;
    case "ingresoStock":
      bot.sendMessage(
        chatId,
        `Por favor, ingresa la cantidad a ingresar al stock del producto ${codigo}:`
      );
      break;
    case "salidaStock":
      bot.sendMessage(
        chatId,
        `Por favor, ingresa la cantidad a retirar del stock del producto ${codigo}:`
      );
      break;
    default:
  }
};

// Manejador para procesar la cantidad ingresada o el nuevo precio
export const procesarEntrada = async (bot, msg) => {
  const chatId = msg.chat.id;
  const entrada = parseFloat(msg.text);
  // console.log("200operacionesPendientes", operacionesPendientes);
  if (!operacionesPendientes[chatId]) {
    return bot.sendMessage(chatId, "❌ No hay una operación pendiente.");
  }

  const { operacion, codigo } = operacionesPendientes[chatId];
  if (operacion === "actualizarPrecioXCodigo") {
    if (isNaN(entrada) || entrada <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ Por favor, ingresa un precio válido mayor a 0."
      );
    }
    // Llamar a la función para procesar el nuevo precio
    procesarNuevoPrecio(bot, msg, entrada, codigo);
  } else {
    const cantidad = parseInt(entrada);
    if (isNaN(cantidad) || cantidad <= 0) {
      return bot.sendMessage(
        chatId,
        "❌ Por favor, ingresa un número válido mayor a 0."
      );
    }
    // Llamar a la función para procesar la cantidad de stock
    let signo = operacion === "ingresoStock" ? "+" : "-";
    procesarCantidadStock(bot, msg, cantidad, codigo, signo);
  }
};

// Modificar procesarNuevoPrecio para aceptar el nuevo precio como argumento
export const procesarNuevoPrecio = async (bot, msg, nuevoPrecio, codigo) => {
  const chatId = msg.chat.id;

  const query = `
    UPDATE productos 
    SET precio = ? 
    WHERE codigo = ? AND codigoEmpresa = ?
  `;

  connection.query(
    query,
    [nuevoPrecio, codigo, msg.vendedor.codigoEmpresa],
    (err, result) => {
      if (err) {
        console.error("Error al actualizar precio:", err);
        bot.sendMessage(chatId, "❌ Error al actualizar el precio.");
      } else {
        bot.sendMessage(
          chatId,
          `✅ Precio actualizado exitosamente a ${nuevoPrecio}.`
        );
      }

      // Limpiar la operación pendiente
      delete operacionesPendientes[chatId];
    }
  );
};

// Manejador para procesar la cantidad ingresada
export const procesarCantidadStock = async (
  bot,
  msg,
  cantidad,
  codigo,
  signo
) => {
  const chatId = msg.chat.id;
  const query = `
    UPDATE productos 
    SET stock = stock ${signo} ?, esRetornable = 0
    WHERE codigo = ? AND codigoEmpresa = ?
    AND (${signo === "-" ? "stock >= ?" : "1=1"})
  `;

  const params =
    signo === "-"
      ? [
          Math.abs(cantidad),
          codigo,
          msg.vendedor.codigoEmpresa,
          Math.abs(cantidad),
        ]
      : [Math.abs(cantidad), codigo, msg.vendedor.codigoEmpresa];
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
        "SELECT stock FROM productos WHERE codigo = ? AND codigoEmpresa = ?",
        [codigo, msg.vendedor.codigoEmpresa],
        (err, results) => {
          if (!err && results.length > 0) {
            bot.sendMessage(
              chatId,
              `✅ Stock actualizado exitosamente.\n${
                signo === "-" ? "Salida" : "Ingreso"
              } de ${Math.abs(cantidad)} unidades.\nStock actual: ${
                results[0].stock
              }`
            );
          } else {
            bot.sendMessage(
              chatId,
              `✅ Stock actualizado exitosamente.\n${
                signo === "-" ? "Salida" : "Ingreso"
              } de ${Math.abs(cantidad)} unidades.`
            );
          }
        }
      );
    }

    // Limpiar la operación pendiente
    delete operacionesPendientes[chatId];
  });
};
