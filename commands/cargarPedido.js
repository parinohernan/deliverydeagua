import { connection } from "../database/connection.js";
import {
  startConversation,
  getConversationState,
  nextStep,
  endConversation,
  updateConversationState,
  deleteConversationState,
} from "../handlers/conversationHandler.js";
import { getEmpresa } from "../database/empresaQueries.js";
import {
  PEDIDO_KEYBOARDS,
  PEDIDO_INLINE_BUTTONS,
  PEDIDO_MESSAGES,
  KEYBOARD_LAYOUT,
} from "../constants/messages.js";
import {
  obtenerZonasExistentes,
  crearTecladoZonas,
} from "../utils/zonaUtils.js";

export const cargarPedido = async (bot, msg) => {
  const chatId = msg.chat.id;

  try {
    // Verificar si ya existe una conversación y terminarla
    const existingState = getConversationState(chatId);
    if (existingState) {
      console.log(`Terminando conversación existente para chatId: ${chatId}`);
      deleteConversationState(chatId);
    }

    // Iniciar nueva conversación
    startConversation(chatId, "cargarPedido");
    const state = getConversationState(chatId);

    if (!state) {
      throw new Error("No se pudo iniciar la conversación");
    }

    // Inicializar datos básicos
    state.data = {
      items: [],
      total: 0,
      codigoVendedor: msg.vendedor?.codigo,
      codigoEmpresa: msg.vendedor?.codigoEmpresa,
    };

    // Verificar que el vendedor tenga los datos necesarios
    if (!state.data.codigoVendedor || !state.data.codigoEmpresa) {
      throw new Error(
        "Datos de vendedor incompletos. Por favor, autentíquese nuevamente."
      );
    }

    // Cargar datos de la empresa
    try {
      const empresa = await getEmpresa(state.data.codigoEmpresa);
      state.data.empresa = empresa;
      console.log("Datos de empresa cargados:", {
        codigoEmpresa: state.data.codigoEmpresa,
        usaEntregaProgramada: empresa.usaEntregaProgramada,
        usaRepartoPorZona: empresa.usaRepartoPorZona,
      });
    } catch (error) {
      console.error("Error al cargar datos de empresa:", error);
      // Continuar con valores por defecto
      state.data.empresa = {
        usaEntregaProgramada: 0,
        usaRepartoPorZona: 0,
      };
    }

    bot.sendMessage(chatId, PEDIDO_MESSAGES.SOLICITAR_CLIENTE);
  } catch (error) {
    console.error("Error al iniciar carga de pedido:", error);
    bot.sendMessage(chatId, `Error: ${error.message}`);
    // Asegurarse de limpiar estado en caso de error
    deleteConversationState(chatId);
  }
};

const mostrarProductos = async (bot, chatId, codigoEmpresa, cliente) => {
  try {
    // Primero, contar cuántos productos activos hay en total
    const queryCount = `
      SELECT COUNT(*) as total
      FROM productos 
      WHERE codigoEmpresa = ? 
      AND activo = 1
    `;

    connection.query(queryCount, [codigoEmpresa], (err, countResults) => {
      if (err) {
        bot.sendMessage(chatId, `Error al contar productos: ${err.message}`);
        return;
      }

      const totalProductos = countResults[0].total;

      // Si hay más de 10 productos, mostrar la interfaz de búsqueda
      if (totalProductos > 10) {
        mostrarBusquedaProductos(
          bot,
          chatId,
          codigoEmpresa,
          cliente,
          totalProductos
        );
      } else {
        // Si hay 10 o menos, mostrar todos los productos como antes
        mostrarTodosProductos(bot, chatId, codigoEmpresa, cliente);
      }
    });
  } catch (error) {
    bot.sendMessage(chatId, `Error al mostrar productos: ${error.message}`);
  }
};

