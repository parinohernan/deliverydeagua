import mysql from "mysql2";
import config from "../config.js";

export const connection = mysql.createConnection(config.database);

const connectToDatabase = () => {
  connection.connect((err) => {
    if (err) {
      console.error("Error conectando a la base de datos:", err);
      return;
    }
    console.log("Conectado a la base de datos MySQL");
  });
};

export default connectToDatabase;
