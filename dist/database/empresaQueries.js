import { connection } from "./connection.js";

// Cache para almacenar datos de empresas y evitar consultas repetidas
const empresasCache = new Map();

export const getEmpresa = (codigoEmpresa) => {
  return new Promise((resolve, reject) => {
    // Verificar si la empresa está en cache
    if (empresasCache.has(codigoEmpresa)) {
      resolve(empresasCache.get(codigoEmpresa));
      return;
    }

    const query = `
      SELECT 
        codigo,
        razonSocial
      FROM empresa 
      WHERE codigo = ?
    `;

    connection.query(query, [codigoEmpresa], (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      if (results.length === 0) {
        resolve({
          codigo: codigoEmpresa,
          razonSocial: "Empresa no encontrada",
          nombreFantasia: "",
        });
        return;
      }

      const empresa = results[0];
      // Guardar en cache
      empresasCache.set(codigoEmpresa, empresa);
      resolve(empresa);
    });
  });
};

// Función para limpiar el cache (útil si los datos de la empresa se actualizan)
export const clearEmpresaCache = () => {
  empresasCache.clear();
};
