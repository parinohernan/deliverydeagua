// Almacén de estados de conversación
const conversations = new Map();

export const startConversation = (chatId, command) => {
  conversations.set(chatId, {
    command,
    step: 0,
    data: {},
  });
};

export const getConversationState = (chatId) => {
  return conversations.get(chatId);
};

export const nextStep = (chatId) => {
  const state = conversations.get(chatId);
  if (state) {
    state.step += 1;
  }
};

export const endConversation = (chatId) => {
  conversations.delete(chatId);
};
