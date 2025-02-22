import { connection } from "../database/connection.js";

export const listarPedidos = async (bot, msg) => {
  const chatId = msg.chat.id;
  const empresa = msg.vendedor.codigoEmpresa;
  const query = `
    SELECT 
      p.codigo,
      p.FechaPedido,
      c.nombre,
      c.apellido,
      c.direccion,
      (SELECT SUM(precioTotal) FROM PedidosItems WHERE codigoPedido = p.codigo) as total
    FROM Pedidos p
    JOIN Clientes c ON p.codigoCliente = c.codigo
    WHERE p.FechaEntrega IS NULL 
    AND p.codigoEmpresa = '${empresa}'
    ORDER BY p.FechaPedido DESC
  `;

  connection.query(query, (err, results) => {
    if (err) {
      bot.sendMessage(chatId, `Error al obtener pedidos: ${err.message}`);
      return;
    }

    if (results.length === 0) {
      bot.sendMessage(chatId, "No hay pedidos pendientes de entrega.");
      return;
    }

    results.forEach((pedido) => {
      const mensaje = `
🔖 Pedido #${pedido.codigo}
📅 Fecha: ${new Date(pedido.FechaPedido).toLocaleString()}
👤 Cliente: ${pedido.nombre} ${pedido.apellido}
📍 Dirección: ${pedido.direccion}
💰 Total: $${pedido.total}
`;

      const options = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Marcar como Entregado",
                callback_data: `entregar_${pedido.codigo}`,
              },
              {
                text: "📋 Ver Detalles",
                callback_data: `detalles_${pedido.codigo}`,
              },
            ],
          ],
        },
      };

      bot.sendMessage(chatId, mensaje, options);
    });
  });
};

const obtenerTiposPago = (empresa) => {
  console.log("2Obteniendo tipos de pago...", empresa);
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        id, 
        pago, 
        CAST(aplicaSaldo AS UNSIGNED) as aplicaSaldo
      FROM tiposDePago
      WHERE codigoEmpresa = '${empresa}'
      ORDER BY id
    `;

    connection.query(query, (err, results) => {
      if (err) {
        console.error("Error en obtenerTiposPago:", err);
        reject(err);
        return;
      }
      console.log("query:", query);
      console.log("Resultados de tipos de pago:", results);
      resolve(results);
    });
  });
};

const mostrarOpcionesPago = async (
  bot,
  chatId,
  pedidoId,
  pedidoMessageId,
  empresa
) => {
  try {
    const tiposPago = await obtenerTiposPago(empresa);
    const options = {
      reply_markup: {
        inline_keyboard: tiposPago.map((tipo) => {
          const callbackData = `pago_${pedidoId}_${tipo.id}_${tipo.aplicaSaldo}`;
          console.log("Generando botón con callback data:", callbackData);
          return [
            {
              text: tipo.pago,
              callback_data: callbackData,
            },
          ];
        }),
      },
    };

    console.log("Opciones generadas:", JSON.stringify(options, null, 2));

    bot.sendMessage(
      chatId,
      `Selecciona el tipo de pago para el pedido #${pedidoId}:`,
      options
    );
  } catch (error) {
    console.error("Error en mostrarOpcionesPago:", error);
    bot.sendMessage(chatId, `Error al obtener tipos de pago: ${error.message}`);
  }
};

