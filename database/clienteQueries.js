import { connection } from "./connection.js";

export const buscarClientesPorNombre = async (busqueda, empresaCodigo) => {
  return new Promise((resolve, reject) => {
    let query = `
    SELECT 
          c.codigo,
          c.nombre,
          c.apellido,
          c.direccion,
          c.telefono,
          COALESCE(SUM(p.saldo), 0) as saldo
          FROM clientes c
          LEFT JOIN pedidos p ON c.codigo = p.codigoCliente
          WHERE 
          (LOWER(c.nombre) LIKE LOWER(?) 
          OR LOWER(c.apellido) LIKE LOWER(?))
          AND (c.codigoEmpresa = ?) AND (c.saldo > 0)
          GROUP BY 
          c.codigo,
          c.nombre,
          c.apellido,
          c.direccion,
          c.telefono
          ORDER BY 
          c.apellido, 
          c.nombre
          LIMIT 10
          `;

    if (busqueda === "*") {
      query = ` 
        SELECT 
          c.codigo,
          c.nombre,
          c.apellido,
          c.direccion,
          c.telefono,
          COALESCE(SUM(p.saldo), 0) as saldo
        FROM clientes c
        LEFT JOIN pedidos p ON c.codigo = p.codigoCliente
        WHERE c.codigoEmpresa = ? AND (c.saldo > 0)
        GROUP BY 
          c.codigo,
          c.nombre,
          c.apellido,
          c.direccion,
          c.telefono
      `;
    }

    const params =
      busqueda === "*"
        ? [empresaCodigo]
        : [`%${busqueda}%`, `%${busqueda}%`, empresaCodigo];

    connection.query(query, params, (err, results) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(results);
    });
  });
};

export const obtenerClientePorCodigo = async (codigo) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        c.codigo,
        c.nombre,
        c.apellido,
        c.direccion,
        c.telefono,
        COALESCE(SUM(p.saldo), 0) as saldo
      FROM clientes c
      LEFT JOIN pedidos p ON c.codigo = p.codigoCliente
      WHERE c.codigo = ?
      GROUP BY 
        c.codigo,
        c.nombre,
        c.apellido,
        c.direccion,
        c.telefono
    `;

    connection.query(query, [codigo], (err, results) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(results[0]);
    });
  });
};
