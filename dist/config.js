import dotenv from "dotenv";
dotenv.config();

const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
  },
  database: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
};

export default config;
