import { connection } from "./connection.js";

// export const obtenerPedidosImpagosPorCliente = async (codigoCliente) => {
//   const query = `
//     SELECT
//       numero,
//       DATE_FORMAT(fecha, '%d/%m/%Y') as fecha,
//       total,
//       saldo
//     FROM pedidos
//     WHERE codigo_cliente = $1
//     AND saldo > 0
//     ORDER BY fecha DESC
//   `;

//   try {
//     const result = await connection.query(query, [codigoCliente]);
//     return result.rows || [];
//   } catch (error) {
//     console.error("Error en obtenerPedidosImpagosPorCliente:", error);
//     throw error;
//   }
// };
// import { connection } from "./connection.js";

// Función para obtener la zona horaria de una empresa
export const obtenerZonaHorariaEmpresa = async (codigoEmpresa) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT husoHorario
      FROM empresa
      WHERE codigo = ?
    `;

    connection.query(query, [codigoEmpresa], (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      // Si no existe el campo o no hay resultados, usar valor por defecto (0)
      if (results.length === 0 || results[0].husoHorario === undefined) {
        resolve(0);
        return;
      }

      resolve(results[0].husoHorario);
    });
  });
};

// Función para aplicar zona horaria a una fecha
const aplicarZonaHoraria = (fecha, zonaHoraria) => {
  // Crear una nueva fecha para no modificar la original
  const fechaAjustada = new Date(fecha);
  // Ajustar la fecha según la zona horaria (zonaHoraria contiene el desplazamiento en horas)
  fechaAjustada.setHours(fechaAjustada.getHours() + parseInt(zonaHoraria));
  return fechaAjustada;
};

export const obtenerPedidosImpagosPorCliente = async (
  clienteCodigo,
  empresaCodigo
) => {
  // console.log("clienteCodigo", clienteCodigo);
  return new Promise((resolve, reject) => {
    const query = `
        SELECT *
        FROM pedidos 
        WHERE codigoCliente = ? AND codigoEmpresa = ?
        AND saldo > 0
        ORDER BY fechaPedido DESC
    `;

    connection.query(query, [clienteCodigo, empresaCodigo], (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      // console.log("Resultados de obtenerPedidosImpagosPorCliente:", results);
      resolve(results);
    });
  });
};

export const marcarPedidoComoPagado = async (numeroPedido) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Primero obtenemos el pedido para saber el total, el cliente y la empresa
      const querySelect = `
        SELECT p.*, c.saldo as saldoCliente, c.codigo as codigoCliente, p.codigoEmpresa
        FROM pedidos p
        JOIN clientes c ON p.codigoCliente = c.codigo
        WHERE p.codigo = ?
      `;

      connection.query(querySelect, [numeroPedido], async (err, results) => {
        if (err) {
          reject(err);
          return;
        }

        const pedido = results[0];
        if (!pedido) {
          reject(new Error("Pedido no encontrado"));
          return;
        }

        // Obtener la zona horaria de la empresa
        const zonaHoraria = await obtenerZonaHorariaEmpresa(
          pedido.codigoEmpresa
        );

        // Aplicar la zona horaria a la fecha actual
        const fechaActual = new Date();
        const fechaAjustada = aplicarZonaHoraria(fechaActual, zonaHoraria);

        const query = `
        UPDATE pedidos 
        SET saldo = 0,
            fechaPago = ?
        WHERE codigo = ?
        `;

        connection.query(
          query,
          [fechaAjustada, numeroPedido],
          (err, results) => {
            if (err) {
              console.error("Error en marcarPedidoComoPagado:", err);
              reject(err);
              return;
            }

            // Actualizamos el saldo del cliente
            const queryUpdateCliente = `
            UPDATE clientes 
            SET saldo = saldo - ?
            WHERE codigo = ?
          `;

            connection.query(
              queryUpdateCliente,
              [pedido.total, pedido.codigoCliente],
              (err) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(pedido);
              }
            );
          }
        );
      });
    } catch (error) {
      reject(error);
    }
  });
};