const mostrarTodosProductos = async (bot, chatId, codigoEmpresa, cliente) => {
  const query = `
    SELECT codigo, descripcion, precio 
    FROM productos 
    WHERE codigoEmpresa = ? 
    AND activo = 1
    ORDER BY descripcion
  `;

  connection.query(query, [codigoEmpresa], (err, results) => {
    if (err) {
      bot.sendMessage(chatId, PEDIDO_MESSAGES.ERROR_BUSQUEDA(err));
      return;
    }

    if (results.length === 0) {
      bot.sendMessage(chatId, PEDIDO_MESSAGES.NO_PRODUCTOS);
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

    bot.sendMessage(chatId, PEDIDO_MESSAGES.SELECCIONAR_PRODUCTO(cliente), {
      ...options,
      parse_mode: "Markdown",
    });
  });
};

const mostrarBusquedaProductos = (
  bot,
  chatId,
  codigoEmpresa,
  cliente,
  totalProductos
) => {
  // Guardar el estado de búsqueda de productos
  const state = getConversationState(chatId);
  state.step = 3; // Usar step 3 para la búsqueda de productos
  state.data.busquedaProductos = true;
  state.data.cliente = cliente;

  // Mostrar mensaje con instrucciones para buscar productos
  bot.sendMessage(
    chatId,
    PEDIDO_MESSAGES.BUSCAR_PRODUCTOS(cliente, totalProductos),
    {
      parse_mode: "Markdown",
      ...PEDIDO_KEYBOARDS.BUSQUEDA_PRODUCTOS,
    }
  );
};

const buscarProductos = async (bot, chatId, textoBusqueda, state) => {
  if (!state || !state.data.cliente) return;

  const cliente = state.data.cliente;
  const codigoEmpresa = state.data.codigoEmpresa;

  const query = `
    SELECT codigo, descripcion, precio 
    FROM productos 
    WHERE codigoEmpresa = ? 
    AND activo = 1
    AND descripcion LIKE ?
    ORDER BY descripcion
    LIMIT 11 -- Obtenemos 11 para verificar si hay más de 10
  `;

  connection.query(
    query,
    [codigoEmpresa, `%${textoBusqueda}%`],
    (err, results) => {
      if (err) {
        bot.sendMessage(chatId, PEDIDO_MESSAGES.ERROR_BUSQUEDA(err));
        return;
      }

      if (results.length === 0) {
        bot.sendMessage(
          chatId,
          PEDIDO_MESSAGES.NO_RESULTADOS_BUSQUEDA,
          PEDIDO_KEYBOARDS.BUSQUEDA_PRODUCTOS
        );
        return;
      }

      // Verificar si hay demasiados resultados (más de 10)
      if (results.length > 10) {
        bot.sendMessage(
          chatId,
          PEDIDO_MESSAGES.MUCHOS_RESULTADOS,
          PEDIDO_KEYBOARDS.BUSQUEDA_PRODUCTOS
        );
        return;
      }

      // Si hay 10 o menos resultados, mostrarlos
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

      const options = PEDIDO_INLINE_BUTTONS.NUEVA_BUSQUEDA(botonesProductos);

      bot.sendMessage(
        chatId,
        PEDIDO_MESSAGES.RESULTADOS_BUSQUEDA(cliente, textoBusqueda),
        { ...options, parse_mode: "Markdown" }
      );
    }
  );
};

const agregarProducto = (state, producto, cantidad) => {
  const precioTotal = producto.precio * cantidad;

  state.data.items.push({
    codigo: producto.codigo,
    descripcion: producto.descripcion,
    precio: producto.precio,
    cantidad: cantidad,
    precioTotal: precioTotal,
  });

  state.data.total += precioTotal;
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

export const handleCargarPedidoResponse = async (bot, msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text;
  const state = getConversationState(chatId);

  // Verificar si state existe
  if (!state) {
    console.log(
      `No se encontró estado para chatId: ${chatId}. Iniciando nuevo pedido.`
    );
    // Si no hay estado activo, reiniciar el proceso
    await cargarPedido(bot, msg);
    return;
  }

  console.log(
    `[handleCargarPedidoResponse] chatId: ${chatId}, step: ${state.step}, texto: ${texto}`
  );

  // Verificar si se quiere cancelar
  if (texto === "❌ Cancelar") {
    await cancelarPedido(bot, chatId);
    return;
  }

  // Verificar si se quiere finalizar desde la búsqueda
  if (texto === "✅ Finalizar Pedido") {
    handlePedidoCallback(bot, {
      message: msg,
      data: "finalizar",
      action: "pedido",
      chatId: chatId,
    });
    return;
  }

  // Solo procesar entrega programada si estamos en el paso 4
  if (state.step === 4) {
    // Si el usuario eligió no programar entrega
    if (texto === "⏭️ Continuar sin programar entrega") {
      console.log("Usuario eligió continuar sin programar entrega");
      finalizarPedido(bot, chatId, state, null);
      return;
    }

    // Verificar formato de fecha y hora
    const fechaValida = validarFormatoFechaHora(texto);
    if (!fechaValida) {
      bot.sendMessage(chatId, PEDIDO_MESSAGES.FORMATO_FECHA_INCORRECTO);
      return;
    }

    // Todo correcto, finalizar pedido con fecha programada
    console.log(`Finalizando pedido con fecha programada: ${fechaValida}`);
    finalizarPedido(bot, chatId, state, fechaValida);
    return;
  }

  // Procesar zona de reparto si estamos en el paso 5
  if (state.step === 5) {
    // Si el usuario eligió no asignar zona
    if (texto === "⏭️ Continuar sin asignar zona") {
      console.log("Usuario eligió continuar sin asignar zona de reparto");
      state.data.zona = null;

      // Verificar si debemos solicitar fecha programada
      if (
        state.data.empresa &&
        (state.data.empresa.usaEntregaProgramada === 1 ||
          state.data.empresa.UsaEntregaProgramada === 1)
      ) {
        console.log(`Solicitando fecha programada después de zona`);
        state.step = 4; // Cambiar al paso de fecha programada
        await updateConversationState(chatId, state);
        return solicitarFechaProgramada(bot, chatId, state);
      } else {
        // Si no usa entregas programadas, finalizar el pedido directamente
        return finalizarPedido(bot, chatId, state, null);
      }
    }

    // El usuario ha ingresado una zona
    console.log(`Usuario seleccionó zona de reparto: ${texto}`);
    state.data.zona = texto;

    // Confirmar la selección de zona
    await bot.sendMessage(
      chatId,
      PEDIDO_MESSAGES.ZONA_ASIGNADA(texto),
      PEDIDO_KEYBOARDS.REMOVE_KEYBOARD
    );

    // Verificar si debemos solicitar fecha programada
    if (
      state.data.empresa &&
      (state.data.empresa.usaEntregaProgramada === 1 ||
        state.data.empresa.UsaEntregaProgramada === 1)
    ) {
      console.log(`Solicitando fecha programada después de zona`);
      state.step = 4; // Cambiar al paso de fecha programada
      await updateConversationState(chatId, state);
      return solicitarFechaProgramada(bot, chatId, state);
    } else {
      // Si no usa entregas programadas, finalizar el pedido directamente
      return finalizarPedido(bot, chatId, state, null);
    }
  }

  // Si estamos en paso 0, procesar búsqueda de cliente
  if (state.step === 0) {
    buscarClientes(bot, chatId, texto, state.data.codigoEmpresa);
    return;
  }

  // Si estamos en paso 3 y en búsqueda de productos
  if (state.step === 3 && state.data.busquedaProductos) {
    buscarProductos(bot, chatId, texto, state);
    return;
  }

  // Si estamos en paso 2, procesando cantidad de producto
  if (state.step === 2) {
    await procesarCantidadProducto(bot, chatId, texto, state);
    return;
  }
};

export const handlePedidoCallback = async (bot, query) => {
  console.log(`[handlePedidoCallback] Callback recibido: ${query.data}`);

  const [action, data] = query.data.split("_");
  const chatId = query.message.chat.id;

  try {
    const state = await getConversationState(chatId);

    if (!state) {
      return bot.sendMessage(chatId, PEDIDO_MESSAGES.SESION_EXPIRADA);
    }

    if (state.command !== "cargarPedido") {
      return bot.sendMessage(chatId, PEDIDO_MESSAGES.SESION_INVALIDA);
    }

    if (action === "pedido" && data === "cancelar") {
      await bot.deleteMessage(chatId, query.message.message_id);
      await cancelarPedido(bot, chatId);
      return;
    }

    if (action === "pedido" && data === "finalizar") {
      console.log(
        `[handlePedidoCallback] Finalizando pedido, empresa:`,
        JSON.stringify(state.data.empresa)
      );
      await bot.deleteMessage(chatId, query.message.message_id);

      // Verificar si la empresa usa reparto por zona
      if (
        state.data.empresa &&
        (state.data.empresa.usaRepartoPorZona === 1 ||
          state.data.empresa.UsaRepartoPorZona === 1)
      ) {
        console.log(
          `[handlePedidoCallback] Empresa usa reparto por zona, solicitando zona`
        );
        // Solicitar la zona de reparto
        return solicitarZonaReparto(bot, chatId, state);
      }

      // Verificar si la empresa usa entregas programadas
      if (
        state.data.empresa &&
        (state.data.empresa.usaEntregaProgramada === 1 ||
          state.data.empresa.UsaEntregaProgramada === 1)
      ) {
        console.log(
          `[handlePedidoCallback] Empresa usa entregas programadas, solicitando fecha`
        );
        // Actualizar el estado para pedir fecha programada
        state.step = 4; // Paso para ingresar fecha programada
        await updateConversationState(chatId, state);
        // Solicitar la fecha programada
        return solicitarFechaProgramada(bot, chatId, state);
      } else {
        console.log(
          `[handlePedidoCallback] Empresa NO usa entregas programadas, finalizando pedido sin fecha`
        );
        // Si no usa entregas programadas, finalizar el pedido sin fecha
        return finalizarPedido(bot, chatId, state, null);
      }
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
          state.step = 2;

          // Eliminar el mensaje de selección de productos
          bot.deleteMessage(chatId, query.message.message_id);

          // Mostrar teclado con opciones de cantidad
          const options = {
            reply_markup: {
              keyboard: [
                ["1", "2", "3"],
                ["4", "5", "6"],
                ["📝 Otra cantidad", "❌ Cancelar"],
              ],
              resize_keyboard: true,
            },
          };

          bot.sendMessage(
            chatId,
            `Seleccionaste: ${results[0].descripcion}\nPrecio: $${results[0].precio}\n\nIngresa la cantidad:`,
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
              "Cliente no encontrado. Intenta con otro código o nombre:"
            );
            return;
          }
          state.data.cliente = results[0];
          nextStep(chatId);

          // Eliminar el mensaje de selección de clientes
          bot.deleteMessage(chatId, query.message.message_id);

          // Mostrar productos para la selección
          mostrarProductos(
            bot,
            chatId,
            state.data.codigoEmpresa,
            state.data.cliente
          );
        }
      );
    } else if (action === "buscarProductos") {
      // Manejar callbacks relacionados con la búsqueda de productos
      if (data === "nueva") {
        // Eliminar el mensaje actual
        bot.deleteMessage(chatId, query.message.message_id);

        // Volver a mostrar la interfaz de búsqueda
        mostrarBusquedaProductos(
          bot,
          chatId,
          state.data.codigoEmpresa,
          state.data.cliente,
          "varios" // Usamos 'varios' como placeholder ya que no necesitamos el número exacto aquí
        );
      }
    } else if (action === "pedido") {
      // Eliminar el mensaje del resumen
      bot.deleteMessage(chatId, query.message.message_id);

      if (data === "agregarMas") {
        state.step = 1;
        mostrarProductos(
          bot,
          chatId,
          state.data.codigoEmpresa,
          state.data.cliente
        );
      } else if (data === "terminar") {
        console.log("==== EJECUTANDO PEDIDO_TERMINAR ====");
        console.log(`Estado antes de procesar: step=${state.step}`);
        console.log(`empresa:`, JSON.stringify(state.data.empresa));
        console.log(
          `usaEntregaProgramada: ${state.data.empresa?.usaEntregaProgramada}`
        );
        console.log(
          `Tipo de usaEntregaProgramada: ${typeof state.data.empresa
            ?.usaEntregaProgramada}`
        );

        // Obtener datos de la empresa si no están disponibles
        try {
          // Si la empresa no está cargada en el state, la obtenemos
          if (
            !state.data.empresa ||
            typeof state.data.empresa.usaEntregaProgramada === "undefined"
          ) {
            console.log(
              "Empresa no disponible o falta usaEntregaProgramada, obteniéndola..."
            );
            const empresa = await getEmpresa(state.data.codigoEmpresa);
            state.data.empresa = empresa;
            console.log("Empresa obtenida:", JSON.stringify(empresa));
          }

          // Verificar si la empresa usa entregas programadas
          const usaEntregaProgramada =
            state.data.empresa &&
            (state.data.empresa.usaEntregaProgramada === 1 ||
              (Buffer.isBuffer(state.data.empresa.usaEntregaProgramada) &&
                state.data.empresa.usaEntregaProgramada[0] === 1));

          console.log(
            `Resultado de verificación usaEntregaProgramada: ${usaEntregaProgramada}`
          );

          if (usaEntregaProgramada) {
            console.log("Llamando a solicitarFechaProgramada...");
            // Solicitar fecha de entrega programada
            solicitarFechaProgramada(bot, chatId, state);
            console.log(
              "solicitarFechaProgramada ejecutado, state.step ahora:",
              state.step
            );
          } else {
            console.log("No usa entrega programada, finalizando sin fecha");
            // Finalizar pedido sin programación
            finalizarPedido(bot, chatId, state, null);
          }
        } catch (error) {
          console.error("Error al procesar pedido_terminar:", error);
          // Si hay un error, finalizamos sin fecha programada
          finalizarPedido(bot, chatId, state, null);
        }
      }
    }
  } catch (error) {
    console.error(`[handlePedidoCallback] Error:`, error);
    bot.sendMessage(
      chatId,
      "❌ Ocurrió un error procesando su solicitud. Por favor, intente nuevamente."
    );
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

// Función para guardar el pedido en la base de datos
const guardarPedido = async (pedido) => {
  return new Promise((resolve, reject) => {
    try {
      // Iniciar transacción para asegurar integridad
      connection.beginTransaction((err) => {
        if (err) {
          console.error("Error al iniciar transacción:", err);
          return reject(err);
        }

        // Insertar el pedido principal
        const querySavePedido = `
          INSERT INTO pedidos (
            codigoEmpresa, 
            codigoCliente, 
            FechaPedido, 
            total,
            saldo, 
            FechaProgramada,
            estado,
            zona,
            codigoVendedorPedido
          ) VALUES (?, ?, ?, ?, ?, ?, 'P', ?, ?)
        `;

        const fechaProgramadaValue = pedido.fechaProgramada
          ? new Date(pedido.fechaProgramada)
          : null;

        connection.query(
          querySavePedido,
          [
            pedido.codigoEmpresa,
            pedido.codigoCliente,
            new Date(),
            pedido.total,
            pedido.total, // El saldo inicial es igual al total
            fechaProgramadaValue,
            pedido.zona || null, // Zona de reparto (puede ser null)
            pedido.codigoVendedor,
          ],
          (err, result) => {
            if (err) {
              return connection.rollback(() => {
                console.error("Error al guardar pedido:", err);
                reject(err);
              });
            }

            const pedidoId = result.insertId;
            console.log(`Pedido creado con ID: ${pedidoId}`);

            // Insertar los items del pedido
            if (!pedido.items || pedido.items.length === 0) {
              return connection.rollback(() => {
                reject(new Error("No hay items en el pedido"));
              });
            }

            // Preparar consulta para insertar items
            const querySaveItems = `
              INSERT INTO pedidositems (
                codigoPedido, 
                codigoProducto, 
                cantidad, 
                descuento,
                precioTotal
              ) VALUES ?
            `;

            // Preparar valores para inserción múltiple
            const values = pedido.items.map((item) => [
              pedidoId,
              item.codigo,
              item.cantidad,
              0.0, // Descuento por defecto
              item.precioTotal, // Precio total
            ]);

            connection.query(querySaveItems, [values], (err) => {
              if (err) {
                return connection.rollback(() => {
                  console.error("Error al guardar items del pedido:", err);
                  reject(err);
                });
              }

              // Confirmar transacción
              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => {
                    console.error("Error al confirmar transacción:", err);
                    reject(err);
                  });
                }

                console.log(
                  `Pedido #${pedidoId} guardado correctamente con ${pedido.items.length} items`
                );
                resolve({
                  id: pedidoId,
                  items: pedido.items.length,
                });
              });
            });
          }
        );
      });
    } catch (error) {
      console.error("Error en guardarPedido:", error);
      reject(error);
    }
  });
};

