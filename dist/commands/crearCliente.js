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
    console.log(
      `[crearCliente] Iniciando creación de cliente para chatId: ${chatId}`
    );

    // Verificar si ya existe una conversación y terminarla
    const existingState = getConversationState(chatId);
    if (existingState) {
      console.log(
        `[crearCliente] Terminando conversación existente: ${existingState.command}, step: ${existingState.step}`
      );
      endConversation(chatId);
    }

    startConversation(chatId, "crearCliente");
    const state = getConversationState(chatId);
    if (!state) {
      throw new Error("No se pudo iniciar la conversación");
    }

    // Inicializar datos vacíos
    state.data = {};

    console.log(
      `[crearCliente] Conversación iniciada: command=${state.command}, step=${state.step}`
    );
    bot.sendMessage(chatId, "Por favor, ingresa el nombre del cliente:");
  } catch (error) {
    console.error(`[crearCliente] Error:`, error);
    bot.sendMessage(chatId, `Error al crear cliente: ${error.message}`);
  }
};

// Manejador de respuestas para crear cliente
export const handleCrearClienteResponse = (bot, msg) => {
  const chatId = msg.chat.id;
  const state = getConversationState(chatId);

  if (!state || state.command !== "crearCliente") {
    console.log(
      `[handleCrearClienteResponse] No hay estado válido para chatId: ${chatId}`
    );
    return false;
  }

  const text = msg.text;
  console.log(
    `[handleCrearClienteResponse] Procesando respuesta para step ${state.step}: "${text}"`
  );

  if (text?.toLowerCase() === "/cancelar") {
    console.log(
      `[handleCrearClienteResponse] Cancelando creación de cliente para chatId: ${chatId}`
    );
    bot.sendMessage(chatId, "❌ Operación cancelada");
    endConversation(chatId);
    return true;
  }

  let validationResult;

  switch (state.step) {
    case STEPS.NOMBRE:
      validationResult = validate(text, ValidationTypes.TEXT);
      if (!validationResult.isValid) {
        console.log(
          `[handleCrearClienteResponse] Nombre inválido: ${validationResult.error}`
        );
        bot.sendMessage(
          chatId,
          `❌ Nombre inválido: ${validationResult.error}`
        );
        return true;
      }
      state.data.nombre = sanitize(text, ValidationTypes.TEXT);
      console.log(
        `[handleCrearClienteResponse] Nombre válido: "${state.data.nombre}", avanzando al siguiente paso`
      );
      nextStep(chatId);
      bot.sendMessage(chatId, "Ingresa el apellido:");
      break;

    case STEPS.APELLIDO:
      validationResult = validate(text, ValidationTypes.TEXT);
      if (!validationResult.isValid) {
        console.log(
          `[handleCrearClienteResponse] Apellido inválido: ${validationResult.error}`
        );
        bot.sendMessage(
          chatId,
          `❌ Apellido inválido: ${validationResult.error}`
        );
        return true;
      }
      state.data.apellido = sanitize(text, ValidationTypes.TEXT);
      console.log(
        `[handleCrearClienteResponse] Apellido válido: "${state.data.apellido}", avanzando al siguiente paso`
      );
      nextStep(chatId);
      bot.sendMessage(chatId, "Ingresa la dirección:");
      break;

    case STEPS.DIRECCION:
      validationResult = validate(text, ValidationTypes.ADDRESS);
      if (!validationResult.isValid) {
        console.log(
          `[handleCrearClienteResponse] Dirección inválida: ${validationResult.error}`
        );
        bot.sendMessage(
          chatId,
          `❌ Dirección inválida: ${validationResult.error}`
        );
        return true;
      }
      state.data.direccion = sanitize(text, ValidationTypes.ADDRESS);
      console.log(
        `[handleCrearClienteResponse] Dirección válida: "${state.data.direccion}", avanzando al siguiente paso`
      );
      nextStep(chatId);
      bot.sendMessage(chatId, "Ingresa el teléfono:");
      break;

    case STEPS.TELEFONO:
      validationResult = validate(text, ValidationTypes.PHONE);
      if (!validationResult.isValid) {
        console.log(
          `[handleCrearClienteResponse] Teléfono inválido: ${validationResult.error}`
        );
        bot.sendMessage(
          chatId,
          `❌ Teléfono inválido: ${validationResult.error}`
        );
        return true;
      }
      state.data.telefono = sanitize(text, ValidationTypes.PHONE);
      console.log(
        `[handleCrearClienteResponse] Teléfono válido: "${state.data.telefono}", guardando cliente en BD`
      );

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

      console.log(
        `[handleCrearClienteResponse] Ejecutando query para guardar cliente de empresa ${msg.vendedor.codigoEmpresa}`
      );
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
            console.error(
              `[handleCrearClienteResponse] Error al guardar cliente:`,
              err
            );
            bot.sendMessage(
              chatId,
              `Error al crear el cliente: ${err.message}`
            );
          } else {
            console.log(
              `[handleCrearClienteResponse] Cliente guardado exitosamente con ID: ${result.insertId}`
            );
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
