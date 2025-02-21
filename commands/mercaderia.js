import {
  agregarProducto,
  modificarProducto,
  eliminarProducto,
  listarProductos,
} from "../database/productoQueries.js";

let conversacionesMercaderia = {};

export const mercaderia = async (bot, msg) => {
  const chatId = msg.chat.id;

  // Iniciar conversación de mercadería
  conversacionesMercaderia[chatId] = {
    paso: 1,
    producto: null,
  };

  bot.sendMessage(
    chatId,
    "🛒 Gestión de Mercadería\n\nElige una opción:\n1. Cargar Producto\n2. Modificar Producto\n3. Eliminar Producto\n\nResponde con el número de la opción.",
    {
      parse_mode: "Markdown",
    }
  );
};

export const handleMercaderiaResponse = async (bot, msg) => {
  const chatId = msg.chat.id;
  if (!conversacionesMercaderia[chatId]) return false;

  const conversacion = conversacionesMercaderia[chatId];
  const texto = msg.text;

  try {
    switch (conversacion.paso) {
      case 1: // Selección de acción
        if (texto === "1") {
          bot.sendMessage(chatId, "Ingresa el nombre del nuevo producto:");
          conversacion.paso = 2;
        } else if (texto === "2") {
          const productos = await listarProductos();
          let mensaje = "*Productos disponibles:*\n\n";
          productos.forEach((producto) => {
            mensaje += `*${producto.codigo}* - ${producto.nombre} - $${producto.precio}\n`;
          });
          mensaje += "\nIngresa el código del producto a modificar:";
          bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown" });
          conversacion.paso = 3;
        } else if (texto === "3") {
          const productos = await listarProductos();
          let mensaje = "*Productos disponibles:*\n\n";
          productos.forEach((producto) => {
            mensaje += `*${producto.codigo}* - ${producto.nombre} - $${producto.precio}\n`;
          });
          mensaje += "\nIngresa el código del producto a eliminar:";
          bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown" });
          conversacion.paso = 5;
        } else {
          bot.sendMessage(chatId, "Opción no válida. Intenta nuevamente.");
        }
        return true;

      case 2: // Cargar producto
        conversacion.producto = { nombre: texto };
        bot.sendMessage(chatId, "Ingresa el precio del producto:");
        conversacion.paso = 6;
        return true;

      case 3: // Modificar producto - Selección
        const productoModificar = await listarProductos(texto);
        if (!productoModificar) {
          bot.sendMessage(
            chatId,
            "Código de producto inválido. Intenta nuevamente."
          );
          return true;
        }
        conversacion.producto = productoModificar;
        bot.sendMessage(chatId, "Ingresa el nuevo nombre del producto:");
        conversacion.paso = 4;
        return true;

      case 4: // Modificar producto - Nombre
        conversacion.producto.nombre = texto;
        bot.sendMessage(chatId, "Ingresa el nuevo precio del producto:");
        conversacion.paso = 7;
        return true;

      case 5: // Eliminar producto
        await eliminarProducto(texto);
        bot.sendMessage(chatId, "Producto eliminado lógicamente.");
        delete conversacionesMercaderia[chatId];
        return true;

      case 6: // Cargar producto - Precio
        conversacion.producto.precio = parseFloat(texto);
        await agregarProducto(conversacion.producto);
        bot.sendMessage(chatId, "Producto cargado exitosamente.");
        delete conversacionesMercaderia[chatId];
        return true;

      case 7: // Modificar producto - Precio
        conversacion.producto.precio = parseFloat(texto);
        await modificarProducto(conversacion.producto);
        bot.sendMessage(chatId, "Producto modificado exitosamente.");
        delete conversacionesMercaderia[chatId];
        return true;
    }
  } catch (error) {
    console.error("Error en mercadería:", error);
    bot.sendMessage(
      chatId,
      "❌ Ocurrió un error al procesar la solicitud. Por favor, intenta nuevamente."
    );
    delete conversacionesMercaderia[chatId];
    return true;
  }

  return false;
};
