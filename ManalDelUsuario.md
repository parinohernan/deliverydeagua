# Manual del Usuario - Janus Delivery Manager

## Contenido

1. [Introducción](#introducción)
2. [Comandos Principales](#comandos-principales)
3. [Cómo Cargar un Pedido](#cómo-cargar-un-pedido)
4. [Cobros](#cobros)
5. [Gestión de Clientes](#gestión-de-clientes)
6. [Reportes y Resúmenes](#reportes-y-resúmenes)
7. [Listado de Pedidos](#listado-de-pedidos)
8. [Contacto con Soporte](#contacto-con-soporte)

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

## Listado de Pedidos

El módulo de Listado de Pedidos le permite ver, gestionar y dar seguimiento a todos los pedidos registrados en el sistema.

### Acceder al Listado de Pedidos

Para acceder al listado de pedidos, puede:

- Escribir el comando `/listarpedidos`
- O presionar el botón "📋 Ver Pedidos" en el menú principal

### Visualización de Pedidos

Al acceder al listado, verá los pedidos más recientes con la siguiente información:

- Número de pedido
- Nombre del cliente
- Fecha de creación
- Estado del pedido (pendiente, entregado, etc.)
- Monto total

### Acciones Disponibles para cada Pedido

Para cada pedido en la lista, tendrá disponibles varias acciones:

- **Ver Detalles**: Muestra información completa del pedido, incluyendo todos los productos, cantidades y precios.
- **Marcar como Entregado**: Cambia el estado del pedido a "Entregado".
- **Registrar Pago**: Le permite registrar un pago total o parcial para el pedido.
- **Programar Entrega**: Permite asignar o modificar la fecha y hora de entrega programada.
- **Asignar Zona**: Permite asignar o cambiar la zona de reparto del pedido.
- **Anular Pedido**: Cancela el pedido y lo marca como anulado.

### Filtrar Pedidos

Puede filtrar los pedidos mostrados según diferentes criterios:

- **Por Estado**: Ver solo pedidos pendientes, entregados, anulados, etc.
- **Por Fecha**: Ver pedidos de un rango de fechas específico.
- **Por Cliente**: Ver pedidos de un cliente en particular.
- **Por Zona**: Ver pedidos asignados a una zona de reparto específica.

### Reportes de Pedidos

Desde la sección de listado de pedidos también puede acceder a reportes rápidos como:

- Resumen de pedidos del día
- Pedidos pendientes de entrega
- Pedidos programados para una fecha específica

### Consejos Útiles

- Utilice la función de búsqueda por cliente cuando necesite encontrar rápidamente los pedidos de un cliente específico.
- Revise regularmente los pedidos pendientes para asegurarse de que todas las entregas se realicen a tiempo.
- Verifique los pedidos programados para el día siguiente al finalizar su jornada.

## Contacto con Soporte

La función de Contacto le permite comunicarse directamente con el equipo de soporte técnico para resolver dudas, reportar problemas o solicitar información.

### Iniciar un Contacto

Para iniciar un contacto con soporte, puede:

- Escribir el comando `/contacto`
- O presionar el botón "📞 Contacto" en el menú principal

### Proceso de Envío de Consulta

El proceso de contacto con soporte consta de los siguientes pasos:

1. **Escribir el Motivo**: Después de iniciar el contacto, el sistema le solicitará que indique el motivo de su consulta. Describa claramente y con detalle su pregunta o el problema que está experimentando.

2. **Revisar y Confirmar**: El sistema le mostrará un resumen de su consulta y le pedirá confirmación antes de enviarla. En esta etapa puede:

   - Seleccionar "✅ Enviar" para proceder con el envío
   - Seleccionar "❌ Cancelar" para cancelar el proceso

3. **Confirmación de Envío**: Después de enviar su consulta, recibirá un mensaje confirmando que ha sido enviada al equipo de soporte.

### Respuestas del Soporte

Cuando el equipo de soporte responda a su consulta:

- Recibirá un mensaje directo del bot con la respuesta
- La respuesta incluirá información o instrucciones para resolver su consulta

### Recomendaciones para Contactar al Soporte

Para obtener una respuesta más rápida y efectiva:

- **Sea específico**: Describa claramente el problema, incluyendo cuándo y cómo ocurrió.
- **Proporcione detalles**: Mencione mensajes de error, comportamientos inesperados o cualquier otra información relevante.
- **Indique pasos**: Si reporta un problema, detalle los pasos que siguió antes de que ocurriera.
- **Incluya ejemplos**: Si es posible, proporcione ejemplos concretos de la situación.

### Horario de Atención

El equipo de soporte revisa y responde las consultas de lunes a viernes, de 9:00 a 18:00 hrs. Las consultas enviadas fuera de este horario serán atendidas el siguiente día hábil.

> **Nota**: Para situaciones urgentes que requieran atención inmediata, se recomienda contactar directamente a su representante de cuenta por los canales tradicionales (teléfono o email).
