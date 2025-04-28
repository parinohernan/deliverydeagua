import { connection } from "../database/connection.js";

/**
 * Valida el formato de fecha y hora
 * @param {string} texto - Texto a validar en formato DD/MM/YYYY HH:MM
 * @returns {Date|boolean} - Objeto Date si es válido, false si no
 */
export const validarFormatoFechaHora = (texto) => {
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

/**
 * Convierte texto formato DD/MM/YYYY HH:MM a objeto Date
 * @param {string} texto - Texto en formato DD/MM/YYYY HH:MM
 * @returns {Date|null} - Objeto Date o null si es inválido
 */
export const convertirTextoAFecha = (texto) => {
  // Expresión regular para validar formato DD/MM/YYYY HH:MM
  const formatoRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{1,2})$/;
  const match = texto.match(formatoRegex);

  if (!match) return null;

  const [, dia, mes, anio, hora, minuto] = match;

  // Convertir a objeto Date (meses en JS son 0-indexed)
  const fecha = new Date(anio, mes - 1, dia, hora, minuto, 0);

  return fecha;
};

/**
 * Convierte una fecha a formato SQL (YYYY-MM-DD HH:MM:SS)
 * @param {Date} fecha - Objeto Date a convertir
 * @returns {string} - Fecha en formato SQL
 */
export const convertirFechaAFormatoSQL = (fecha) => {
  if (!(fecha instanceof Date)) return null;

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  const hora = String(fecha.getHours()).padStart(2, "0");
  const minuto = String(fecha.getMinutes()).padStart(2, "0");
  const segundo = String(fecha.getSeconds()).padStart(2, "0");

  return `${anio}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
};

/**
 * Asigna una fecha programada a un pedido
 * @param {Object} bot - Instancia del bot de Telegram
 * @param {number} chatId - ID del chat
 * @param {string|number} pedidoId - ID del pedido
 * @param {Date} fecha - Fecha programada
 * @param {string|number} empresa - Código de la empresa
 * @returns {Promise<boolean>} - Resultado de la operación
 */
export const asignarFechaProgramada = (
  bot,
  chatId,
  pedidoId,
  fecha,
  empresa
) => {
  console.log(
    `Asignando fecha programada al pedido #${pedidoId} de empresa ${empresa}`
  );

  return new Promise((resolve, reject) => {
    if (!pedidoId || !empresa || !fecha) {
      console.error("Error: Faltan datos para asignar fecha programada", {
        pedidoId,
        fecha: fecha ? fecha.toISOString() : null,
        empresa,
      });
      bot.sendMessage(
        chatId,
        "Error: Faltan datos para asignar la fecha programada"
      );
      reject(new Error("Datos incompletos"));
      return;
    }

    // Convertir fecha a formato SQL
    const fechaSQL = convertirFechaAFormatoSQL(fecha);
    if (!fechaSQL) {
      console.error("Error al convertir fecha a formato SQL");
      bot.sendMessage(chatId, "Error: Formato de fecha incorrecto");
      reject(new Error("Formato de fecha incorrecto"));
      return;
    }

    const updateQuery = `
      UPDATE pedidos 
      SET FechaProgramada = ?
      WHERE codigo = ? AND codigoEmpresa = ?
    `;

    connection.query(
      updateQuery,
      [fechaSQL, pedidoId, empresa],
      (err, result) => {
        if (err) {
          console.error("Error al asignar fecha programada:", err);
          bot.sendMessage(
            chatId,
            `Error al asignar fecha programada: ${err.message}`
          );
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

        // Formatear fecha para mostrar al usuario
        const opciones = {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        };

        const fechaFormateada = fecha.toLocaleDateString("es-ES", opciones);
        console.log(
          `Fecha programada asignada correctamente al pedido #${pedidoId}: ${fechaFormateada}`
        );

        bot.sendMessage(
          chatId,
          `✅ Entrega programada para el pedido #${pedidoId} el ${fechaFormateada}`
        );
        resolve(true);
      }
    );
  });
};

/**
 * Genera el mensaje de ayuda con ejemplo de fecha programada para mañana
 * @returns {string} - Mensaje con instrucciones y ejemplo
 */
export const generarMensajeAyudaFecha = () => {
  const ahora = new Date();
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 1);

  // Formatear fecha de ejemplo (mañana a las 10:00)
  const dia = manana.getDate().toString().padStart(2, "0");
  const mes = (manana.getMonth() + 1).toString().padStart(2, "0");
  const anio = manana.getFullYear();

  return `Por favor, ingresa la fecha y hora de entrega en formato DD/MM/YYYY HH:MM.

*Ejemplo:* ${dia}/${mes}/${anio} 10:00

La fecha debe ser posterior a hoy.`;
};
