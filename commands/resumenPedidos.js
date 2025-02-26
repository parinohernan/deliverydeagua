import { connection } from "../database/connection.js";
import {
  startConversation,
  getConversationState,
  nextStep,
  endConversation,
} from "../handlers/conversationHandler.js";

const formatoFecha = (fecha) => {
  return fecha.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const resumenPedidos = async (bot, msg) => {
  const chatId = msg.chat.id;
  const empresa = msg.vendedor.codigoEmpresa;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📊 Pedidos Hoy", callback_data: "resumen_pedidosHoy" },
          { text: "✅ Entregados Hoy", callback_data: "resumen_entregadosHoy" },
        ],
        [
          { text: "📊 Pedidos Semana", callback_data: "resumen_pedidosSemana" },
          {
            text: "✅ Entregados Semana",
            callback_data: "resumen_entregadosSemana",
          },
        ],
        [
          { text: "📊 Pedidos Mes", callback_data: "resumen_pedidosMes" },
          { text: "✅ Entregados Mes", callback_data: "resumen_entregadosMes" },
        ],
        [
          {
            text: "📅 Resumen Entre Fechas",
            callback_data: "resumen_entreFechas",
          },
        ],
      ],
    },
  };

  bot.sendMessage(
    chatId,
    "Selecciona el tipo de resumen que deseas ver:",
    options
  );
};

const obtenerResumen = async (
  connection,
  filtroFecha,
  empresa,
  soloEntregados = false
) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        p.descripcion,
        SUM(pi.cantidad) as cantidadTotal,
        SUM(pi.precioTotal) as importeTotal,
        COUNT(DISTINCT ped.codigo) as cantidadPedidos
      FROM PedidosItems pi
      JOIN Pedidos ped ON pi.codigoPedido = ped.codigo
      JOIN Productos p ON pi.codigoProducto = p.codigo
      WHERE ped.codigoEmpresa = ?
      ${soloEntregados ? "AND ped.FechaEntrega IS NOT NULL" : ""}
      ${filtroFecha}
      GROUP BY p.codigo, p.descripcion
      ORDER BY cantidadTotal DESC
    `;
    // console.log("query:", query);
    connection.query(query, [empresa], (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      if (results.length === 0) {
        resolve({ items: [], total: 0, cantidadPedidos: 0 });
        return;
      }

      const total = results.reduce(
        (sum, item) => sum + Number(item.importeTotal),
        0
      );
      const cantidadPedidos = results[0].cantidadPedidos;

      resolve({ items: results, total, cantidadPedidos });
    });
  });
};

export const handleResumenCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const [_, tipo] = callbackQuery.data.split("_");
  const empresa = callbackQuery.message.vendedor.codigoEmpresa;

  // Si es resumen entre fechas, iniciamos el diálogo
  if (tipo === "entreFechas") {
    startConversation(chatId, "resumenEntreFechas");
    const state = getConversationState(chatId);
    state.data = {
      empresa: empresa,
      soloEntregados: false,
    };

    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📊 Todos los Pedidos",
              callback_data: "tipoResumen_todos",
            },
            {
              text: "✅ Solo Entregados",
              callback_data: "tipoResumen_entregados",
            },
          ],
        ],
      },
    };

    bot.sendMessage(chatId, "¿Qué tipo de pedidos quieres ver?", options);
    return;
  }

  let filtroFecha = "";
  let titulo = "";

  switch (tipo) {
    case "pedidosHoy":
      filtroFecha = "AND DATE(ped.FechaPedido) = CURDATE()";
      titulo = "Pedidos de Hoy";
      break;
    case "entregadosHoy":
      filtroFecha = "AND DATE(ped.FechaEntrega) = CURDATE()";
      titulo = "Entregados Hoy";
      break;
    case "pedidosSemana":
      const hoy = new Date();
      const primerDiaSemana = new Date(hoy);
      primerDiaSemana.setDate(hoy.getDate() - hoy.getDay() + 1);

      const ultimoDiaSemana = new Date(hoy);
      ultimoDiaSemana.setDate(hoy.getDate() + (7 - hoy.getDay()));

      filtroFecha = `AND ped.FechaPedido BETWEEN DATE_SUB(CURDATE(), INTERVAL DAYOFWEEK(CURDATE()) - 1 DAY) 
        AND DATE_ADD(CURDATE(), INTERVAL 7 - DAYOFWEEK(CURDATE()) DAY)`;
      titulo = `Pedidos de esta Semana (${formatoFecha(
        primerDiaSemana
      )} al ${formatoFecha(ultimoDiaSemana)})`;
      break;
    case "entregadosSemana":
      const hoyEntrega = new Date();
      const primerDiaSemanaEntrega = new Date(hoyEntrega);
      primerDiaSemanaEntrega.setDate(
        hoyEntrega.getDate() - hoyEntrega.getDay() + 1
      );

      const ultimoDiaSemanaEntrega = new Date(hoyEntrega);
      ultimoDiaSemanaEntrega.setDate(
        hoyEntrega.getDate() + (7 - hoyEntrega.getDay())
      );

      filtroFecha = `AND ped.FechaEntrega BETWEEN DATE_SUB(CURDATE(), INTERVAL DAYOFWEEK(CURDATE()) - 1 DAY) 
        AND DATE_ADD(CURDATE(), INTERVAL 7 - DAYOFWEEK(CURDATE()) DAY)`;
      titulo = `Entregados de esta Semana (${formatoFecha(
        primerDiaSemanaEntrega
      )} al ${formatoFecha(ultimoDiaSemanaEntrega)})`;
      break;
    case "pedidosMes":
      filtroFecha =
        "AND YEAR(ped.FechaPedido) = YEAR(CURDATE()) AND MONTH(ped.FechaPedido) = MONTH(CURDATE())";
      titulo = "Pedidos de este Mes";
      break;
    case "entregadosMes":
      filtroFecha =
        "AND YEAR(ped.FechaEntrega) = YEAR(CURDATE()) AND MONTH(ped.FechaEntrega) = MONTH(CURDATE())";
      titulo = "Entregados este Mes";
      break;
  }

  try {
    const soloEntregados = tipo.startsWith("entregados");
    const resumen = await obtenerResumen(
      connection,
      filtroFecha,
      empresa,
      soloEntregados
    );
    if (resumen.items.length === 0) {
      bot.sendMessage(
        chatId,
        `No hay datos para mostrar en ${titulo.toLowerCase()}`
      );
      return;
    }

    const mensaje = resumen.items
      .map(
        (item) =>
          `📦 ${item.descripcion}
   Cantidad: ${item.cantidadTotal}
   Total: $${item.importeTotal}`
      )
      .join("\n\n");

    const mensajeCompleto = `📊 ${titulo}
