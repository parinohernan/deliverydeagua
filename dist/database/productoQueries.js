import { connection } from "./connection.js";

export const agregarProducto = async (producto) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO productos (descripcion, precio, stock, codigoEmpresa, activo, esRetornable)
      VALUES (?,?,?,?,1,0)
    `;
    connection.query(
      query,
      [
        producto.descripcion,
        producto.precio,
        producto.stock,
        producto.codigoEmpresa,
      ],
      (err, results) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(results);
      }
    );
  });
};

export const modificarProducto = async (producto) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE productos
      SET descripcion = ?, precio = ?, stock = ?
      WHERE codigo = ?
    `;
    connection.query(
      query,
      [producto.descripcion, producto.precio, producto.stock, producto.codigo],
      (err, results) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(results);
      }
    );
  });
};

export const eliminarProducto = async (codigo) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE productos
      SET activo = 0
      WHERE codigo = ?
    `;
    connection.query(query, [codigo], (err, results) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(results);
    });
  });
};

export const listarProductos = async (codigoEmpresa) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT codigo, descripcion, precio, stock
      FROM productos
      WHERE codigoEmpresa = ${codigoEmpresa}
      AND activo = 1
    `;
    connection.query(query, (err, results) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(results);
    });
  });
};
