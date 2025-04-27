// Almacén de estados de conversación
export const conversations = new Map();

export const startConversation = (chatId, command) => {
  conversations.set(chatId, {
    command,
    step: 0,
    data: {},
  });
  console.log(
    `Conversación iniciada para chatId: ${chatId}, comando: ${command}`
  );
};

export const getConversationState = (chatId) => {
  const state = conversations.get(chatId);
  console.log(
    `getConversationState para chatId: ${chatId}, estado encontrado: ${!!state}, step: ${
      state?.step
    }`
  );
  return state;
};

export const nextStep = (chatId, step) => {
  const state = conversations.get(chatId);
  if (!state) {
    console.log(`nextStep: No se encontró estado para chatId: ${chatId}`);
    return;
  }

  const oldStep = state.step;
  if (step) {
    state.step = step;
  } else {
    state.step += 1;
  }
  console.log(
    `nextStep: chatId: ${chatId}, paso anterior: ${oldStep}, nuevo paso: ${state.step}`
  );
};

export const endConversation = (chatId) => {
  console.log(`Finalizando conversación para chatId: ${chatId}`);
  conversations.delete(chatId);
};

export const updateConversationState = (chatId, newState) => {
  const state = conversations.get(chatId);
  if (!state) {
    console.log(
      `updateConversationState: No se encontró estado para chatId: ${chatId}`
    );
    return false;
  }

  conversations.set(chatId, newState);
  console.log(
    `Estado actualizado para chatId: ${chatId}, nuevo step: ${newState.step}`
  );
  return true;
};

export const deleteConversationState = (chatId) => {
  console.log(`Eliminando estado de conversación para chatId: ${chatId}`);
  return conversations.delete(chatId);
};
