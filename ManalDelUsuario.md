# Manual del Usuario - Janus Delivery Manager

## Contenido

1. [Introducción](#introducción)
2. [Comandos Principales](#comandos-principales)
3. [Cómo Cargar un Pedido](#cómo-cargar-un-pedido)
4. [Cobros](#cobros)
5. [Gestión de Clientes](#gestión-de-clientes)
6. [Reportes y Resúmenes](#reportes-y-resúmenes)

## Introducción

Bienvenido al sistema Janus Delivery Manager, una herramienta diseñada para facilitar la gestión de pedidos, entregas y cobros a través de un bot de Telegram. Este manual le guiará a través de las distintas funcionalidades del sistema.

## Comandos Principales

El sistema cuenta con los siguientes comandos principales:

- `/start` - Inicia el bot y muestra el menú principal
- `/menu` - Muestra el menú principal
- `/ayuda` - Muestra información de ayuda
- `/cargarPedido` - Inicia el proceso de carga de un nuevo pedido
- `/cobros` - Accede al módulo de gestión de cobros
- `/listarpedidos` - Muestra los pedidos existentes
- `/resumen` - Muestra un resumen de la actividad

## Cómo Cargar un Pedido

El proceso de carga de pedidos le permite registrar nuevas órdenes de clientes de manera rápida y eficiente. Siga estos pasos para completar el proceso:

### 1. Iniciar el Proceso

Para iniciar el proceso de carga de un pedido, puede:

- Escribir el comando `/cargarPedido`
- O presionar el botón "📝 Cargar Pedido" en el menú principal

### 2. Seleccionar Cliente

Después de iniciar el proceso, el sistema le solicitará seleccionar un cliente:

1. Escriba parte del nombre o apellido del cliente para buscarlo
2. Se mostrará una lista de clientes que coincidan con su búsqueda
3. Seleccione el cliente haciendo clic en su nombre en la lista

> **Nota**: Si no encuentra al cliente deseado, puede intentar con otra búsqueda o crear un nuevo cliente usando la opción "🆕 Nuevo Cliente" desde el menú principal.

### 3. Seleccionar Productos

Una vez seleccionado el cliente, el sistema le permitirá elegir los productos para el pedido:

- Si hay pocos productos (menos de 10), se mostrarán todos directamente para seleccionar
- Si hay muchos productos, podrá buscar por nombre:
  1. Escriba parte del nombre del producto para buscarlo
  2. Se mostrarán los productos que coincidan con su búsqueda
  3. Seleccione el producto deseado haciendo clic en él

### 4. Indicar Cantidad

Después de seleccionar un producto, debe indicar la cantidad:

1. Puede seleccionar directamente las cantidades 1-6 usando los botones numéricos
2. O seleccionar "📝 Otra cantidad" para ingresar manualmente otro valor
3. Después de ingresar la cantidad, el producto se agregará al pedido

### 5. Continuar o Finalizar

Después de agregar un producto, tiene las siguientes opciones:

- **Agregar más productos**: Seleccione "➕ Agregar más productos" para continuar añadiendo artículos al pedido
- **Finalizar Pedido**: Seleccione "✅ Finalizar Pedido" cuando haya terminado de agregar todos los productos

También puede seleccionar "🏁 Terminar Pedido" en cualquier momento durante la selección de productos.

### 6. Asignar Zona de Reparto (Opcional)

Si su empresa tiene habilitada la opción de reparto por zonas, después de finalizar el pedido, se le solicitará asignar una zona:

- **Seleccionar zona existente**: Seleccione una de las zonas disponibles en los botones que se muestran
- **Crear nueva zona**: Escriba el nombre de una nueva zona de reparto
- **Sin zona**: Seleccione "⏭️ Continuar sin asignar zona" para finalizar sin especificar una zona

> **Nota**: Las zonas de reparto ayudan a organizar las entregas por áreas geográficas, lo que facilita la planificación de rutas y la asignación de repartidores.

### 7. Programar Entrega (Opcional)

Si su empresa tiene habilitada la opción de entregas programadas, después de finalizar el pedido (o después de asignar una zona si esa opción también está habilitada), podrá:

- **Programar una entrega**: Ingrese la fecha y hora en formato DD/MM/YYYY HH:MM (ej: 28/04/2025 10:00)
- **Continuar sin programar**: Seleccione "⏭️ Continuar sin programar entrega" para finalizar sin especificar una fecha

> **Importante**: La fecha de entrega programada debe ser una fecha futura válida.

### 8. Confirmación del Pedido

Al finalizar, el sistema le mostrará un resumen del pedido que incluye:

- Número de pedido asignado
- Cliente seleccionado
- Lista detallada de productos con cantidades y precios
- Monto total del pedido
- Zona de reparto (si se especificó)
- Fecha de entrega programada (si se especificó)

### Cancelar un Pedido en Proceso

Puede cancelar el proceso de carga de pedido en cualquier momento:

- Escribiendo `/cancelar`
- Seleccionando el botón "❌ Cancelar"

### Resolución de Problemas Comunes

- **No se encuentra el cliente**: Intente con diferentes variantes del nombre o use solo el apellido
- **No se encuentra el producto**: Verifique que esté escribiendo correctamente el nombre o use términos más generales
- **Error en fecha programada**: Asegúrese de usar el formato correcto (DD/MM/YYYY HH:MM) y que la fecha sea futura

## Cobros

[Contenido pendiente]

## Gestión de Clientes

[Contenido pendiente]

## Reportes y Resúmenes

[Contenido pendiente]