// Si hay consultas a la tabla pedidos
const queryPedidos = `SELECT * FROM pedidos WHERE ...`; // Cambiar aquí

// Si hay consultas a la tabla productos
const queryProductos = `SELECT * FROM productos WHERE ...`; // Cambiar aquí

// Si hay consultas a la tabla pedidositems
const queryPedidosItems = `SELECT * FROM pedidositems WHERE ...`; // Cambiar aquí

// Si hay consultas a la tabla cobros
const queryCobros = `SELECT * FROM cobros WHERE ...`; // Cambiar aquí

// Función para solicitar fecha de entrega programada
const solicitarFechaProgramada = async (bot, chatId, state) => {
  console.log(
    `[solicitarFechaProgramada] Solicitando fecha programada para chatId: ${chatId}`
  );

  try {
    // Actualizar estado a step 4 (ingreso de fecha programada)
    updateConversationState(chatId, {
      ...state,
      step: 4,
    });

    const ahora = new Date();
    const manana = new Date(ahora);
    manana.setDate(ahora.getDate() + 1);

    // Formatear fecha de ejemplo (mañana a las 10:00)
    const dia = manana.getDate().toString().padStart(2, "0");
    const mes = (manana.getMonth() + 1).toString().padStart(2, "0");
    const anio = manana.getFullYear();

    await bot.sendMessage(
      chatId,
      PEDIDO_MESSAGES.PROGRAMAR_ENTREGA(dia, mes, anio),
      {
        ...PEDIDO_KEYBOARDS.PROGRAMAR_ENTREGA,
        parse_mode: "Markdown",
      }
    );

    console.log(
      `[solicitarFechaProgramada] Mensaje enviado correctamente a chatId: ${chatId}`
    );
  } catch (error) {
    console.error(
      `[solicitarFechaProgramada] Error al solicitar fecha programada:`,
      error
    );
    bot.sendMessage(chatId, PEDIDO_MESSAGES.ERROR_BUSQUEDA(error));
  }
};

