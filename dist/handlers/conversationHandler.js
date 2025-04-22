// Almacén de estados de conversación
export const conversations = new Map();

export const startConversation = (chatId, command) => {
  conversations.set(chatId, {
    command,
    step: 0,
    data: {},
  });
};

export const getConversationState = (chatId) => {
  console.log("conversations.get(chatId):", conversations.get(chatId));
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
