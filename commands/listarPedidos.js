import { connection } from "../database/connection.js";
import { getEmpresa } from "../database/empresaQueries.js";
import {
  obtenerZonasExistentes,
  asignarZonaAPedido,
  guardarNuevaZona,
  crearBotonesZonas,
} from "../utils/zonaUtils.js";
import {
  validarFormatoFechaHora,
  convertirTextoAFecha,
  asignarFechaProgramada,
  generarMensajeAyudaFecha,
} from "../utils/fechaProgramadaUtils.js";

export const listarPedidos = async (bot, msg) => {
  const chatId = msg.chat.id;
  const empresa = msg.vendedor.codigoEmpresa;

  try {
    // Obtener configuración de la empresa
    const empresaConfig = await getEmpresa(empresa);
    const usaEntregaProgramada = empresaConfig?.usaEntregaProgramada === 1;
    const usaRepartoPorZona = empresaConfig?.usaRepartoPorZona === 1;

    console.log("Configuración de empresa:", {
      usaEntregaProgramada,
      usaRepartoPorZona,
    });

    if (usaRepartoPorZona) {
      // Obtener todas las zonas disponibles
      const zonas = await obtenerZonasExistentes(empresa);

      // Añadir opción "Sin Zona Asignada" y "Todos los pedidos"
      const opcionesZonas = [
        { zona: "TODOS", descripcion: "📋 Todos los pedidos" },
        { zona: "SIN_ZONA", descripcion: "🔍 Sin zona asignada" },
        ...zonas.map((z) => ({ zona: z, descripcion: `🚚 ${z}` })),
      ];

      // Crear botones para cada zona
      const botonesZonas = [];
      for (let i = 0; i < opcionesZonas.length; i += 2) {
        const fila = [];
        fila.push({
          text: opcionesZonas[i].descripcion,
          callback_data: `listarPedidosZona_${opcionesZonas[i].zona}`,
        });

        if (i + 1 < opcionesZonas.length) {
          fila.push({
            text: opcionesZonas[i + 1].descripcion,
            callback_data: `listarPedidosZona_${opcionesZonas[i + 1].zona}`,
          });
        }
        botonesZonas.push(fila);
      }

      const options = {
        reply_markup: {
          inline_keyboard: botonesZonas,
        },
      };

      bot.sendMessage(
        chatId,
        "Selecciona una zona para ver los pedidos:",
        options
      );
    } else {
      // Si no usa zonas, mostrar todos los pedidos directamente
      mostrarPedidosFiltrados(
        bot,
        chatId,
        empresa,
        null,
        usaEntregaProgramada,
        usaRepartoPorZona
      );
    }
  } catch (error) {
    console.error("Error al obtener configuración de empresa:", error);
    bot.sendMessage(chatId, `Error: ${error.message}`);
  }
};