Cantidad de Pedidos: ${resumen.cantidadPedidos}

${mensaje}

💰 Total General: $${resumen.total}`;

    bot.sendMessage(chatId, mensajeCompleto);
  } catch (error) {
    bot.sendMessage(chatId, `Error al obtener el resumen: ${error.message}`);
  }
};

export const handleResumenEntreFechasResponse = (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);

  if (!state || state.command !== "resumenEntreFechas") return false;

  const text = msg.text;

  // Si es un callback query
  if (msg.data) {
    const [action, value] = msg.data.split("_");
    if (action === "tipoResumen") {
      state.data.soloEntregados = value === "entregados";
      nextStep(chatId);
      bot.sendMessage(
        chatId,
        "Ingresa la fecha de inicio (formato: DD/MM/YYYY):"
      );
      return true;
    }
  }

  switch (state.step) {
    case 1: // Fecha inicio
      const fechaInicio = convertirFecha(text);
      if (!fechaInicio) {
        bot.sendMessage(
          chatId,
          "Formato de fecha inválido. Usa DD/MM/YYYY (ejemplo: 01/12/2023):"
        );
        return true;
      }
      state.data.fechaInicio = fechaInicio;
      nextStep(chatId);
      bot.sendMessage(chatId, "Ingresa la fecha final (formato: DD/MM/YYYY):");
      break;

    case 2: // Fecha fin
      const fechaFin = convertirFecha(text);
      if (!fechaFin) {
        bot.sendMessage(
          chatId,
          "Formato de fecha inválido. Usa DD/MM/YYYY (ejemplo: 01/12/2023):"
        );
        return true;
      }

      const filtroFecha = `
        AND DATE(ped.${
          state.data.soloEntregados ? "FechaEntrega" : "FechaPedido"
        }) 
        BETWEEN '${state.data.fechaInicio}' AND '${fechaFin}'
      `;

      obtenerResumen(
        connection,
        filtroFecha,
        state.data.empresa,
        state.data.soloEntregados
      )
        .then((resumen) => {
          if (resumen.items.length === 0) {
            bot.sendMessage(
              chatId,
              "No hay datos para mostrar en el período seleccionado"
            );
          } else {
            const mensaje = resumen.items
              .map(
                (item) =>
                  `📦 ${item.descripcion}
   Cantidad: ${item.cantidadTotal}
   Total: $${item.precioTotal}`
              )
              .join("\n\n");
            const titulo = state.data.soloEntregados
              ? "Pedidos Entregados"
              : "Todos los Pedidos";

            const mensajeCompleto = `📊 ${titulo}
Período: ${text} al ${text}
Cantidad de Pedidos: ${resumen.cantidadPedidos}

${mensaje}

💰 Total General: $${resumen.total}`;

            bot.sendMessage(chatId, mensajeCompleto);
          }
          endConversation(chatId);
        })
        .catch((error) => {
          bot.sendMessage(
            chatId,
            `Error al obtener el resumen: ${error.message}`
          );
          endConversation(chatId);
        });
      break;
  }

  return true;
};

const convertirFecha = (texto) => {
  const partes = texto.split("/");
  if (partes.length !== 3) return null;

  const fecha = new Date(partes[2], partes[1] - 1, partes[0]);
  if (isNaN(fecha.getTime())) return null;

  return fecha.toISOString().split("T")[0];
};
