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
      FROM pedidositems pi
      JOIN pedidos ped ON pi.codigoPedido = ped.codigo
      JOIN productos p ON pi.codigoProducto = p.codigo
      WHERE ped.codigoempresa = ?
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
  console.log("handleResumenCallback - tipo:", tipo);
  console.log(
    "handleResumenCallback - callbackQuery.data:",
    callbackQuery.data
  );

  // Si es tipo de informe (resumido o detallado)
  if (callbackQuery.data.startsWith("tipoInforme_")) {
    console.log("Procesando callback de tipo informe");
    const state = getConversationState(chatId);
    console.log("Estado de la conversación:", state);
    if (!state || state.command !== "resumenEntreFechas") return;

    const tipoInforme = tipo; // "resumido" o "detallado"
    state.data.tipoInforme = tipoInforme;

    const filtroFecha = `
      AND DATE(ped.FechaEntrega) 
      BETWEEN '${state.data.fechaInicio}' AND '${state.data.fechaFin}'
    `;

    console.log("Filtro fecha:", filtroFecha);

    try {
      const resumen = await obtenerResumenDetallado(
        connection,
        filtroFecha,
        state.data.empresa,
        state.data.tipoInforme
      );

      if (resumen.items.length === 0) {
        bot.sendMessage(
          chatId,
          "No hay datos para mostrar en el período seleccionado"
        );
      } else {
        let mensaje = "";

        if (resumen.tipoInforme === "resumido") {
          mensaje = resumen.items
            .map(
              (item) =>
                `📦 ${item.descripcion}
Cantidad: ${item.cantidadTotal}
Total: $${item.importeTotal}`
            )
            .join("\n\n");
        } else {
          // Formato detallado por cliente
          mensaje = resumen.items
            .map((producto) => {
              const clientesInfo = producto.clientes
                .map(
                  (cliente) =>
                    `   • ${cliente.nombre}: ${cliente.cantidad} un. ($${cliente.importe})`
                )
                .join("\n");

              return `📦 ${producto.producto}
Cantidad Total: ${producto.cantidadTotal}
Total: $${producto.importeTotal}
Detalle por cliente:
${clientesInfo}`;
            })
            .join("\n\n");
        }

        const mensajeCompleto = `📊 Pedidos Entregados (${
          tipoInforme === "resumido" ? "Resumen" : "Detallado"
        })
Período: ${state.data.fechaInicioFormato} al ${state.data.fechaFinFormato}
Cantidad de Pedidos: ${resumen.cantidadPedidos}

${mensaje}

💰 Total General: $${resumen.total}`;

        bot.sendMessage(chatId, mensajeCompleto);
      }
      endConversation(chatId);
    } catch (error) {
      console.error("Error al obtener resumen:", error);
      bot.sendMessage(chatId, `Error al obtener el resumen: ${error.message}`);
      endConversation(chatId);
    }

    return;
  }

  // Si es una acción relacionada con el calendario
  if (callbackQuery.data.startsWith("calendar_")) {
    await handleCalendarCallback(bot, callbackQuery);
    return;
  }

  // Si es resumen entre fechas, iniciamos el diálogo
  if (tipo === "entreFechas") {
    startConversation(chatId, "resumenEntreFechas");
    const state = getConversationState(chatId);
    state.data = {
      empresa: empresa,
      soloEntregados: true, // Siempre serán entregados según la nueva especificación
    };
    state.step = 1; // Inicializamos el paso en 1

    // Mostramos el calendario para seleccionar la fecha inicial
    const hoy = new Date();
    const mes = hoy.getMonth();
    const anio = hoy.getFullYear();

    mostrarCalendario(bot, chatId, mes, anio, "inicio");

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

const obtenerResumenDetallado = async (
  connection,
  filtroFecha,
  empresa,
  tipoInforme = "resumido"
) => {
  return new Promise((resolve, reject) => {
    // Si es resumido, usamos la consulta actual
    if (tipoInforme === "resumido") {
      const query = `
        SELECT 
          p.descripcion,
          SUM(pi.cantidad) as cantidadTotal,
          SUM(pi.precioTotal) as importeTotal,
          COUNT(DISTINCT ped.codigo) as cantidadPedidos
        FROM pedidositems pi
        JOIN pedidos ped ON pi.codigoPedido = ped.codigo
        JOIN productos p ON pi.codigoProducto = p.codigo
        WHERE ped.codigoEmpresa = ?
        AND ped.FechaEntrega IS NOT NULL
        ${filtroFecha}
        GROUP BY p.codigo, p.descripcion
        ORDER BY cantidadTotal DESC
      `;

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

        resolve({
          items: results,
          total,
          cantidadPedidos,
          tipoInforme: "resumido",
        });
      });
    } else {
      // Consulta detallada por cliente
      const query = `
        SELECT 
          p.descripcion as producto,
          c.nombre, 
          c.apellido,
          SUM(pi.cantidad) as cantidadTotal,
          SUM(pi.precioTotal) as importeTotal,
          COUNT(DISTINCT ped.codigo) as cantidadPedidos
        FROM pedidositems pi
        JOIN pedidos ped ON pi.codigoPedido = ped.codigo
        JOIN productos p ON pi.codigoProducto = p.codigo
        JOIN clientes c ON ped.codigocliente = c.codigo
        WHERE ped.codigoEmpresa = ?
        AND ped.FechaEntrega IS NOT NULL
        ${filtroFecha}
        GROUP BY p.codigo, p.descripcion, c.codigo, c.nombre, c.apellido
        ORDER BY p.descripcion, cantidadTotal DESC
      `;

      connection.query(query, [empresa], (err, results) => {
        if (err) {
          reject(err);
          return;
        }

        if (results.length === 0) {
          resolve({ items: [], total: 0, cantidadPedidos: 0 });
          return;
        }

        // Organizamos los resultados por producto
        const productosPorcliente = {};
        let total = 0;
        let cantidadPedidos = 0;

        results.forEach((item) => {
          total += Number(item.importeTotal);

          if (!productosPorcliente[item.producto]) {
            productosPorcliente[item.producto] = {
              producto: item.producto,
              clientes: [],
              cantidadTotal: 0,
              importeTotal: 0,
            };
          }

          productosPorcliente[item.producto].clientes.push({
            nombre: `${item.nombre} ${item.apellido}`,
            cantidad: item.cantidadTotal,
            importe: item.importeTotal,
          });

          productosPorcliente[item.producto].cantidadTotal += Number(
            item.cantidadTotal
          );
          productosPorcliente[item.producto].importeTotal += Number(
            item.importeTotal
          );

          // Tomamos el valor máximo de cantidadPedidos (ya que es el total)
          if (item.cantidadPedidos > cantidadPedidos) {
            cantidadPedidos = item.cantidadPedidos;
          }
        });

        resolve({
          items: Object.values(productosPorcliente),
          total,
          cantidadPedidos,
          tipoInforme: "detallado",
        });
      });
    }
  });
};