const actualizarStockPedidoYSaldo = async (
  pedidoId,
  tipoPagoId,
  aplicaSaldo
) => {
  console.log("Actualizando stock pedido y saldo...");
  return new Promise((resolve, reject) => {
    connection.beginTransaction(async (err) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        // Obtenemos la información del pedido
        const getPedidoInfoQuery = `
          SELECT 
            p.codigoCliente,
            (SELECT SUM(precioTotal) FROM PedidosItems WHERE codigoPedido = p.codigo) as total
          FROM Pedidos p
          WHERE p.codigo = ?
        `;

        const pedidoInfo = await new Promise((resolve, reject) => {
          connection.query(getPedidoInfoQuery, [pedidoId], (err, results) => {
            if (err) reject(err);
            else resolve(results[0]);
          });
        });

        // Actualizamos el pedido
        const updatePedidoQuery = `
          UPDATE Pedidos 
          SET FechaEntrega = NOW(),
              codigoVendedorEntrega = ?,
              tipoPago = ?,
              saldo = ?
          WHERE codigo = ?
        `;

        await new Promise((resolve, reject) => {
          connection.query(
            updatePedidoQuery,
            [1, tipoPagoId, aplicaSaldo === 1 ? pedidoInfo.total : 0, pedidoId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // Obtenemos los productos del pedido
        const getProductosQuery = `
          SELECT codigoProducto, cantidad
          FROM PedidosItems
          WHERE codigoPedido = ?
        `;

        const productos = await new Promise((resolve, reject) => {
          connection.query(getProductosQuery, [pedidoId], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });

        // Actualizamos el stock de cada producto
        const updateStockQuery = `
          UPDATE Productos
          SET stock = stock - ?
          WHERE codigo = ?
        `;

        for (const producto of productos) {
          await new Promise((resolve, reject) => {
            connection.query(
              updateStockQuery,
              [producto.cantidad, producto.codigoProducto],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        // Si aplica saldo, actualizamos el saldo del cliente
        if (aplicaSaldo === 1) {
          console.log("Actualizando saldo del cliente...");
          const updateClienteQuery = `
            UPDATE Clientes 
            SET saldo = saldo + ?
            WHERE codigo = ?
          `;

          await new Promise((resolve, reject) => {
            connection.query(
              updateClienteQuery,
              [pedidoInfo.total, pedidoInfo.codigoCliente],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        connection.commit((err) => {
          if (err) {
            connection.rollback(() => reject(err));
          } else {
            resolve();
          }
        });
      } catch (error) {
        connection.rollback(() => reject(error));
      }
    });
  });
};

export const handlePedidoCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const [action, ...params] = callbackQuery.data.split("_");

  if (action === "entregar") {
    const pedidoId = params[0];
    console.log("Mostrando opciones de pago para pedido:", pedidoId);

    // Validar si el pedido ya está entregado
    const checkQuery = `
      SELECT FechaEntrega 
      FROM Pedidos 
      WHERE codigo = ? AND codigoEmpresa = ?
    `;

    const empresa = callbackQuery.message.vendedor.codigoEmpresa;
    connection.query(checkQuery, [pedidoId, empresa], async (err, results) => {
      if (err) {
        console.error("Error al verificar estado del pedido:", err);
        bot.sendMessage(chatId, "Error al verificar el estado del pedido.");
        return;
      }

      if (results.length === 0 || results[0].FechaEntrega !== null) {
        bot.sendMessage(chatId, "❌ Este pedido ya ha sido entregado.");
        return;
      }

      // Guardamos el messageId del pedido original
      const pedidoMessageId = callbackQuery.message.message_id;
      console.log("Empresa:", empresa);
      mostrarOpcionesPago(bot, chatId, pedidoId, pedidoMessageId, empresa);

      // Respondemos al callback para quitar el "loading" del botón
      await bot.answerCallbackQuery(callbackQuery.id);
    });
  } else if (action === "pago") {
    console.log("Procesando pago:", params);
    const [pedidoId, tipoPagoId, aplicaSaldo] = params;

    if (!pedidoId || !tipoPagoId) {
      console.error("Faltan parámetros:", {
        pedidoId,
        tipoPagoId,
        aplicaSaldo,
      });
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Error: Faltan datos para procesar el pago",
        show_alert: true,
      });
      return;
    }

    try {
      console.log("Iniciando actualización stock de pedido y saldo...");
      await actualizarStockPedidoYSaldo(
        pedidoId,
        tipoPagoId,
        parseInt(aplicaSaldo)
      );
      console.log("Actualización completada");

      // Respondemos al callback
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "✅ Pedido marcado como entregado",
        show_alert: true,
      });

      // Buscamos y actualizamos el mensaje original del pedido
      const query = `
        SELECT 
          p.codigo,
          p.FechaPedido,
          c.nombre,
          c.apellido,
          c.direccion,
          tp.pago as tipoPago,
          (SELECT SUM(precioTotal) FROM PedidosItems WHERE codigoPedido = p.codigo) as total
        FROM Pedidos p
        JOIN Clientes c ON p.codigoCliente = c.codigo
        JOIN tiposDePago tp ON p.tipoPago = tp.id
        WHERE p.codigo = ?
      `;

      connection.query(query, [pedidoId], async (err, results) => {
        if (err || results.length === 0) {
          console.error("Error en query de actualización:", err);
          bot.sendMessage(chatId, "Error al actualizar el mensaje del pedido");
          return;
        }

        const pedido = results[0];
        const mensajeActualizado = `
🔖 Pedido #${pedido.codigo}
📅 Fecha: ${new Date(pedido.FechaPedido).toLocaleString()}
👤 Cliente: ${pedido.nombre} ${pedido.apellido}
📍 Dirección: ${pedido.direccion}
💰 Total: $${pedido.total}
💳 Pago: ${pedido.tipoPago}
✅ Entregado
`;

        try {
          await bot.deleteMessage(chatId, callbackQuery.message.message_id);

          await bot.editMessageText(mensajeActualizado, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id - 1,
            parse_mode: "Markdown",
          });
        } catch (error) {
          console.error("Error al manipular mensajes:", error);
          // Si hay error al editar, enviamos un nuevo mensaje
          bot.sendMessage(chatId, mensajeActualizado, {
            parse_mode: "Markdown",
          });
        }
      });
    } catch (error) {
      console.error("Error en el proceso de pago:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `Error al procesar el pago: ${error.message}`,
        show_alert: true,
      });
    }
  } else if (action === "detalles") {
    const query = `
      SELECT 
        pi.cantidad,
        pi.precioTotal,
        p.descripcion
      FROM PedidosItems pi
      JOIN Productos p ON pi.codigoProducto = p.codigo
      WHERE pi.codigoPedido = ?
    `;

    connection.query(query, [params[0]], (err, results) => {
      if (err) {
        bot.sendMessage(chatId, `Error al obtener detalles: ${err.message}`);
        return;
      }

      const detalles = results
        .map(
          (item) =>
            `📦 ${item.descripcion}\n   ${item.cantidad} x $${(
              item.precioTotal / item.cantidad
            ).toFixed(2)} = $${item.precioTotal}`
        )
        .join("\n");

      bot.sendMessage(
        chatId,
        `Detalles del Pedido #${params[0]}:\n\n${detalles}`
      );
    });
  }
};