// Función para validar el formato de fecha y hora
const validarFormatoFechaHora = (texto) => {
  console.log(`Validando formato de fecha: '${texto}'`);
  // Expresión regular para validar formato DD/MM/YYYY HH:MM
  const formatoRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{1,2})$/;

  const match = texto.match(formatoRegex);
  if (!match) {
    console.log("Formato no coincide con la expresión regular");
    return false;
  }

  const [, dia, mes, anio, hora, minuto] = match;
  console.log(
    `Fecha desglosada: día=${dia}, mes=${mes}, año=${anio}, hora=${hora}, minuto=${minuto}`
  );

  // Validar rangos
  if (
    parseInt(dia) < 1 ||
    parseInt(dia) > 31 ||
    parseInt(mes) < 1 ||
    parseInt(mes) > 12 ||
    parseInt(anio) < 2023 || // Validamos desde el año actual
    parseInt(hora) < 0 ||
    parseInt(hora) > 23 ||
    parseInt(minuto) < 0 ||
    parseInt(minuto) > 59
  ) {
    console.log("Valores fuera de rango");
    return false;
  }

  // Convertir a objeto Date
  // Nota: los meses en JavaScript empiezan desde 0, por eso restamos 1 al mes
  const fecha = new Date(anio, mes - 1, dia, hora, minuto, 0);
  console.log(`Fecha convertida: ${fecha.toISOString()}`);

  // Validar que sea una fecha en el futuro
  const ahora = new Date();
  console.log(`Fecha actual: ${ahora.toISOString()}`);
  console.log(`¿Es fecha futura? ${fecha > ahora}`);

  if (fecha <= ahora) {
    return false;
  }

  return fecha;
};

