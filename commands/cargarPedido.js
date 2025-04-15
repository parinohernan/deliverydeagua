import { connection } from "../database/connection.js";
import {
  startConversation,
  getConversationState,
  nextStep,
  endConversation,
} from "../handlers/conversationHandler.js";

export const cargarPedido = async (bot, msg) => {
  const chatId = msg.chat.id;

  try {
    startConversation(chatId, "cargarPedido");
    const state = getConversationState(chatId);
    state.data = {
      items: [],
      total: 0,
      codigoVendedor: msg.vendedor.codigo,
      codigoEmpresa: msg.vendedor.codigoEmpresa,
    };
    bot.sendMessage(
      chatId,
      `Escribe parte del nombre para buscar el cliente.
Para cancelar el pedido en cualquier momento, escribe /cancelar`
    );
  } catch (error) {
    bot.sendMessage(chatId, `Error: ${error.message}`);
  }
};

const mostrarProductos = async (bot, chatId, codigoEmpresa, cliente) => {
  const query = `
    SELECT codigo, descripcion, precio 
    FROM productos 
    WHERE codigoEmpresa = ? 
    AND activo = 1
    ORDER BY descripcion
  `;

  connection.query(query, [codigoEmpresa], (err, results) => {
    if (err) {
      bot.sendMessage(chatId, `Error al obtener productos: ${err.message}`);
      return;
    }

    // Crear botones para cada producto, 2 por fila
    const botonesProductos = results.reduce((filas, producto, index) => {
      const boton = {
        text: `${producto.descripcion} ($${producto.precio})`,
        callback_data: `selectProducto_${producto.codigo}`,
      };

      if (index % 2 === 0) {
        filas.push([boton]);
      } else {
        filas[filas.length - 1].push(boton);
      }
      return filas;
    }, []);

    // Agregar botón de terminar al final
    botonesProductos.push([
      {
        text: "🏁 Terminar Pedido",
        callback_data: "pedido_terminar",
      },
    ]);

    const options = {
      reply_markup: {
        inline_keyboard: botonesProductos,
      },
    };

    bot.sendMessage(
      chatId,
      `🛍️ Pedido de *${cliente.nombre} ${cliente.apellido}*\n\nSelecciona un producto de la lista:`,
      { ...options, parse_mode: "Markdown" }
    );
  });
};

const agregarProducto = (state, producto, cantidad) => {
  state.data.items.push({
    codigo: producto.codigo,
    descripcion: producto.descripcion,
    precio: producto.precio,
    cantidad: cantidad,
    subtotal: producto.precio * cantidad,
  });
  state.data.total += producto.precio * cantidad;
};

const mostrarResumen = (bot, chatId, state) => {
  const resumen = state.data.items
    .map(
      (item) =>
        `📦 ${item.descripcion}\n   ${item.cantidad} x $${item.precio} = $${item.precioTotal}`
    )
    .join("\n");

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "➕ Agregar Producto",
            callback_data: "pedido_agregarMas",
          },
          {
            text: "✅ Finalizar Pedido",
            callback_data: "pedido_finalizar",
          },
        ],
      ],
    },
  };

  bot.sendMessage(
    chatId,
    `Resumen del pedido:\n\n${resumen}\n\n💰 Total: $${state.data.total}\n\n¿Qué deseas hacer?`,
    options
  );
};

