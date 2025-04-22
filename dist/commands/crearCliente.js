import { connection } from "../database/connection.js";
import {
  startConversation,
  getConversationState,
  nextStep,
  endConversation,
} from "../handlers/conversationHandler.js";
import { validate, ValidationTypes, sanitize } from "../utils/validations.js";

const STEPS = {
  NOMBRE: 0,
  APELLIDO: 1,
  DIRECCION: 2,
  TELEFONO: 3,
};

export const crearCliente = async (bot, msg) => {
  const chatId = msg.chat.id;

  try {
    startConversation(chatId, "crearCliente");
    bot.sendMessage(chatId, "Por favor, ingresa el nombre del cliente:");
  } catch (error) {
    bot.sendMessage(chatId, `Error al crear cliente: ${error.message}`);
  }
};

// Manejador de respuestas para crear cliente
export const handleCrearClienteResponse = (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);

  if (!state || state.command !== "crearCliente") return false;

  const text = msg.text;

  if (text?.toLowerCase() === "/cancelar") {
    bot.sendMessage(chatId, "❌ Operación cancelada");
    endConversation(chatId);
    return true;
  }

  let validationResult;

  switch (state.step) {
    case STEPS.NOMBRE:
      validationResult = validate(text, ValidationTypes.TEXT);
      if (!validationResult.isValid) {
        bot.sendMessage(
          chatId,
          `❌ Nombre inválido: ${validationResult.error}`
        );
        return true;
      }
      state.data.nombre = sanitize(text, ValidationTypes.TEXT);
      nextStep(chatId);
      bot.sendMessage(chatId, "Ingresa el apellido:");
      break;

    case STEPS.APELLIDO:
      validationResult = validate(text, ValidationTypes.TEXT);
      if (!validationResult.isValid) {
        bot.sendMessage(
          chatId,
          `❌ Apellido inválido: ${validationResult.error}`
        );
        return true;
      }
      state.data.apellido = sanitize(text, ValidationTypes.TEXT);
      nextStep(chatId);
      bot.sendMessage(chatId, "Ingresa la dirección:");
      break;

    case STEPS.DIRECCION:
      validationResult = validate(text, ValidationTypes.ADDRESS);
      if (!validationResult.isValid) {
        bot.sendMessage(
          chatId,
          `❌ Dirección inválida: ${validationResult.error}`
        );
        return true;
      }
      state.data.direccion = sanitize(text, ValidationTypes.ADDRESS);
      nextStep(chatId);
      bot.sendMessage(chatId, "Ingresa el teléfono:");
      break;

    case STEPS.TELEFONO:
      validationResult = validate(text, ValidationTypes.PHONE);
      if (!validationResult.isValid) {
        bot.sendMessage(
          chatId,
          `❌ Teléfono inválido: ${validationResult.error}`
        );
        return true;
      }
      state.data.telefono = sanitize(text, ValidationTypes.PHONE);

      // Guardar cliente en la base de datos
      const query = `
        INSERT INTO clientes (
          codigoEmpresa, 
          nombre, 
          apellido, 
          direccion, 
          telefono
        ) VALUES (?, ?, ?, ?, ?)
      `;

      connection.query(
        query,
        [
          msg.vendedor.codigoEmpresa,
          state.data.nombre,
          state.data.apellido,
          state.data.direccion,
          state.data.telefono,
        ],
        (err, result) => {
          if (err) {
            bot.sendMessage(
              chatId,
              `Error al crear el cliente: ${err.message}`
            );
          } else {
            bot.sendMessage(
              chatId,
              `✅ Cliente creado exitosamente!\nCódigo: ${result.insertId}`
            );
          }
          endConversation(chatId);
        }
      );
      break;
  }

  return true;
};

export default crearCliente;