// Función para validar que la fecha sea futura
const validarFechaFutura = (texto) => {
  const formatoRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{1,2})$/;
  const match = texto.match(formatoRegex);

  if (!match) return false;

  const [, dia, mes, anio, hora, minuto] = match;

  // Crear fecha correctamente (los meses en JS son 0-indexed)
  const fecha = new Date(anio, mes - 1, dia, hora, minuto, 0);
  const ahora = new Date();

  console.log(`validarFechaFutura - Fecha ingresada: ${fecha.toISOString()}`);
  console.log(`validarFechaFutura - Fecha actual: ${ahora.toISOString()}`);
  console.log(`validarFechaFutura - ¿Es futura? ${fecha > ahora}`);

  return fecha > ahora;
};

// Función para finalizar el pedido
const finalizarPedido = async (bot, chatId, state, fechaProgramada = null) => {
  console.log(
    `[finalizarPedido] Finalizando pedido para chatId: ${chatId}, fechaProgramada: ${fechaProgramada}`
  );

  try {
    // Verificar que el estado tenga todos los datos necesarios
    if (
      !state ||
      !state.data ||
      !state.data.cliente ||
      !state.data.items ||
      !state.data.codigoEmpresa ||
      !state.data.codigoVendedor
    ) {
      throw new Error("Datos incompletos para guardar el pedido");
    }

    const pedido = {
      codigoEmpresa: state.data.codigoEmpresa,
      codigoCliente: state.data.cliente.codigo,
      fecha: new Date(),
      total: state.data.total,
      items: state.data.items,
      fechaProgramada: fechaProgramada, // Guardar la fecha programada (o null si no se proporcionó)
      zona: state.data.zona, // Zona de reparto (puede ser null)
      codigoVendedor: state.data.codigoVendedor,
    };

    console.log(
      `[finalizarPedido] Datos del pedido a guardar:`,
      JSON.stringify(pedido)
    );
    console.log(`[finalizarPedido] Verificando campos requeridos:
      - codigoEmpresa: ${pedido.codigoEmpresa}
      - codigoCliente: ${pedido.codigoCliente}
      - codigoVendedor: ${pedido.codigoVendedor}
      - total: ${pedido.total}
      - items: ${pedido.items.length}
      - zona: ${pedido.zona || "No asignada"}
    `);

    try {
      const pedidoGuardado = await guardarPedido(pedido);

      if (pedidoGuardado) {
        // Formatear lista de productos para el mensaje
        let detalleProductos = "";
        for (const item of state.data.items) {
          detalleProductos += `- ${item.cantidad} x ${item.descripcion} ($${
            item.precio
          } c/u): $${item.precioTotal.toFixed(2)}\n`;
        }

        // Preparar mensaje con o sin fecha programada
        let mensajeFecha = "";
        if (fechaProgramada) {
          const opciones = {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          };
          const fechaFormateada = fechaProgramada.toLocaleDateString(
            "es-ES",
            opciones
          );
          mensajeFecha = `\n\n🗓️ *Entrega programada para:*\n${fechaFormateada}`;
        }

        // Preparar mensaje con o sin zona de reparto
        let mensajeZona = "";
        if (pedido.zona) {
          mensajeZona = `\n\n🚚 *Zona de reparto:*\n${pedido.zona}`;
        }

        // Eliminar el teclado personalizado
        await bot.sendMessage(
          chatId,
          PEDIDO_MESSAGES.PROCESANDO_PEDIDO,
          PEDIDO_KEYBOARDS.REMOVE_KEYBOARD
        );

        // Enviar el mensaje de confirmación
        await bot.sendMessage(
          chatId,
          PEDIDO_MESSAGES.PEDIDO_CONFIRMADO(
            pedidoGuardado.id,
            state.data.cliente,
            detalleProductos,
            state.data.total,
            mensajeFecha + mensajeZona
          ),
          { parse_mode: "Markdown" }
        );

        // Limpiar el estado de la conversación
        deleteConversationState(chatId);

        // Mostrar mensaje para continuar con otras operaciones y el menú principal
        setTimeout(() => {
          bot.sendMessage(chatId, PEDIDO_MESSAGES.PEDIDO_FINALIZADO_CONTINUAR, {
            reply_markup: KEYBOARD_LAYOUT,
          });
        }, 1000); // Pequeño retraso para asegurar que los mensajes aparezcan en orden
      } else {
        throw new Error("No se pudo guardar el pedido");
      }
    } catch (dbError) {
      console.error(`[finalizarPedido] Error en base de datos:`, dbError);
      throw new Error(`Error al guardar en base de datos: ${dbError.message}`);
    }
  } catch (error) {
    console.error(`[finalizarPedido] Error al guardar el pedido:`, error);

    // Eliminar el teclado personalizado incluso en caso de error
    await bot.sendMessage(
      chatId,
      PEDIDO_MESSAGES.ERROR_OCURRIDO,
      PEDIDO_KEYBOARDS.REMOVE_KEYBOARD
    );

    // Mostrar el mensaje de error
    await bot.sendMessage(chatId, PEDIDO_MESSAGES.PEDIDO_ERROR(error));

    // Mostrar menú principal después del error
    setTimeout(() => {
      bot.sendMessage(chatId, PEDIDO_MESSAGES.PEDIDO_FINALIZADO_CONTINUAR, {
        reply_markup: KEYBOARD_LAYOUT,
      });
    }, 1000);

    // No eliminar el estado para permitir reintentar
  }
};

