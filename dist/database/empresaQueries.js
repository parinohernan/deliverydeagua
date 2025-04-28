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
        razonSocial,
        imageURL,
        textoInfo,
        plan,
        fechaAlta,
        fechaVencimiento,
        usaEntregaProgramada,
        usaRepartoPorZona
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
          imageURL:
            "https://res.cloudinary.com/drgs7xuag/image/upload/f_auto,q_auto/v1/recursos/edelecjhmeytkyc6ws14.png",
          textoInfo: "",
          plan: "Free",
          fechaVencimiento: null,
          UsaEntregaProgramada: 0,
        });
        return;
      }

      const empresa = results[0];

      // Convertir campos de buffer a valores numéricos
      if (Buffer.isBuffer(empresa.usaEntregaProgramada)) {
        empresa.usaEntregaProgramada = empresa.usaEntregaProgramada[0];
      }

      if (Buffer.isBuffer(empresa.usaRepartoPorZona)) {
        empresa.usaRepartoPorZona = empresa.usaRepartoPorZona[0];
      }

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
