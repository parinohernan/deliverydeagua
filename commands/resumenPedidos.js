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

  // Obtener fechas para las opciones predefinidas
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📊 Resumen de Hoy",
            callback_data: `resumen_predefinido_${formatoFecha(
              hoy
            )}_${formatoFecha(hoy)}`,
          },
        ],
        [
          {
            text: "📊 Resumen de Ayer",
            callback_data: `resumen_predefinido_${formatoFecha(
              ayer
            )}_${formatoFecha(ayer)}`,
          },
        ],
        [
          {
            text: "📊 Mes Actual",
            callback_data: `resumen_predefinido_${formatoFecha(
              primerDiaMes
            )}_${formatoFecha(ultimoDiaMes)}`,
          },
        ],
        [
          {
            text: "📅 Personalizar Fechas",
            callback_data: "resumen_entreFechas",
          },
        ],
      ],
    },
  };

  bot.sendMessage(chatId, "Selecciona el período para el resumen:", options);
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
  const [action, ...params] = callbackQuery.data.split("_");
  const empresa = callbackQuery.message.vendedor.codigoEmpresa;

  console.log("handleResumenCallback - action:", action);
  console.log("handleResumenCallback - params:", params);
  console.log(
    "handleResumenCallback - callbackQuery.data:",
    callbackQuery.data
  );

  // Manejar resumen predefinido
  if (action === "resumen" && params[0] === "predefinido") {
    const fechaInicio = params[1];
    const fechaFin = params[2];

    // Convertir las fechas al formato correcto para MySQL
    const fechaInicioSQL = convertirFechaParaSQL(fechaInicio);
    const fechaFinSQL = convertirFechaParaSQL(fechaFin);

    const filtroFecha = `
      AND DATE(ped.FechaEntrega) 
      BETWEEN '${fechaInicioSQL}' AND '${fechaFinSQL}'
    `;

    try {
      // Mostrar opciones de tipo de informe
      const options = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📊 Resumen",
                callback_data: `tipoInforme_resumido_${fechaInicio}_${fechaFin}`,
              },
              {
                text: "📋 Detallado",
                callback_data: `tipoInforme_detallado_${fechaInicio}_${fechaFin}`,
              },
            ],
          ],
        },
      };

      bot.sendMessage(
        chatId,
        "Selecciona el tipo de informe que deseas ver:",
        options
      );
    } catch (error) {
      console.error("Error al procesar resumen predefinido:", error);
      bot.sendMessage(
        chatId,
        "Error al procesar el resumen. Por favor, intenta nuevamente."
      );
    }
    return;
  }

  // Si es tipo de informe (resumido o detallado)
  if (action === "tipoInforme") {
    const tipoInforme = params[0];
    const fechaInicio = params[1];
    const fechaFin = params[2];

    console.log("Procesando tipo informe con fechas:", {
      tipoInforme,
      fechaInicio,
      fechaFin,
    });

    // Convertir las fechas al formato correcto para MySQL
    const fechaInicioSQL = convertirFechaParaSQL(fechaInicio);
    const fechaFinSQL = convertirFechaParaSQL(fechaFin);

    const filtroFecha = `
      AND DATE(ped.FechaEntrega) 
      BETWEEN '${fechaInicioSQL}' AND '${fechaFinSQL}'
    `;

    try {
      console.log("Ejecutando consulta con filtro:", filtroFecha);
      console.log("Empresa:", empresa);
      console.log("Tipo Informe:", tipoInforme);

      const resumen = await obtenerResumenDetallado(
        connection,
        filtroFecha,
        empresa,
        tipoInforme
      );

      if (resumen.items.length === 0) {
        bot.sendMessage(
          chatId,
          "No hay datos para mostrar en el período seleccionado"
        );
      } else {
        let mensaje = "";

        if (tipoInforme === "resumido") {
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
Período: ${fechaInicio} al ${fechaFin}
Cantidad de Pedidos: ${resumen.cantidadPedidos}

${mensaje}

💰 Total General: $${resumen.total}`;

        bot.sendMessage(chatId, mensajeCompleto);
      }
    } catch (error) {
      console.error("Error al obtener resumen:", error);
      bot.sendMessage(chatId, `Error al obtener el resumen: ${error.message}`);
    }
    return;
  }

  // Si es una acción relacionada con el calendario (para fechas personalizadas)
  if (
    (action === "resumen" && params[0] === "entreFechas") ||
    callbackQuery.data.startsWith("calendar_")
  ) {
    await handleCalendarCallback(bot, callbackQuery);
    return;
  }
};

const convertirFechaParaSQL = (fechaStr) => {
  if (!fechaStr || typeof fechaStr !== "string") {
    console.error("Fecha inválida recibida:", fechaStr);
    throw new Error("Fecha inválida");
  }

  try {
    // Convertir de formato dd/mm/yyyy a yyyy-mm-dd
    const [dia, mes, anio] = fechaStr.split("/");
    if (!dia || !mes || !anio) {
      throw new Error("Formato de fecha inválido");
    }
    return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  } catch (error) {
    console.error("Error al convertir fecha:", error);
    throw new Error("Error al convertir fecha");
  }
};

const obtenerResumenDetallado = async (
  connection,
  filtroFecha,
  empresa,
  tipoInforme = "resumido"
) => {
  return new Promise((resolve, reject) => {
    console.log("Iniciando consulta para resumen detallado");
    console.log("Filtro fecha:", filtroFecha);
    console.log("Empresa:", empresa);
    console.log("Tipo informe:", tipoInforme);

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

      console.log("Query resumido:", query);

      connection.query(query, [empresa], (err, results) => {
        if (err) {
          console.error("Error en consulta resumida:", err);
          reject(err);
          return;
        }

        console.log("Resultados resumidos:", results);

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

      console.log("Query detallado:", query);

      connection.query(query, [empresa], (err, results) => {
        if (err) {
          console.error("Error en consulta detallada:", err);
          reject(err);
          return;
        }

        console.log("Resultados detallados:", results);

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

  console.log("Manejando callback del calendario:", callbackQuery.data);

  // Iniciar conversación si no existe
  if (callbackQuery.data === "resumen_entreFechas") {
    console.log("Iniciando nueva conversación para resumen entre fechas");
    startConversation(chatId, "resumenEntreFechas");
    const state = getConversationState(chatId);
    state.data = {
      empresa: callbackQuery.message.vendedor.codigoEmpresa,
    };

    // Mostrar el calendario inicial
    const hoy = new Date();
    mostrarCalendario(bot, chatId, hoy.getMonth(), hoy.getFullYear(), "inicio");
    return;
  }

  const state = getConversationState(chatId);
  if (!state || state.command !== "resumenEntreFechas") {
    console.log("Estado no válido para el calendario:", state);
    startConversation(chatId, "resumenEntreFechas");
    const newState = getConversationState(chatId);
    newState.data = {
      empresa: callbackQuery.message.vendedor.codigoEmpresa,
    };
  }

  const parts = callbackQuery.data.split("_");
  const action = parts[1];

  console.log("Acción del calendario:", action);

  if (action === "month") {
    const direction = parts[2];
    const currentMonth = parseInt(parts[3]);
    const currentYear = parseInt(parts[4]);
    const tipoFecha = parts[5];

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

    try {
      await bot.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error("Error al eliminar mensaje del calendario:", error);
    }
    mostrarCalendario(bot, chatId, newMonth, newYear, tipoFecha);
  } else if (action === "day") {
    const day = parseInt(parts[2]);
    const month = parseInt(parts[3]);
    const year = parseInt(parts[4]);
    const tipoFecha = parts[5];

    const fechaSeleccionada = new Date(year, month, day);
    const fechaFormateada = formatoFecha(fechaSeleccionada);

    console.log("Fecha seleccionada:", fechaFormateada, "tipo:", tipoFecha);

    const state = getConversationState(chatId);
    if (!state.data) {
      state.data = {
        empresa: callbackQuery.message.vendedor.codigoEmpresa,
      };
    }

    if (tipoFecha === "inicio") {
      state.data.fechaInicio = fechaSeleccionada.toISOString().split("T")[0];
      state.data.fechaInicioFormato = fechaFormateada;

      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        console.error("Error al eliminar mensaje del calendario:", error);
      }
      bot.sendMessage(
        chatId,
        `Fecha de inicio seleccionada: ${fechaFormateada}`
      );

      nextStep(chatId);
      mostrarCalendario(bot, chatId, month, year, "fin");
    } else if (tipoFecha === "fin") {
      state.data.fechaFin = fechaSeleccionada.toISOString().split("T")[0];
      state.data.fechaFinFormato = fechaFormateada;

      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        console.error("Error al eliminar mensaje del calendario:", error);
      }
      bot.sendMessage(chatId, `Fecha final seleccionada: ${fechaFormateada}`);

      if (new Date(state.data.fechaFin) < new Date(state.data.fechaInicio)) {
        bot.sendMessage(
          chatId,
          "❌ La fecha final debe ser posterior a la fecha inicial. Por favor, selecciona otra fecha."
        );
        mostrarCalendario(bot, chatId, month, year, "fin");
        return;
      }

      nextStep(chatId);

      const options = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📊 Resumen",
                callback_data: `tipoInforme_resumido_${state.data.fechaInicioFormato}_${state.data.fechaFinFormato}`,
              },
              {
                text: "📋 Detallado",
                callback_data: `tipoInforme_detallado_${state.data.fechaInicioFormato}_${state.data.fechaFinFormato}`,
              },
            ],
          ],
        },
      };

      bot.sendMessage(chatId, "¿Qué tipo de informe deseas ver?", options);
      endConversation(chatId);
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
