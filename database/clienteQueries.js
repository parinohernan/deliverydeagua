import { connection } from "./connection.js";

export const buscarClientesPorNombre = async (busqueda, empresaCodigo) => {
  console.log(
    "Buscando clientes con búsqueda:",
    busqueda,
    "para empresa:",
    empresaCodigo
  );
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
          LEFT JOIN pedidos p ON c.codigo = p.codigoCliente AND p.codigoEmpresa = ?
          WHERE 
          (LOWER(c.nombre) LIKE LOWER(?) 
          OR LOWER(c.apellido) LIKE LOWER(?))
          AND c.codigoEmpresa = ?
          GROUP BY 
          c.codigo,
          c.nombre,
          c.apellido,
          c.direccion,
          c.telefono
          HAVING saldo > 0
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
        LEFT JOIN pedidos p ON c.codigo = p.codigoCliente AND p.codigoEmpresa = ?
        WHERE c.codigoEmpresa = ?
        GROUP BY 
          c.codigo,
          c.nombre,
          c.apellido,
          c.direccion,
          c.telefono
        HAVING saldo > 0
        ORDER BY 
          c.apellido, 
          c.nombre
      `;
    }

    const params =
      busqueda === "*"
        ? [empresaCodigo, empresaCodigo]
        : [empresaCodigo, `%${busqueda}%`, `%${busqueda}%`, empresaCodigo];

    console.log("Ejecutando consulta:", query);
    console.log("Con parámetros:", params);

    connection.query(query, params, (err, results) => {
      if (err) {
        console.error("Error en buscarClientesPorNombre:", err);
        reject(err);
        return;
      }
      console.log("Resultados encontrados:", results.length);
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
