import {
  agregarProducto,
  modificarProducto,
  eliminarProducto,
  listarProductos,
} from "../database/productoQueries.js";
import {
  startConversation,
  getConversationState,
  nextStep,
  endConversation,
} from "../handlers/conversationHandler.js";
import { mostrarMenuPrincipal } from "../handlers/commandHandler.js";
import { parse } from "dotenv";

export const productos = async (bot, msg) => {
  const chatId = msg.chat.id;
  // Iniciar conversación de mercadería usando el sistema global
  startConversation(chatId, "gestionProductos");
  bot.sendMessage(
    chatId,
    "🛒 Gestión de Productos\n\nElige una opción:\n1️⃣. Lista de Productos y stock\n2️⃣. Crear nuevo producto\n3️⃣. Modificar Producto\n4️⃣. Eliminar Producto\n\n",
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [["1️⃣", "2️⃣", "3️⃣", "4️⃣"], ["📱 Menu Principal"]],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    }
  );
};

export const handleProductosResponse = async (bot, msg) => {
  const chatId = msg.chat.id;
  // Obtener el estado de la conversación global
  const state = getConversationState(chatId);
  if (!state || state.command !== "gestionProductos") return false;

  const texto = msg.text;
  // Verificar si el usuario quiere cancelar
  if (texto?.toLowerCase() === "/cancelar") {
    bot.sendMessage(chatId, "❌ Operacion cancelada");
    endConversation(chatId);
    return true;
  }

  if (texto === "📱 Menu Principal") {
    mostrarMenuPrincipal(bot, chatId, msg.vendedor);
    endConversation(chatId);
    return true;
  }
  if (texto === "⏪ Atrás") {
    // const state = getConversationState(chatId);
    // if (state && state.step > 0) {
    //   bot.sendMessage(chatId, "Regresando al paso anterior...");
    //   state.step -= 1; // Retrocede un paso
    // } else {
    //   bot.sendMessage(chatId, "Regresando al menú de productos...");
    // }
    state.step = 0; // Reinicia el paso a 0
    productos(bot, msg); // Si no hay pasos anteriores, vuelve a mostrar el menú de productos
    return true;
  }
  try {
    switch (state.step) {
      case 0: // Selección de acción
        if (texto === "1" || texto === "1️⃣") {
          const productos = await listarProductos(msg.vendedor.codigoEmpresa);
          let mensaje = "Productos:\n\n";
          if (productos.length) {
            productos.forEach((producto) => {
              mensaje += `▫${producto.descripcion}-$${producto.precio}-${producto.stock}Uds\n`;
            });
          } else {
            mensaje = "No hay productos registrados.";
          }
          bot.sendMessage(chatId, mensaje, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          });
          break; // Salir del switch para evitar que continúe a la siguiente opción
        } else if (texto === "2" || texto === "2️⃣") {
          bot.sendMessage(chatId, "Ingresa el nombre del nuevo producto:", {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          });
          nextStep(chatId);
          break; // Salir del switch para evitar que continúe a la siguiente opción
        } else if (texto === "3" || texto === "3️⃣") {
          const productos = await listarProductos(msg.vendedor.codigoEmpresa);
          let mensaje = "Productos disponibles:\n\n";
          if (productos.length) {
            productos.forEach((producto) => {
              mensaje += `▫Cod:${producto.codigo}: ${producto.descripcion}-$${producto.precio}\n-${producto.stock}Uds\n`;
            });
            mensaje += "\nIngresa el código del producto a modificar:";
          } else {
            mensaje += "No hay productos registrados.";
          }
          bot.sendMessage(chatId, mensaje, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          });
          nextStep(chatId, 4);
          break; // Salir del switch para evitar que continúe a la siguiente opción
        } else if (texto === "4" || texto === "4️⃣") {
          const productos = await listarProductos(msg.vendedor.codigoEmpresa);
          let mensaje = "Productos disponibles:\n\n";
          if (productos.length) {
            productos.forEach((producto) => {
              mensaje += `▫Cod:${producto.codigo}: ${producto.descripcion}-$${producto.precio}\n-${producto.stock}Uds\n`;
            });
            mensaje += "\nIngresa el código del producto a Eliminar:";
          } else {
            mensaje += "No hay productos registrados.";
          }
          bot.sendMessage(chatId, mensaje, {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          });
          nextStep(chatId, 8);
          break; // Salir del switch para evitar que continúe a la siguiente opción
        } else {
          bot.sendMessage(chatId, "Opción no válida. Intenta nuevamente.");
        }
        break; // Salir del switch para evitar que continúe a la siguiente opción

      case 1: // Crear producto - descripción
        state.data = {
          descripcion: texto,
          codigoEmpresa: msg.vendedor.codigoEmpresa,
        };
        bot.sendMessage(chatId, "Ingresa el precio del producto:");
        nextStep(chatId);
        break; // Salir del switch para evitar que continúe a la siguiente opción

      case 2: // Crear producto - Precio
        const precio = parseFloat(texto);
        if (isNaN(precio) || precio <= 0) {
          bot.sendMessage(
            chatId,
            "❌ Precio inválido. Por favor, ingresa un número mayor a 0.",
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            }
          );
          return true;
        }
        state.data.precio = precio;
        bot.sendMessage(chatId, "Ingresa el stock del producto:");
        nextStep(chatId);
        break;

      case 3: // Crear producto - Stock
        const stock = parseInt(texto);
        if (isNaN(stock) || stock < 0) {
          bot.sendMessage(
            chatId,
            "❌ Stock inválido. Por favor, ingresa un número mayor o igual a 0.",
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            }
          );
          return true;
        }
        state.data.stock = stock;
        // Guardar el producto en la base de datos
        await agregarProducto(state.data);
        bot.sendMessage(
          chatId,
          `✅ Producto "${state.data.descripcion}" creado exitosamente con precio $${state.data.precio} y stock ${state.data.stock}.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          }
        );
        return true;

      case 4: // Modificar producto - Descripción
        const codigoModificar = parseInt(texto);
        if (isNaN(codigoModificar)) {
          bot.sendMessage(chatId, "❌ Código inválido. Intenta nuevamente.", {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          });
          return true;
        }
        state.data.codigo = codigoModificar;
        bot.sendMessage(chatId, "Ingresa la nueva descripción del producto:", {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        });
        nextStep(chatId);
        return true;
      case 5: // Modificar producto - Descripción
        const nuevaDescripcion = texto;
        if (
          !nuevaDescripcion ||
          nuevaDescripcion.trim() === "" ||
          nuevaDescripcion.length < 3
        ) {
          bot.sendMessage(
            chatId,
            "❌ Descripción inválida. Debe ser mayor a tres letras. Intenta nuevamente.",
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            }
          );
          return true;
        }
        if (parseFloat(nuevaDescripcion)) {
          bot.sendMessage(
            chatId,
            "❌ Descripción inválida. No puede ser un número.",
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            }
          );
          return true;
        }
        state.data.descripcion = nuevaDescripcion;
        bot.sendMessage(chatId, "Ingresa el nuevo precio del producto:");
        nextStep(chatId);
        return true;
      case 6: // Modificar producto - Precio
        const nuevoPrecio = parseFloat(texto);
        if (isNaN(nuevoPrecio) || nuevoPrecio <= 0) {
          bot.sendMessage(
            chatId,
            "❌ Precio inválido. Por favor, ingresa un número mayor a 0.",
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            }
          );
          return true;
        }
        state.data.precio = nuevoPrecio;
        bot.sendMessage(chatId, "Ingresa el nuevo stock del producto:", {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        });
        nextStep(chatId);
        return true;
      case 7: // Modificar producto - Stock
        const nuevoStock = parseInt(texto);
        if (isNaN(nuevoStock) || nuevoStock < 0) {
          bot.sendMessage(
            chatId,
            "❌ Stock inválido. Por favor, ingresa un número mayor o igual a 0.",
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            }
          );
          return true;
        }
        state.data.stock = nuevoStock;
        await modificarProducto(state.data);
        bot.sendMessage(
          chatId,
          `✅ Producto "${state.data.descripcion}" modificado exitosamente con nuevo precio $${state.data.precio} y stock ${state.data.stock}.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          }
        );
        return true;
      case 8: // Eliminar producto - Código
        const codigoEliminar = parseInt(texto);
        if (isNaN(codigoEliminar)) {
          bot.sendMessage(chatId, "❌ Código inválido. Intenta nuevamente.", {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          });
          return true;
        }
        state.data.codigo = codigoEliminar;
        bot.sendMessage(
          chatId,
          `¿Estás seguro de que deseas eliminar el producto con código ${codigoEliminar}?.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                ["Sí", "No"],
                ["⏪ Atrás", "📱 Menu Principal"],
              ],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          }
        );
        nextStep(chatId);
        return true;
      case 9: // Confirmar eliminación
        if (texto.toLowerCase() === "sí") {
          await eliminarProducto(state.data.codigo);
          bot.sendMessage(
            chatId,
            `✅ Producto con código ${state.data.codigo} eliminado exitosamente.`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            }
          );
        } else {
          bot.sendMessage(chatId, "❌ Operación cancelada.", {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
              resize_keyboard: true,
              one_time_keyboard: false,
            },
          });
        }
        return true;
      default: // Manejar caso por defecto
        bot.sendMessage(chatId, "Opción no válida. Intenta nuevamente.", {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [["⏪ Atrás", "📱 Menu Principal"]],
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        });
        break; // Salir del switch para evitar que continúe a la siguiente opción
    }
  } catch (error) {
    console.error("Error en mercadería:", error);
    bot.sendMessage(
      chatId,
      "❌ Ocurrió un error al procesar la solicitud. Por favor, intenta nuevamente."
    );
    endConversation(chatId);
    return true;
  }

  return false;
};
