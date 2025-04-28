import { connection } from "../database/connection.js";

// Obtener notificaciones activas para un usuario/empresa
export const obtenerNotificaciones = async (codigoVendedor, codigoEmpresa) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT *
      FROM notificaciones
      WHERE 
        (codigoVendedor = ? OR codigoVendedor IS NULL) 
        AND codigoEmpresa = ?
        AND activa = 1
        AND (fechaInicio <= NOW() AND (fechaFin >= NOW() OR fechaFin IS NULL))
      ORDER BY prioridad DESC, fechaCreacion DESC
      LIMIT 5
    `;

    connection.query(query, [codigoVendedor, codigoEmpresa], (err, results) => {
      if (err) {
        console.error("Error al obtener notificaciones:", err);
        reject(err);
        return;
      }

      resolve(results || []);
    });
  });
};

// Crear una nueva notificación
export const crearNotificacion = async (notificacion) => {
  return new Promise((resolve, reject) => {
    const {
      codigoEmpresa,
      codigoVendedor,
      mensaje,
      tipo,
      prioridad,
      fechaInicio,
      fechaFin,
    } = notificacion;

    const query = `
      INSERT INTO notificaciones (
        codigoEmpresa,
        codigoVendedor,
        mensaje,
        tipo,
        prioridad,
        fechaInicio,
        fechaFin,
        fechaCreacion,
        activa
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 1)
    `;

    connection.query(
      query,
      [
        codigoEmpresa,
        codigoVendedor,
        mensaje,
        tipo,
        prioridad,
        fechaInicio,
        fechaFin,
      ],
      (err, result) => {
        if (err) {
          console.error("Error al crear notificación:", err);
          reject(err);
          return;
        }

        resolve(result);
      }
    );
  });
};

// Marcar notificación como leída
export const marcarNotificacionLeida = async (
  notificacionId,
  codigoVendedor
) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE notificaciones_lectura
      SET leida = 1, fechaLectura = NOW()
      WHERE notificacionId = ? AND codigoVendedor = ?
    `;

    connection.query(query, [notificacionId, codigoVendedor], (err, result) => {
      if (err) {
        console.error("Error al marcar notificación como leída:", err);
        reject(err);
        return;
      }

      // Si no se actualizó ninguna fila, es porque no existía un registro de lectura
      if (result.affectedRows === 0) {
        const insertQuery = `
          INSERT INTO notificaciones_lectura (
            notificacionId,
            codigoVendedor,
            leida,
            fechaLectura
          ) VALUES (?, ?, 1, NOW())
        `;

        connection.query(
          insertQuery,
          [notificacionId, codigoVendedor],
          (err, result) => {
            if (err) {
              console.error("Error al insertar registro de lectura:", err);
              reject(err);
              return;
            }

            resolve(result);
          }
        );
      } else {
        resolve(result);
      }
    });
  });
};

// Función para formatear las notificaciones en un mensaje de texto
export const formatearNotificaciones = (notificaciones) => {
  if (!notificaciones || notificaciones.length === 0) {
    return "";
  }

  let mensaje = "\n\n📢 *NOTIFICACIONES:*\n";

  notificaciones.forEach((notif) => {
    const tipoIcon = getTipoNotificacionIcon(notif.tipo);
    mensaje += `${tipoIcon} ${notif.mensaje}\n`;
  });

  return mensaje;
};

// Obtener ícono según el tipo de notificación
const getTipoNotificacionIcon = (tipo) => {
  const tipos = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    success: "✅",
    update: "🔄",
    promotion: "🎁",
  };

  return tipos[tipo] || "ℹ️";
};
