const handleCancelacion = (bot, chatId) => {
  bot.sendMessage(chatId, "❌ Operación cancelada.");
  endConversation(chatId);
  return true;
};

export default handleCancelacion;
