/**
 * Tipos de validación disponibles
 */
export const ValidationTypes = {
  TEXT: "text",
  NUMBER: "number",
  PHONE: "phone",
  EMAIL: "email",
  ADDRESS: "address",
};

/**
 * Reglas de validación para diferentes tipos de campos
 */
const ValidationRules = {
  text: {
    pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
    minLength: 2,
    maxLength: 50,
    validate: (value) => {
      if (!value || typeof value !== "string") return false;
      const cleaned = value.trim();
      if (cleaned.length < ValidationRules.text.minLength) return false;
      if (cleaned.length > ValidationRules.text.maxLength) return false;
      return ValidationRules.text.pattern.test(cleaned);
    },
    errorMessage:
      "Solo se permiten letras y espacios (entre 2 y 50 caracteres)",
  },

  number: {
    pattern: /^\d+$/,
    validate: (value) => {
      if (!value) return false;
      return ValidationRules.number.pattern.test(value);
    },
    errorMessage: "Solo se permiten números",
  },

  phone: {
    pattern: /^\+?[\d\s-]{8,15}$/,
    validate: (value) => {
      if (!value) return false;
      const cleaned = value.replace(/[\s-]/g, "");
      return ValidationRules.phone.pattern.test(cleaned);
    },
    errorMessage: "Formato de teléfono inválido (mínimo 8 dígitos)",
  },

  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    validate: (value) => {
      if (!value) return false;
      return ValidationRules.email.pattern.test(value.trim());
    },
    errorMessage: "Formato de email inválido",
  },

  address: {
    pattern: /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s,.-]+$/,
    minLength: 5,
    maxLength: 100,
    validate: (value) => {
      if (!value || typeof value !== "string") return false;
      const cleaned = value.trim();
      if (cleaned.length < ValidationRules.address.minLength) return false;
      if (cleaned.length > ValidationRules.address.maxLength) return false;
      return ValidationRules.address.pattern.test(cleaned);
    },
    errorMessage: "Dirección inválida (entre 5 y 100 caracteres)",
  },
};

/**
 * Valida un valor según el tipo especificado
 * @param {string} value - Valor a validar
 * @param {string} type - Tipo de validación (del enum ValidationTypes)
 * @returns {Object} Resultado de la validación { isValid, error }
 */
export const validate = (value, type) => {
  const rule = ValidationRules[type];
  if (!rule) {
    throw new Error(`Tipo de validación no soportado: ${type}`);
  }

  return {
    isValid: rule.validate(value),
    error: rule.errorMessage,
  };
};

/**
 * Limpia y formatea un valor según el tipo
 * @param {string} value - Valor a limpiar
 * @param {string} type - Tipo de validación
 * @returns {string} Valor limpio y formateado
 */
export const sanitize = (value, type) => {
  if (!value) return "";

  switch (type) {
    case ValidationTypes.TEXT:
      return value.trim().replace(/\s+/g, " ");

    case ValidationTypes.PHONE:
      return value.replace(/[^\d+]/g, "");

    case ValidationTypes.EMAIL:
      return value.trim().toLowerCase();

    case ValidationTypes.ADDRESS:
      return value.trim().replace(/\s+/g, " ");

    default:
      return value;
  }
};
