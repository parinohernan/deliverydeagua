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
  return new Promise((resolve, reject) => {
    const query = `
    UPDATE pedidos 
    SET saldo = 0,
        fechaPago = ?
    WHERE codigo = ?
    `;

    const fechaActual = new Date();
    connection.query(query, [fechaActual, numeroPedido], (err, results) => {
      if (err) {
        console.error("Error en marcarPedidoComoPagado:", err);
        reject(err);
        return;
      }

      // Primero obtenemos el pedido para saber el total y el cliente
      const querySelect = `
        SELECT p.*, c.saldo as saldoCliente, c.codigo as codigoCliente 
        FROM pedidos p
        JOIN clientes c ON p.codigoCliente = c.codigo
        WHERE p.codigo = ?
      `;

      connection.query(querySelect, [numeroPedido], (err, results) => {
        if (err) {
          reject(err);
          return;
        }

        const pedido = results[0];
        if (!pedido) {
          reject(new Error("Pedido no encontrado"));
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
      });
    });
  });
};