export const handleCargarPedidoResponse = (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);
  const text = msg.text;

  if (!state || state.command !== "cargarPedido") return false;

  // Verificar si el usuario quiere cancelar
  if (text?.toLowerCase() === "/cancelar") {
    bot.sendMessage(chatId, "❌ Pedido cancelado");
    endConversation(chatId);
    return true;
  }
  switch (state.step) {
    case 0: // Código o búsqueda de cliente
      // Si es un número, asumimos que es un código
      if (/^\d+$/.test(text)) {
        connection.query(
          "SELECT codigo, nombre, apellido FROM clientes WHERE codigo = ? AND codigoEmpresa = ?",
          [text, state.data.codigoEmpresa],
          (err, results) => {
            if (err || results.length === 0) {
              bot.sendMessage(
                chatId,
                "Cliente no encontrado. Ingresa otro código o busca por nombre:"
              );
              return;
            }
            state.data.cliente = results[0];
            nextStep(chatId);
            mostrarProductos(
              bot,
              chatId,
              state.data.codigoEmpresa,
              state.data.cliente
            );
          }
        );
      } else {
        // Búsqueda por nombre/apellido
        connection.query(
          "SELECT codigo, nombre, apellido FROM clientes WHERE (nombre LIKE ? OR apellido LIKE ?) AND codigoEmpresa = ? LIMIT 5",
          [`%${text}%`, `%${text}%`, state.data.codigoEmpresa],
          (err, results) => {
            if (err) {
              bot.sendMessage(chatId, `Error en la búsqueda: ${err.message}`);
              return;
            }

            if (results.length === 0) {
              bot.sendMessage(
                chatId,
                "No se encontraron clientes. Intenta con otro nombre o código:"
              );
              return;
            }

            const options = {
              reply_markup: {
                inline_keyboard: results.map((cliente) => [
                  {
                    text: `${cliente.codigo} - ${cliente.nombre} ${cliente.apellido}`,
                    callback_data: `selectCliente_${cliente.codigo}`,
                  },
                ]),
              },
            };

            bot.sendMessage(chatId, "Selecciona un cliente:", options);
          }
        );
      }
      break;

    case 2: // Cantidad
      if (text === "📝 Otra cantidad") {
        bot.sendMessage(chatId, "Por favor, ingresa la cantidad manualmente:", {
          reply_markup: {
            keyboard: [["❌ Cancelar"]],
            resize_keyboard: true,
          },
        });
        return true;
      }

      const cantidad = parseInt(text);
      if (isNaN(cantidad) || cantidad <= 0) {
        bot.sendMessage(
          chatId,
          "Por favor, ingresa un número válido mayor a 0:"
        );
        return true;
      }

      const precioTotal = state.data.productoTemp.precio * cantidad;
      state.data.items.push({
        codigo: state.data.productoTemp.codigo,
        descripcion: state.data.productoTemp.descripcion,
        precio: state.data.productoTemp.precio,
        cantidad: cantidad,
        precioTotal: precioTotal,
        descuento: 0,
      });
      state.data.total += precioTotal;

      nextStep(chatId);
      mostrarResumen(bot, chatId, state);
      break;
  }

  return true;
};