// Función para cancelar el pedido
export const cancelarPedido = async (bot, chatId) => {
  // Eliminar teclado personalizado
  await bot.sendMessage(
    chatId,
    PEDIDO_MESSAGES.CANCELANDO_PEDIDO,
    PEDIDO_KEYBOARDS.REMOVE_KEYBOARD
  );

  // Enviar mensaje de cancelación
  await bot.sendMessage(chatId, PEDIDO_MESSAGES.PEDIDO_CANCELADO);

  // Limpiar estado
  deleteConversationState(chatId);

  // Mostrar menú principal después de cancelar
  setTimeout(() => {
    bot.sendMessage(chatId, PEDIDO_MESSAGES.PEDIDO_FINALIZADO_CONTINUAR, {
      reply_markup: KEYBOARD_LAYOUT,
    });
  }, 1000);
};

// Función para buscar clientes
const buscarClientes = (bot, chatId, texto, codigoEmpresa) => {
  // Búsqueda por nombre/apellido
  connection.query(
    "SELECT codigo, nombre, apellido FROM clientes WHERE (nombre LIKE ? OR apellido LIKE ?) AND codigoEmpresa = ? LIMIT 5",
    [`%${texto}%`, `%${texto}%`, codigoEmpresa],
    (err, results) => {
      if (err) {
        bot.sendMessage(chatId, PEDIDO_MESSAGES.ERROR_BUSQUEDA(err));
        return;
      }

      if (results.length === 0) {
        bot.sendMessage(chatId, PEDIDO_MESSAGES.NO_CLIENTES);
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

      bot.sendMessage(chatId, PEDIDO_MESSAGES.SELECCIONAR_CLIENTE, options);
    }
  );
};

// Función para procesar la cantidad de producto
const procesarCantidadProducto = async (bot, chatId, texto, state) => {
  const productoTemp = state.data.productoTemp;

  if (!productoTemp) {
    bot.sendMessage(chatId, PEDIDO_MESSAGES.PRODUCTO_NO_ENCONTRADO);
    return await cancelarPedido(bot, chatId);
  }

  // Si el usuario eligió "Otra cantidad", procesamos el texto ingresado como cantidad
  if (texto === "📝 Otra cantidad") {
    bot.sendMessage(
      chatId,
      PEDIDO_MESSAGES.SOLICITAR_OTRA_CANTIDAD,
      PEDIDO_KEYBOARDS.REMOVE_KEYBOARD
    );
    return;
  }

  // Validar que sea un número
  let cantidad = parseInt(texto);
  if (isNaN(cantidad) || cantidad <= 0) {
    bot.sendMessage(
      chatId,
      PEDIDO_MESSAGES.CANTIDAD_INVALIDA,
      PEDIDO_KEYBOARDS.REMOVE_KEYBOARD
    );
    return;
  }

  // Agregar producto al pedido
  agregarProducto(state, productoTemp, cantidad);

  // Actualizar estado
  state.step = 1;

  // Calcular subtotal
  const subtotal = productoTemp.precio * cantidad;

  bot.sendMessage(
    chatId,
    PEDIDO_MESSAGES.PRODUCTO_AGREGADO(
      productoTemp,
      cantidad,
      subtotal,
      state.data.total
    ),
    PEDIDO_INLINE_BUTTONS.FINALIZAR_PEDIDO
  );
};

// Función para solicitar zona de reparto
const solicitarZonaReparto = async (bot, chatId, state) => {
  console.log(
    `[solicitarZonaReparto] Solicitando zona de reparto para chatId: ${chatId}`
  );

  try {
    // Actualizar estado a step 5 (ingreso de zona de reparto)
    updateConversationState(chatId, {
      ...state,
      step: 5,
    });

    // Obtener zonas existentes usando la función utilitaria
    const zonas = await obtenerZonasExistentes(state.data.codigoEmpresa);
    console.log(`Zonas obtenidas: ${zonas.length}`);

    // Crear teclado personalizado con las zonas usando la función utilitaria
    const customKeyboard = crearTecladoZonas(zonas);

    await bot.sendMessage(chatId, PEDIDO_MESSAGES.SOLICITAR_ZONA, {
      ...customKeyboard,
      parse_mode: "Markdown",
    });

    console.log(
      `[solicitarZonaReparto] Mensaje enviado correctamente a chatId: ${chatId}`
    );
  } catch (error) {
    console.error(
      `[solicitarZonaReparto] Error al solicitar zona de reparto:`,
      error
    );
    bot.sendMessage(chatId, PEDIDO_MESSAGES.ERROR_BUSQUEDA(error));
  }
};