// Función para manejar las interacciones con el calendario
const handleCalendarCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const state = getConversationState(chatId);

  if (!state || state.command !== "resumenEntreFechas") return;

  const parts = callbackQuery.data.split("_");
  const action = parts[1];

  if (action === "month") {
    // Navegación entre meses
    const direction = parts[2]; // prev o next
    const currentMonth = parseInt(parts[3]);
    const currentYear = parseInt(parts[4]);
    const tipoFecha = parts[5]; // inicio o fin

    let newMonth = currentMonth;
    let newYear = currentYear;

    if (direction === "prev") {
      newMonth--;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      }
    } else if (direction === "next") {
      newMonth++;
      if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
    }

    await bot.deleteMessage(chatId, messageId);
    mostrarCalendario(bot, chatId, newMonth, newYear, tipoFecha);
  } else if (action === "day") {
    // Selección de un día específico
    const day = parseInt(parts[2]);
    const month = parseInt(parts[3]);
    const year = parseInt(parts[4]);
    const tipoFecha = parts[5]; // inicio o fin

    const fechaSeleccionada = new Date(year, month, day);
    const fechaFormateada = `${day.toString().padStart(2, "0")}/${(month + 1)
      .toString()
      .padStart(2, "0")}/${year}`;

    if (tipoFecha === "inicio") {
      state.data.fechaInicio = fechaSeleccionada.toISOString().split("T")[0];
      state.data.fechaInicioFormato = fechaFormateada;

      await bot.deleteMessage(chatId, messageId);
      bot.sendMessage(
        chatId,
        `Fecha de inicio seleccionada: ${fechaFormateada}`
      );

      // Avanzamos al siguiente paso y mostramos el calendario para la fecha final
      nextStep(chatId);
      mostrarCalendario(bot, chatId, month, year, "fin");
    } else if (tipoFecha === "fin") {
      state.data.fechaFin = fechaSeleccionada.toISOString().split("T")[0];
      state.data.fechaFinFormato = fechaFormateada;

      await bot.deleteMessage(chatId, messageId);
      bot.sendMessage(chatId, `Fecha final seleccionada: ${fechaFormateada}`);

      // Verificamos que la fecha final sea posterior a la inicial
      if (state.data.fechaFin < state.data.fechaInicio) {
        bot.sendMessage(
          chatId,
          "❌ La fecha final debe ser posterior a la fecha inicial. Por favor, selecciona otra fecha."
        );
        mostrarCalendario(bot, chatId, month, year, "fin");
        return;
      }

      // Avanzamos al paso 3: selección del tipo de informe
      nextStep(chatId);

      const options = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📊 Resumido",
                callback_data: "tipoInforme_resumido",
              },
              {
                text: "📋 Detallado por cliente",
                callback_data: "tipoInforme_detallado",
              },
            ],
          ],
        },
      };

      bot.sendMessage(chatId, "¿Qué tipo de informe deseas ver?", options);
    }
  }
};

