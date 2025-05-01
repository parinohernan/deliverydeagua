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
          COALESCE(SUM(p.saldo), 0) as saldo,
          IFNULL(c.retornables, 0) as retornables
          FROM clientes c
          LEFT JOIN pedidos p ON c.codigo = p.codigoCliente AND p.codigoEmpresa = ?
          WHERE 
          (LOWER(c.nombre) LIKE LOWER(?) 
          OR LOWER(c.apellido) LIKE LOWER(?))
          AND c.codigoEmpresa = ?
          AND c.activo = 1
          GROUP BY 
          c.codigo,
          c.nombre,
          c.apellido,
          c.direccion,
          c.telefono,
          c.retornables
          HAVING saldo > 0 OR retornables > 0
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
          COALESCE(SUM(p.saldo), 0) as saldo,
          IFNULL(c.retornables, 0) as retornables
        FROM clientes c
        LEFT JOIN pedidos p ON c.codigo = p.codigoCliente AND p.codigoEmpresa = ?
        WHERE c.codigoEmpresa = ?
        AND c.activo = 1
        GROUP BY 
          c.codigo,
          c.nombre,
          c.apellido,
          c.direccion,
          c.telefono,
          c.retornables
        HAVING saldo > 0 OR retornables > 0
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

export const obtenerClientePorCodigo = async (codigo, empresaCodigo) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        c.codigo,
        c.nombre,
        c.apellido,
        c.direccion,
        c.telefono,
        COALESCE(SUM(p.saldo), 0) as saldo,
        IFNULL(c.retornables, 0) as retornables
      FROM clientes c
      LEFT JOIN pedidos p ON c.codigo = p.codigoCliente AND p.codigoEmpresa = ?
      WHERE c.codigo = ?
      AND c.codigoEmpresa = ?
      AND c.activo = 1
      GROUP BY 
        c.codigo,
        c.nombre,
        c.apellido,
        c.direccion,
        c.telefono,
        c.retornables
    `;

    connection.query(
      query,
      [empresaCodigo, codigo, empresaCodigo],
      (err, results) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(results.length > 0 ? results[0] : null);
      }
    );
  });
};

// Nueva función para actualizar datos de un cliente
export const actualizarCliente = async (
  codigoCliente,
  campo,
  valor,
  codigoEmpresa
) => {
  return new Promise((resolve, reject) => {
    // Validar el campo para evitar inyección SQL
    const camposPermitidos = ["nombre", "apellido", "direccion", "telefono"];
    if (!camposPermitidos.includes(campo.toLowerCase())) {
      return reject(new Error("Campo inválido para actualizar."));
    }

    // Usar placeholders (?) para seguridad
    const query = `
      UPDATE clientes 
      SET ?? = ? 
      WHERE codigo = ? AND codigoEmpresa = ?
    `;
    // Los parámetros deben estar en el orden correcto para los placeholders
    const params = [campo, valor, codigoCliente, codigoEmpresa];

    console.log("Ejecutando consulta UPDATE:", query);
    console.log("Con parámetros:", params);

    connection.query(query, params, (err, result) => {
      if (err) {
        console.error("Error en actualizarCliente:", err);
        reject(err);
        return;
      }
      if (result.affectedRows === 0) {
        console.warn(
          "No se encontró el cliente para actualizar o no hubo cambios:",
          codigoCliente,
          codigoEmpresa
        );
        // Podríamos rechazar o resolver indicando que no se actualizó
        // reject(new Error("Cliente no encontrado o sin cambios."));
        // Por ahora resolvemos, pero el flujo de edición podría querer saber esto.
        resolve({ affectedRows: 0 });
      }
      console.log("Cliente actualizado correctamente:", result.affectedRows);
      resolve(result);
    });
  });
};

// Nueva función para modificar el saldo de retornables de un cliente
export const modificarSaldoRetornables = async (
  clienteId,
  cantidadCambio,
  codigoEmpresa
) => {
  console.log("Modificando saldo de retornables:", {
    clienteId,
    cantidadCambio,
    codigoEmpresa,
  });
  return new Promise((resolve, reject) => {
    // cantidadCambio puede ser positivo (entrega) o negativo (devolución)
    const query = `
      UPDATE clientes 
      SET retornables = IFNULL(retornables, 0) + ? 
      WHERE codigo = ? AND codigoEmpresa = ?
    `;
    const params = [cantidadCambio, clienteId, codigoEmpresa];

    console.log("Ejecutando consulta UPDATE retornables:", query);
    console.log("Con parámetros:", params);

    connection.query(query, params, (err, result) => {
      if (err) {
        console.error("Error en modificarSaldoRetornables:", err);
        reject(err);
        return;
      }
      if (result.affectedRows === 0) {
        console.warn(
          "No se encontró el cliente para actualizar retornables:",
          clienteId,
          codigoEmpresa
        );
        // Podríamos considerar esto un error dependiendo del flujo
        reject(new Error("Cliente no encontrado para actualizar retornables."));
        return;
      }
      console.log(
        "Saldo de retornables modificado correctamente:",
        result.affectedRows
      );
      resolve(result);
    });
  });
};

// Nueva función para marcar cliente como inactivo (borrado lógico)
export const marcarClienteComoInactivo = async (
  codigoCliente,
  codigoEmpresa
) => {
  console.log("Marcando cliente como inactivo:", {
    codigoCliente,
    codigoEmpresa,
  });
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE clientes 
      SET activo = 0 
      WHERE codigo = ? AND codigoEmpresa = ? AND activo = 1
    `;
    const params = [codigoCliente, codigoEmpresa];

    console.log("Ejecutando consulta UPDATE activo=0:", query);
    console.log("Con parámetros:", params);

    connection.query(query, params, (err, result) => {
      if (err) {
        console.error("Error en marcarClienteComoInactivo:", err);
        reject(err);
        return;
      }
      if (result.affectedRows === 0) {
        console.warn(
          "No se encontró el cliente activo para marcar como inactivo:",
          codigoCliente,
          codigoEmpresa
        );
        // Considerar esto un error si se esperaba que el cliente existiera y estuviera activo
        reject(new Error("Cliente no encontrado o ya estaba inactivo."));
        return;
      }
      console.log(
        "Cliente marcado como inactivo correctamente:",
        result.affectedRows
      );
      resolve(result);
    });
  });
};
