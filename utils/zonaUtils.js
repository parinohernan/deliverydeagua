import { connection } from "../database/connection.js";

/**
 * Obtiene las zonas existentes para una empresa
 * @param {string|number} codigoEmpresa - Código de la empresa
 * @returns {Promise<Array>} - Lista de zonas
 */
export const obtenerZonasExistentes = (codigoEmpresa) => {
  console.log(`Obteniendo zonas existentes para empresa: ${codigoEmpresa}`);

  return new Promise((resolve, reject) => {
    const query = `
      SELECT DISTINCT zona 
      FROM pedidos 
      WHERE zona IS NOT NULL AND zona != '' AND codigoEmpresa = ?
      UNION
      SELECT zona 
      FROM zonas 
      WHERE codigoEmpresa = ?
      ORDER BY zona
    `;

    connection.query(query, [codigoEmpresa, codigoEmpresa], (err, results) => {
      if (err) {
        console.error("Error al obtener zonas:", err);
        reject(err);
        return;
      }

      const zonas = results.map((r) => r.zona).filter(Boolean);
      console.log(
        `Se encontraron ${zonas.length} zonas para empresa ${codigoEmpresa}`
      );
      resolve(zonas);
    });
  });
};

/**
 * Asigna una zona a un pedido
 * @param {Object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string|number} pedidoId - ID del pedido
 * @param {string} zona - Zona a asignar
 * @param {string|number} empresa - Código de la empresa
 * @returns {Promise<boolean>} - Resultado de la operación
 */
export const asignarZonaAPedido = (bot, chatId, pedidoId, zona, empresa) => {
  console.log(
    `Asignando zona "${zona}" al pedido #${pedidoId} de empresa ${empresa}`
  );

  return new Promise((resolve, reject) => {
    if (!pedidoId || !empresa) {
      console.error("Error: Faltan datos para asignar zona", {
        pedidoId,
        zona,
        empresa,
      });
      bot.sendMessage(chatId, "Error: Faltan datos para asignar la zona");
      reject(new Error("Datos incompletos"));
      return;
    }

    const updateQuery = `
      UPDATE pedidos 
      SET zona = ?
      WHERE codigo = ? AND codigoEmpresa = ?
    `;

    connection.query(updateQuery, [zona, pedidoId, empresa], (err, result) => {
      if (err) {
        console.error("Error al asignar zona:", err);
        bot.sendMessage(chatId, `Error al asignar zona: ${err.message}`);
        reject(err);
        return;
      }

      if (result.affectedRows === 0) {
        console.warn(
          `No se encontró el pedido #${pedidoId} para empresa ${empresa}`
        );
        bot.sendMessage(
          chatId,
          `⚠️ No se encontró el pedido #${pedidoId} o no pertenece a su empresa`
        );
        resolve(false);
        return;
      }

      console.log(
        `Zona "${zona}" asignada correctamente al pedido #${pedidoId}`
      );
      bot.sendMessage(
        chatId,
        `✅ Zona "${zona}" asignada al pedido #${pedidoId}`
      );
      resolve(true);
    });
  });
};

/**
 * Guarda una nueva zona en la base de datos
 * @param {string} zona - Nombre de la zona a guardar
 * @param {string|number} empresa - Código de la empresa
 * @returns {Promise<boolean>} - Resultado de la operación
 */
export const guardarNuevaZona = (zona, empresa) => {
  console.log(`Guardando nueva zona "${zona}" para empresa ${empresa}`);

  return new Promise((resolve, reject) => {
    // Verificar si la zona ya existe
    const checkZonaQuery = `
      SELECT zona FROM zonas WHERE zona = ? AND codigoEmpresa = ?
    `;

    connection.query(checkZonaQuery, [zona, empresa], (err, results) => {
      if (err) {
        console.error("Error al verificar zona:", err);
        reject(err);
        return;
      }

      if (results.length > 0) {
        // La zona ya existe, no es necesario guardarla
        console.log(`La zona "${zona}" ya existe para empresa ${empresa}`);
        resolve(true);
        return;
      }

      // La zona no existe, la guardamos
      const insertZonaQuery = `
        INSERT INTO zonas (zona, codigoEmpresa) VALUES (?, ?)
      `;

      connection.query(insertZonaQuery, [zona, empresa], (err, result) => {
        if (err) {
          console.error("Error al guardar zona:", err);
          reject(err);
          return;
        }

        console.log(`Nueva zona "${zona}" guardada para empresa ${empresa}`);
        resolve(true);
      });
    });
  });
};

/**
 * Crea los botones para las zonas disponibles
 * @param {Array} zonas - Lista de zonas disponibles
 * @param {string|number} pedidoId - ID del pedido
 * @returns {Array} - Matriz de botones para el teclado inline
 */
export const crearBotonesZonas = (zonas, pedidoId) => {
  const keyboard = [];

  // Agrupamos los botones de 2 en 2
  for (let i = 0; i < zonas.length; i += 2) {
    const row = [];
    row.push({
      text: zonas[i],
      callback_data: `asignarZona_${pedidoId}_${zonas[i]}`,
    });

    if (i + 1 < zonas.length) {
      row.push({
        text: zonas[i + 1],
        callback_data: `asignarZona_${pedidoId}_${zonas[i + 1]}`,
      });
    }
    keyboard.push(row);
  }

  // Añadir botones de acción
  keyboard.push([
    {
      text: "➕ Nueva Zona",
      callback_data: `nuevaZona_${pedidoId}`,
    },
  ]);

  keyboard.push([
    {
      text: "⏭️ Continuar sin asignar zona",
      callback_data: `sinZona_${pedidoId}`,
    },
  ]);

  return keyboard;
};

/**
 * Crea un teclado personalizado con las zonas disponibles
 * @param {Array} zonas - Lista de zonas disponibles
 * @returns {Object} - Teclado personalizado para Telegram
 */
export const crearTecladoZonas = (zonas) => {
  let keyboard = [["⏭️ Continuar sin asignar zona"], ["❌ Cancelar"]];

  // Si hay zonas existentes, agregarlas al teclado
  if (zonas && zonas.length > 0) {
    const zonasRows = zonas.reduce((acc, zona, index) => {
      // Agrupar zonas de 2 en 2 en cada fila
      if (index % 2 === 0) {
        acc.push([zona]);
      } else {
        acc[acc.length - 1].push(zona);
      }
      return acc;
    }, []);

    keyboard = [...zonasRows, ...keyboard];
  }

  return {
    reply_markup: {
      keyboard: keyboard,
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
};