// Función para mostrar pedidos filtrados por zona
const mostrarPedidosFiltrados = async (
  bot,
  chatId,
  empresa,
  zona,
  usaEntregaProgramada,
  usaRepartoPorZona
) => {
  try {
    // Construir consulta SQL según configuración y filtro de zona
    let camposAdicionales = "";
    if (usaEntregaProgramada) {
      camposAdicionales += ", p.FechaProgramada";
    }
    if (usaRepartoPorZona) {
      camposAdicionales += ", p.zona";
    }

    let whereZona = "";
    if (zona) {
      if (zona === "SIN_ZONA") {
        whereZona = "AND (p.zona IS NULL OR p.zona = '')";
      } else if (zona !== "TODOS") {
        whereZona = `AND p.zona = '${zona}'`;
      }
    }

    console.log("Filtro de zona:", zona);
    console.log("Consulta whereZona:", whereZona);

    const query = `
      SELECT 
        p.codigo,
        p.FechaPedido,
        p.FechaEntrega,
        p.zona,
        c.nombre,
        c.apellido,
        c.direccion,
        (SELECT SUM(precioTotal) FROM pedidositems WHERE codigoPedido = p.codigo) as total
        ${camposAdicionales}
      FROM pedidos p
      JOIN clientes c ON p.codigocliente = c.codigo
      WHERE p.FechaEntrega IS NULL 
      AND p.codigoEmpresa = '${empresa}'
      AND (p.Estado IS NULL OR p.Estado = 'P')
      ${whereZona}
      ORDER BY p.FechaPedido DESC
      LIMIT 50
    `;

    console.log("Consulta SQL completa:", query);

    connection.query(query, (err, results) => {
      if (err) {
        console.error("Error en consulta SQL:", err);
        bot.sendMessage(chatId, `Error al obtener pedidos: ${err.message}`);
        return;
      }

      console.log(
        `Se encontraron ${results.length} resultados para la zona: ${zona}`
      );

      if (results.length === 0) {
        const mensaje =
          zona && zona !== "TODOS"
            ? `No hay pedidos pendientes ${
                zona === "SIN_ZONA" ? "sin zona asignada" : `en la zona ${zona}`
              }.`
            : "No hay pedidos pendientes de entrega.";
        bot.sendMessage(chatId, mensaje);
        return;
      }

      // Mostrar un mensaje con el total de pedidos
      const tituloZona =
        zona && zona !== "TODOS"
          ? `${
              zona === "SIN_ZONA" ? "sin zona asignada" : `en la zona ${zona}`
            }`
          : "pendientes";
      bot.sendMessage(
        chatId,
        `📋 Se encontraron ${results.length} pedidos ${tituloZona}.`
      );

      results.forEach((pedido) => {
        // Construir el mensaje base con información esencial modificada
        let mensaje = `
👤 Cliente: ${pedido.nombre} ${pedido.apellido}
📍 Dirección: ${pedido.direccion}`;

        // Añadir información de zona si corresponde
        if (usaRepartoPorZona && pedido.zona) {
          mensaje += `\n🚚 Zona: ${pedido.zona}`;
        }

        // Añadir fecha programada si corresponde
        if (usaEntregaProgramada && pedido.FechaProgramada) {
          const fechaProgramada = new Date(pedido.FechaProgramada);
          mensaje += `\n🗓️ Entrega: ${fechaProgramada.toLocaleString()}`;
        }

        // Menú modificado con "Entregado" y "Ver Detalles"
        const options = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Entregado",
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
  } catch (error) {
    console.error("Error al mostrar pedidos filtrados:", error);
    bot.sendMessage(chatId, `Error: ${error.message}`);
  }
};

// Función para mostrar detalles de un pedido con todas las acciones disponibles
const mostrarDetallesPedidoCompleto = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const pedidoId = callbackQuery.data.split("_")[1];
  const empresa = callbackQuery.message.vendedor.codigoEmpresa;

  // Obtener configuración de la empresa
  const empresaConfig = await getEmpresa(empresa);
  const usaEntregaProgramada = empresaConfig?.usaEntregaProgramada === 1;
  const usaRepartoPorZona = empresaConfig?.usaRepartoPorZona === 1;

  try {
    // Obtener información completa del pedido
    const query = `
      SELECT 
        p.codigo,
        p.FechaPedido,
        p.FechaEntrega,
        p.zona,
        p.FechaProgramada,
        c.nombre,
        c.apellido,
        c.direccion,
        (SELECT SUM(precioTotal) FROM pedidositems WHERE codigoPedido = p.codigo) as total
      FROM pedidos p
      JOIN clientes c ON p.codigocliente = c.codigo
      WHERE p.codigo = ? AND p.codigoEmpresa = ?
    `;

    connection.query(query, [pedidoId, empresa], (err, resultsPedido) => {
      if (err || resultsPedido.length === 0) {
        bot.sendMessage(
          chatId,
          `Error al obtener detalles del pedido: ${
            err ? err.message : "No encontrado"
          }`
        );
        return;
      }

      const pedido = resultsPedido[0];

      // Obtener items del pedido
      const queryItems = `
        SELECT 
          pi.cantidad,
          pi.precioTotal,
          p.descripcion
        FROM pedidositems pi
        JOIN productos p ON pi.codigoProducto = p.codigo
        WHERE pi.codigoPedido = ?
      `;

      connection.query(queryItems, [pedidoId], (err, resultsItems) => {
        if (err) {
          bot.sendMessage(
            chatId,
            `Error al obtener detalles de los items: ${err.message}`
          );
          return;
        }

        // Construir mensaje con toda la información
        const detalles = resultsItems
          .map(
            (item) =>
              `📦 ${item.descripcion}\n   ${item.cantidad} x $${(
                item.precioTotal / item.cantidad
              ).toFixed(2)} = $${item.precioTotal}`
          )
          .join("\n");

        let mensaje = `
📋 DETALLES DE PEDIDO #${pedido.codigo}
📅 Fecha: ${new Date(pedido.FechaPedido).toLocaleString()}
👤 Cliente: ${pedido.nombre} ${pedido.apellido}
📍 Dirección: ${pedido.direccion}
💰 Total: $${pedido.total}`;

        // Añadir información de zona si corresponde
        if (usaRepartoPorZona) {
          mensaje += `\n🚚 Zona: ${pedido.zona ? pedido.zona : "Sin asignar"}`;
        }

        // Añadir fecha programada si corresponde
        if (usaEntregaProgramada) {
          mensaje += `\n🗓️ Entrega programada: ${
            pedido.FechaProgramada
              ? new Date(pedido.FechaProgramada).toLocaleString()
              : "No programada"
          }`;
        }

        // Añadir detalles de los productos
        mensaje += `\n\n📝 PRODUCTOS:\n${detalles}`;

        // Crear teclado con todas las acciones disponibles
        const inlineKeyboard = [
          [
            {
              text: "✅ Marcar como Entregado",
              callback_data: `entregar_${pedido.codigo}`,
            },
          ],
          [
            {
              text: "🗓️ Programar Entrega",
              callback_data: `programar_${pedido.codigo}`,
            },
            {
              text: "🚚 Asignar Zona",
              callback_data: `zona_${pedido.codigo}`,
            },
          ],
          [
            {
              text: "❌ Anular Pedido",
              callback_data: `anular_${pedido.codigo}`,
            },
          ],
        ];

        const options = {
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        };

        bot.sendMessage(chatId, mensaje, options);
      });
    });
  } catch (error) {
    console.error("Error al mostrar detalles completos del pedido:", error);
    bot.sendMessage(chatId, `Error: ${error.message}`);
  }
};

const obtenerTiposPago = (empresa) => {
  console.log("2Obteniendo tipos de pago...", empresa);
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        id, 
        pago, 
        CAST(aplicaSaldo AS UNSIGNED) as aplicaSaldo
      FROM tiposdepago
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
    bot.sendMessage(
      chatId,
      `Selecciona el tipo de pago para el pedido #${pedidoId}:`,
      options
    );
  } catch (error) {
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
            p.codigocliente,
            (SELECT SUM(precioTotal) FROM pedidositems WHERE codigoPedido = p.codigo) as total
          FROM pedidos p
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
          UPDATE pedidos 
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
          FROM pedidositems
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
          UPDATE productos
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
          const updateclienteQuery = `
            UPDATE clientes 
            SET saldo = saldo + ?
            WHERE codigo = ?
          `;

          await new Promise((resolve, reject) => {
            connection.query(
              updateclienteQuery,
              [pedidoInfo.total, pedidoInfo.codigocliente],
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

  // Manejar el listado por zonas
  if (action === "listarPedidosZona") {
    const zona = params.join("_"); // Unir todos los parámetros en caso de que la zona tenga guiones bajos
    console.log("Zona seleccionada para filtrar:", zona);
    const empresa = callbackQuery.message.vendedor.codigoEmpresa;

    // Obtener configuración de la empresa
    const empresaConfig = await getEmpresa(empresa);
    const usaEntregaProgramada = empresaConfig?.usaEntregaProgramada === 1;
    const usaRepartoPorZona = empresaConfig?.usaRepartoPorZona === 1;

    // Eliminar el mensaje de selección de zona
    try {
      await bot.deleteMessage(chatId, callbackQuery.message.message_id);
    } catch (error) {
      console.error("Error al eliminar mensaje de selección de zona:", error);
    }

    // Mostrar pedidos filtrados por la zona seleccionada
    mostrarPedidosFiltrados(
      bot,
      chatId,
      empresa,
      zona,
      usaEntregaProgramada,
      usaRepartoPorZona
    );

    // Responder al callback
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (action === "detalles") {
    // Usar la nueva función para mostrar detalles completos con acciones
    await mostrarDetallesPedidoCompleto(bot, callbackQuery);
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (action === "entregar") {
    const pedidoId = params[0];
    console.log("Mostrando opciones de pago para pedido:", pedidoId);

    // Validar si el pedido ya está entregado
    const checkQuery = `
      SELECT FechaEntrega 
      FROM pedidos 
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
      console.log("empresa:", empresa);
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
          (SELECT SUM(precioTotal) FROM pedidositems WHERE codigoPedido = p.codigo) as total
        FROM pedidos p
        JOIN clientes c ON p.codigocliente = c.codigo
        JOIN tiposdepago tp ON p.tipoPago = tp.id
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
👤 cliente: ${pedido.nombre} ${pedido.apellido}
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
  } else if (action === "anular") {
    const pedidoId = params[0];

    // Validar si el pedido ya está entregado o anulado
    const checkQuery = `
      SELECT FechaEntrega, Estado
      FROM pedidos 
      WHERE codigo = ? AND codigoEmpresa = ?
    `;

    const empresa = callbackQuery.message.vendedor.codigoEmpresa;

    connection.query(checkQuery, [pedidoId, empresa], async (err, results) => {
      if (err) {
        console.error("Error al verificar estado del pedido:", err);
        bot.sendMessage(chatId, "Error al verificar el estado del pedido.");
        return;
      }

      if (results.length === 0) {
        bot.sendMessage(chatId, "❌ Este pedido no existe.");
        return;
      }

      if (results[0].FechaEntrega !== null) {
        bot.sendMessage(
          chatId,
          "❌ Este pedido ya ha sido entregado y no puede anularse."
        );
        return;
      }

      if (results[0].Estado === "ANULADO") {
        bot.sendMessage(chatId, "❌ Este pedido ya ha sido anulado.");
        return;
      }

      // Mostrar mensaje de confirmación
      const options = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Sí, anular pedido",
                callback_data: `confirmarAnular_${pedidoId}`,
              },
              {
                text: "❌ No, cancelar",
                callback_data: `cancelarAnular_${pedidoId}`,
              },
            ],
          ],
        },
      };

      bot.sendMessage(
        chatId,
        `¿Estás seguro de que deseas anular el pedido #${pedidoId}? Esta acción no se puede deshacer.`,
        options
      );

      await bot.answerCallbackQuery(callbackQuery.id);
    });
  } else if (action === "confirmarAnular") {
    const pedidoId = params[0];

    // Anular el pedido
    const updateQuery = `
      UPDATE pedidos 
      SET Estado = 'ANULADO'
      WHERE codigo = ?
    `;

    connection.query(updateQuery, [pedidoId], async (err) => {
      if (err) {
        console.error("Error al anular pedido:", err);
        bot.sendMessage(chatId, `Error al anular el pedido: ${err.message}`);
        return;
      }

      // Respondemos al callback
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "✅ Pedido anulado correctamente",
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
          (SELECT SUM(precioTotal) FROM pedidositems WHERE codigoPedido = p.codigo) as total
        FROM pedidos p
        JOIN clientes c ON p.codigocliente = c.codigo
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
👤 cliente: ${pedido.nombre} ${pedido.apellido}
📍 Dirección: ${pedido.direccion}
💰 Total: $${pedido.total}
❌ ANULADO
`;

        try {
          // Eliminar mensaje de confirmación
          await bot.deleteMessage(chatId, callbackQuery.message.message_id);

          // Actualizar mensaje original del pedido
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
    });
  } else if (action === "cancelarAnular") {
    const pedidoId = params[0];

    // Simplemente eliminamos el mensaje de confirmación
    try {
      await bot.deleteMessage(chatId, callbackQuery.message.message_id);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Operación cancelada",
        show_alert: true,
      });
    } catch (error) {
      console.error("Error al cancelar anulación:", error);
    }
  } else if (action === "programar") {
    const pedidoId = params[0];

    // Verificamos si tenemos la información del vendedor
    if (
      !callbackQuery.message.vendedor ||
      !callbackQuery.message.vendedor.codigoEmpresa
    ) {
      console.error(
        "Error: No se encontró información del vendedor en el callback",
        callbackQuery
      );
      bot.sendMessage(
        chatId,
        "Error: No se pudo obtener información de la empresa para programar entrega"
      );
      return;
    }

    const empresa = callbackQuery.message.vendedor.codigoEmpresa;
    console.log(
      "Programando entrega para pedido:",
      pedidoId,
      "empresa:",
      empresa
    );

    // Enviamos mensaje solicitando la fecha programada con el mensaje de ayuda
    bot
      .sendMessage(chatId, generarMensajeAyudaFecha(), {
        reply_markup: {
          force_reply: true,
          selective: true,
        },
        parse_mode: "Markdown",
      })
      .then((sentMsg) => {
        const replyListenerId = bot.onReplyToMessage(
          chatId,
          sentMsg.message_id,
          async (msg) => {
            // Cuando el usuario responda con la fecha
            const fechaProgramadaTexto = msg.text;

            // Si el usuario cancela
            if (fechaProgramadaTexto === "❌ Cancelar") {
              bot.sendMessage(
                chatId,
                "❌ Operación cancelada. No se ha programado ninguna entrega."
              );
              bot.removeReplyListener(replyListenerId);
              return;
            }

            // Validamos el formato y que sea una fecha futura
            const fechaProgramada =
              validarFormatoFechaHora(fechaProgramadaTexto);
            if (!fechaProgramada) {
              bot.sendMessage(
                chatId,
                "⚠️ Formato de fecha incorrecto o fecha en el pasado. Por favor usa DD/MM/YYYY HH:MM y asegúrate que la fecha sea futura."
              );
              bot.removeReplyListener(replyListenerId);
              return;
            }

            try {
              // Asignamos la fecha programada al pedido
              await asignarFechaProgramada(
                bot,
                chatId,
                pedidoId,
                fechaProgramada,
                empresa
              );
              bot.removeReplyListener(replyListenerId);
            } catch (error) {
              console.error("Error al programar entrega:", error);
              bot.sendMessage(chatId, `Error: ${error.message}`);
              bot.removeReplyListener(replyListenerId);
            }
          }
        );
      });

    try {
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error("Error al responder al callback:", error);
    }
  } else if (action === "zona") {
    const pedidoId = params[0];

    // Primero verificamos si tenemos acceso a la información del vendedor
    if (
      !callbackQuery.message.vendedor ||
      !callbackQuery.message.vendedor.codigoEmpresa
    ) {
      console.error(
        "Error: No se encontró información del vendedor en el callback",
        callbackQuery
      );
      bot.sendMessage(
        chatId,
        "Error: No se pudo obtener información de la empresa para asignar zona"
      );
      return;
    }

    const empresa = callbackQuery.message.vendedor.codigoEmpresa;
    console.log("Asignando zona para pedido:", pedidoId, "empresa:", empresa);

    try {
      // Utilizamos la nueva función para obtener las zonas
      const zonas = await obtenerZonasExistentes(empresa);

      // Si hay zonas, mostramos botones para cada una
      if (zonas && zonas.length > 0) {
        console.log("Zonas encontradas:", zonas);

        // Utilizamos la nueva función para crear los botones
        const keyboard = crearBotonesZonas(zonas, pedidoId);

        const options = {
          reply_markup: {
            inline_keyboard: keyboard,
          },
        };

        bot.sendMessage(
          chatId,
          `Selecciona la zona para el pedido #${pedidoId}:`,
          options
        );
      } else {
        // Si no hay zonas, mostramos opciones para crear nueva o continuar sin asignar
        console.log("No se encontraron zonas para empresa:", empresa);
        const options = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "➕ Crear nueva zona",
                  callback_data: `nuevaZona_${pedidoId}`,
                },
              ],
              [
                {
                  text: "⏭️ Continuar sin asignar zona",
                  callback_data: `sinZona_${pedidoId}`,
                },
              ],
            ],
          },
        };

        bot.sendMessage(
          chatId,
          `No hay zonas disponibles para el pedido #${pedidoId}. ¿Qué deseas hacer?`,
          options
        );
      }

      try {
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch (error) {
        console.error("Error al responder al callback:", error);
      }
    } catch (error) {
      console.error("Error al obtener zonas:", error);
      bot.sendMessage(
        chatId,
        `Error al obtener zonas disponibles: ${error.message}`
      );
      await bot.answerCallbackQuery(callbackQuery.id);
    }
  } else if (action === "asignarZona") {
    const [pedidoId, zona] = params;

    // Verificamos si tenemos la información del vendedor
    if (
      !callbackQuery.message.vendedor ||
      !callbackQuery.message.vendedor.codigoEmpresa
    ) {
      console.error(
        "Error: No se encontró información del vendedor en el callback",
        callbackQuery
      );
      bot.sendMessage(
        chatId,
        "Error: No se pudo obtener información de la empresa para asignar zona"
      );
      return;
    }

    const empresa = callbackQuery.message.vendedor.codigoEmpresa;
    console.log(
      "Asignando zona específica:",
      zona,
      "al pedido:",
      pedidoId,
      "empresa:",
      empresa
    );

    try {
      // Utilizamos la nueva función para asignar la zona
      await asignarZonaAPedido(bot, chatId, pedidoId, zona, empresa);

      // Eliminamos el mensaje de selección de zona
      try {
        await bot.deleteMessage(chatId, callbackQuery.message.message_id);
      } catch (deleteError) {
        console.error("Error al eliminar mensaje:", deleteError);
      }

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error("Error al asignar zona:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Error al asignar zona",
        show_alert: true,
      });
    }
  } else if (action === "nuevaZona") {
    const pedidoId = params[0];

    // Verificamos si tenemos la información del vendedor
    if (
      !callbackQuery.message.vendedor ||
      !callbackQuery.message.vendedor.codigoEmpresa
    ) {
      console.error(
        "Error: No se encontró información del vendedor en el callback",
        callbackQuery
      );
      bot.sendMessage(
        chatId,
        "Error: No se pudo obtener información de la empresa para crear zona"
      );
      return;
    }

    const empresa = callbackQuery.message.vendedor.codigoEmpresa;
    console.log(
      "Creando nueva zona para pedido:",
      pedidoId,
      "empresa:",
      empresa
    );

    // Pedimos que ingrese la nueva zona
    bot
      .sendMessage(
        chatId,
        `Por favor, ingresa el nombre de la nueva zona para el pedido #${pedidoId}:`,
        {
          reply_markup: {
            force_reply: true,
            selective: true,
          },
        }
      )
      .then((sentMsg) => {
        const replyListenerId = bot.onReplyToMessage(
          chatId,
          sentMsg.message_id,
          async (msg) => {
            const nuevaZona = msg.text;

            // Si el usuario introduce un texto vacío o cancela
            if (!nuevaZona || nuevaZona.trim() === "") {
              bot.sendMessage(
                chatId,
                "❌ Operación cancelada. No se ha asignado ninguna zona."
              );
              bot.removeReplyListener(replyListenerId);
              return;
            }

            try {
              // Utilizamos la nueva función para guardar la zona
              await guardarNuevaZona(nuevaZona, empresa);

              // Asignamos la zona al pedido
              await asignarZonaAPedido(
                bot,
                chatId,
                pedidoId,
                nuevaZona,
                empresa
              );

              bot.removeReplyListener(replyListenerId);
            } catch (error) {
              console.error("Error al procesar nueva zona:", error);
              bot.sendMessage(chatId, `Error: ${error.message}`);
              bot.removeReplyListener(replyListenerId);
            }
          }
        );
      });

    try {
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error("Error al responder al callback:", error);
    }
  } else if (action === "sinZona") {
    const pedidoId = params[0];

    // Verificamos si tenemos la información del vendedor
    if (
      !callbackQuery.message.vendedor ||
      !callbackQuery.message.vendedor.codigoEmpresa
    ) {
      console.error(
        "Error: No se encontró información del vendedor en el callback",
        callbackQuery
      );
      bot.sendMessage(
        chatId,
        "Error: No se pudo obtener información de la empresa para continuar sin zona"
      );
      return;
    }

    const empresa = callbackQuery.message.vendedor.codigoEmpresa;
    console.log(
      "Continuando sin asignar zona al pedido:",
      pedidoId,
      "empresa:",
      empresa
    );

    // Limpiamos la zona del pedido (establecemos a NULL)
    const updateQuery = `
      UPDATE pedidos 
      SET zona = NULL
      WHERE codigo = ? AND codigoEmpresa = ?
    `;

    connection.query(updateQuery, [pedidoId, empresa], async (err) => {
      if (err) {
        console.error("Error al limpiar zona:", err);
        bot.sendMessage(chatId, `Error al procesar: ${err.message}`);
        return;
      }

      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "✅ Pedido guardado sin zona asignada",
          show_alert: true,
        });

        // Eliminamos el mensaje de selección de zona
        try {
          await bot.deleteMessage(chatId, callbackQuery.message.message_id);
        } catch (error) {
          console.error("Error al eliminar mensaje:", error);
        }
      } catch (error) {
        console.error("Error al responder al callback:", error);
      }
    });
  }
};
