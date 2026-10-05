/**
 * Errores controlados: su mensaje SÍ se envía al usuario.
 * Cualquier otro error se registra y el usuario recibe un mensaje genérico.
 */
export class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
    this.isUserError = true;
  }
}

/** Falta configuración (API key, binario externo, etc.). */
export class NotConfiguredError extends UserError {
  constructor(detail = '') {
    super(`⚠️ Este servicio no está configurado.${detail ? `\n\n${detail}` : ''}`);
    this.name = 'NotConfiguredError';
  }
}

/** Proveedor externo caído / sin integración fiable. */
export class ProviderError extends UserError {
  constructor(message = '⚠️ El servicio externo no está disponible en este momento.') {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Argumentos inválidos o faltantes. */
export class UsageError extends UserError {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

export default UserError;