export const handlePedidoCallback = async (bot, callbackQuery) => {
  const [action, data] = callbackQuery.data.split("_");
  console.log(action, data);
  
  const chatId = callbackQuery.message.chat.id;
  const state = getConversationState(chatId);

  if (!state || state.command !== "cargarPedido") return;

  if (action === "pedido" && data === "terminar") {
    // Eliminar el mensaje de selección de productos
    bot.deleteMessage(chatId, callbackQuery.message.message_id);

    // Restaurar teclado normal
    const options = {
      reply_markup: {
        keyboard: [
          ["📝 Cargar Pedido", "📋 Ver Pedidos"],
          ["🆕 Nuevo Cliente", "📊 Resumen"],
          ["📊 Cobros", "❌ Cancelar"],
        ],
        resize_keyboard: true,
      },
    };

    if (state.data.items && state.data.items.length > 0) {
      // Si hay items, finalizar el pedido
      bot.sendMessage(chatId, "Finalizando pedido...", options);
      // Reutilizar la lógica de finalizar
      handlePedidoCallback(bot, {
        ...callbackQuery,
        data: "pedido_finalizar",
      });
    } else {
      // Si no hay items, cancelar el pedido
      bot.sendMessage(
        chatId,
        "❌ Pedido cancelado - No se agregaron productos",
        options
      );
      endConversation(chatId);
    }
    return;
  }

  if (action === "selectProducto") {
    connection.query(
      "SELECT codigo, descripcion, precio FROM productos WHERE codigo = ? AND codigoEmpresa = ?",
      [data, state.data.codigoEmpresa],
      (err, results) => {
        if (err || results.length === 0) {
          bot.sendMessage(
            chatId,
            "Producto no encontrado. Selecciona otro producto:"
          );
          return;
        }

        state.data.productoTemp = results[0];
        nextStep(chatId);

        // Eliminar el mensaje de selección de productos
        bot.deleteMessage(chatId, callbackQuery.message.message_id);

        // Teclado numérico simplificado
        const options = {
          reply_markup: {
            keyboard: [
              ["1", "2", "3", "4"],
              ["📝 Otra cantidad"],
              ["❌ Cancelar"],
            ],
            resize_keyboard: true,
          },
        };

        bot.sendMessage(
          chatId,
          `Seleccionaste: ${results[0].descripcion}\nPrecio: $${results[0].precio}\n\nIngresa la cantidad o selecciona "Otra cantidad" para ingresar manualmente:`,
          options
        );
      }
    );
  } else if (action === "selectCliente") {
    connection.query(
      "SELECT codigo, nombre, apellido FROM clientes WHERE codigo = ? AND codigoEmpresa = ?",
      [data, state.data.codigoEmpresa],
      (err, results) => {
        if (err || results.length === 0) {
          bot.sendMessage(
            chatId,
            "Error al seleccionar cliente. Intenta nuevamente:"
          );
          return;
        }

        state.data.cliente = results[0];
        nextStep(chatId);

        // Eliminar el mensaje de selección
        bot.deleteMessage(chatId, callbackQuery.message.message_id);

        mostrarProductos(
          bot,
          chatId,
          state.data.codigoEmpresa,
          state.data.cliente
        );
      }
    );
  } else if (action === "pedido") {
    // Eliminar el mensaje del resumen
    bot.deleteMessage(chatId, callbackQuery.message.message_id);

    if (data === "agregarMas") {
      state.step = 1;
      mostrarProductos(
        bot,
        chatId,
        state.data.codigoEmpresa,
        state.data.cliente
      );
    } else if (data === "finalizar") {
      // Restaurar teclado normal antes de finalizar
      const options = {
        reply_markup: {
          keyboard: [
            ["📝 Cargar Pedido", "📋 Ver Pedidos"],
            ["🆕 Nuevo Cliente", "📊 Resumen"],
            ["📊 Cobros", "❌ Cancelar"],
          ],
          resize_keyboard: true,
        },
      };

      // Guardar pedido en la base de datos
      const pedidoQuery = `
        INSERT INTO pedidos (
          codigoEmpresa,
          codigoCliente,
          codigoVendedorPedido,
          saldo,
          total,
          tipoPago,
          FechaPedido
        ) VALUES (?, ?, ?, 0, ?, ?, NOW())
      `;

      connection.query(
        pedidoQuery,
        [
          state.data.codigoEmpresa,
          state.data.cliente.codigo,
          state.data.codigoVendedor,
          state.data.total,
          null,
        ],
        (err, result) => {
          if (err) {
            bot.sendMessage(
              chatId,
              `Error al guardar pedido: ${err.message}`,
              options
            );
            endConversation(chatId);
            return;
          }

          const pedidoId = result.insertId;

          // Guardar items del pedido
          const itemsValues = state.data.items.map((item) => [
            pedidoId,
            item.codigo,
            item.cantidad,
            item.descuento,
            item.precioTotal,
          ]);

          const itemsQuery = `
            INSERT INTO pedidositems (
              codigoPedido,
              codigoProducto,
              cantidad,
              descuento,
              precioTotal
            ) VALUES ?
          `;

          connection.query(itemsQuery, [itemsValues], (err) => {
            if (err) {
              bot.sendMessage(
                chatId,
                `Error al guardar items: ${err.message}`,
                options
              );
            } else {
              bot.sendMessage(
                chatId,
                `✅ Pedido #${pedidoId} guardado exitosamente para ${state.data.cliente.nombre} ${state.data.cliente.apellido}\nTotal: $${state.data.total}`,
                options
              );
            }
            endConversation(chatId);
          });
        }
      );
    }
  }
};

const isUserAuthorized = async (chatId, username) => {
  const query = `
    SELECT * 
    FROM vendedores 
    WHERE telegramId = '${username}' OR telegramId = '${chatId}'
  `;
  // ... código existente ...
};

// Si hay consultas a la tabla pedidos
const queryPedidos = `SELECT * FROM pedidos WHERE ...`; // Cambiar aquí

// Si hay consultas a la tabla productos
const queryProductos = `SELECT * FROM productos WHERE ...`; // Cambiar aquí

// Si hay consultas a la tabla pedidositems
const queryPedidosItems = `SELECT * FROM pedidositems WHERE ...`; // Cambiar aquí

// Si hay consultas a la tabla cobros
const queryCobros = `SELECT * FROM cobros WHERE ...`; // Cambiar aquí
