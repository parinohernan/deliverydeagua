# DeliveryDeAgua_BOT - Bot de Telegram para Gestión de Pedidos

DeliveryDeAgua_BOT es un bot de Telegram diseñado para ayudar en la gestión de pedidos, clientes y cobros. Este bot permite a los usuarios realizar diversas operaciones como crear clientes, cargar pedidos, listar pedidos, generar resúmenes y registrar cobros.

## Características

- **Gestión de Clientes**: Crear y consultar clientes.
- **Gestión de Pedidos**: Cargar nuevos pedidos y listar pedidos pendientes.
- **Cobros**: Registrar cobros y marcar pedidos como pagados.
- **Informes**: Generar resúmenes de pedidos y ventas.

## Requisitos

- Node.js (versión 14 o superior)
- MySQL
- Una cuenta de bot de Telegram y su token

## Instalación

1. Clona el repositorio:

   ```bash
   git clone https://github.com/tu_usuario/deliverydeagua.git
   cd DeliveryDeAgua_BOT/telegram-bot
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Configura la base de datos:

   - Asegúrate de tener una base de datos MySQL configurada.
   - Encontraras la estructura de la base de datos en el archivo `database/database.sql`.
   - Crea las tablas necesarias para `clientes`, `pedidos`, y `vendedores`.

4. Configura las variables de entorno:

   - Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:
     ```plaintext
     DB_USER=tu_usuario
     DB_HOST=tu_host
     DB_NAME=tu_base_de_datos
     DB_PASSWORD=tu_contraseña
     TELEGRAM_TOKEN=tu_token_de_telegram
     ```

5. Inicia el bot:

   ```bash
   npm start
   ```

## Testeo

para probar el bot, puedes buscar en telegram a @deliverydeagua_bot y empezar a usarlo.
al ser MULTIEMPRESA, cualquier usuario nuevo administrara la empresa de TESTING.

## Uso

- **Comandos Disponibles**:
  - `/start` o `/menu`: Muestra el menú principal.
  - `/crearcliente`: Inicia el proceso para crear un nuevo cliente.
  - `/consultarcliente`: Busca clientes existentes.
  - `/cargarpedido`: Inicia el proceso para cargar un nuevo pedido.
  - `/listarpedidos`: Lista los pedidos pendientes.
  - `/resumen`: Genera informes de pedidos.
  - `/cobros`: Inicia el proceso para registrar un cobro.
  - `/cancelar`: Cancela la operación actual.

## Estructura del Proyecto

- **commands/**: Contiene los comandos del bot.
- **database/**: Contiene la configuración de la base de datos y las consultas SQL.
- **handlers/**: Contiene los manejadores de comandos y conversaciones.
- **config.js**: Configuración del bot y la base de datos.
- **index.js**: Punto de entrada principal del bot.

## Contribución

1. Haz un fork del proyecto.
2. Crea una nueva rama (`git checkout -b feature/nueva-funcionalidad`).
3. Realiza tus cambios y haz commit (`git commit -am 'Agrega nueva funcionalidad'`).
4. Haz push a la rama (`git push origin feature/nueva-funcionalidad`).
5. Abre un Pull Request.

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

## Contacto

Si tienes alguna pregunta o sugerencia, puedes contactarme a través de mi correo electrónico:

- [Correo Electrónico](mailto:parinohernan@gmail.com)