// Función para mostrar un calendario interactivo
const mostrarCalendario = (bot, chatId, mes, anio, tipoFecha) => {
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const diasSemana = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

  // Obtener el primer día del mes (0-6)
  const primerDiaMes = new Date(anio, mes, 1).getDay();

  // Obtener el último día del mes
  const ultimoDiaMes = new Date(anio, mes + 1, 0).getDate();

  // Crear encabezado del calendario
  let mensaje = `📅 Selecciona la fecha de ${
    tipoFecha === "inicio" ? "inicio" : "fin"
  }:\n`;
  mensaje += `${meses[mes]} ${anio}\n\n`;

  // Añadir días de la semana
  mensaje += diasSemana.join(" ") + "\n";

  // Crear matriz para el teclado inline
  const keyboard = [];

  // Añadir botones de navegación para mes anterior/siguiente
  keyboard.push([
    {
      text: "< Mes anterior",
      callback_data: `calendar_month_prev_${mes}_${anio}_${tipoFecha}`,
    },
    {
      text: "Mes siguiente >",
      callback_data: `calendar_month_next_${mes}_${anio}_${tipoFecha}`,
    },
  ]);

  // Crear filas para los días
  let currentRow = [];

  // Añadir espacios en blanco para los primeros días
  for (let i = 0; i < primerDiaMes; i++) {
    currentRow.push({
      text: " ",
      callback_data: "calendar_none",
    });
  }

  // Añadir días del mes
  for (let day = 1; day <= ultimoDiaMes; day++) {
    currentRow.push({
      text: day.toString(),
      callback_data: `calendar_day_${day}_${mes}_${anio}_${tipoFecha}`,
    });

    // Crear nueva fila después de cada sábado (día 6)
    if ((primerDiaMes + day) % 7 === 0 || day === ultimoDiaMes) {
      keyboard.push(currentRow);
      currentRow = [];
    }
  }

  // Añadir cualquier fila restante
  if (currentRow.length > 0) {
    keyboard.push(currentRow);
  }

  // Enviar mensaje con el calendario
  const options = {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  };

  bot.sendMessage(chatId, mensaje, options);
};

export const handleResumenEntreFechasResponse = (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);

  console.log("handleResumenEntreFechasResponse - chatId:", chatId);
  console.log("handleResumenEntreFechasResponse - estado:", state);

  if (!state || state.command !== "resumenEntreFechas") return false;

  // Con el nuevo selector de calendario, ya no necesitamos procesar texto para las fechas
  // Esta función se mantiene por compatibilidad, pero ahora todo se maneja a través de callbacks

  bot.sendMessage(
    chatId,
    "Por favor, usa el selector de calendario para elegir las fechas."
  );

  return true;
};

const convertirFecha = (texto) => {
  const partes = texto.split("/");
  if (partes.length !== 3) return null;

  const fecha = new Date(partes[2], partes[1] - 1, partes[0]);
  if (isNaN(fecha.getTime())) return null;

  return fecha.toISOString().split("T")[0];
};
