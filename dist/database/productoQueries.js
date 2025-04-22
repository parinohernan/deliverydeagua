import { connection } from "./connection.js";

export const agregarProducto = async (producto) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO productos (nombre, precio, activo)
      VALUES (?, ?, 1)
    `;
    connection.query(
      query,
      [producto.nombre, producto.precio],
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
      SET nombre = ?, precio = ?
      WHERE codigo = ?
    `;
    connection.query(
      query,
      [producto.nombre, producto.precio, producto.codigo],
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

export const listarProductos = async () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT codigo, nombre, precio
      FROM productos
      WHERE activo = 1
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
