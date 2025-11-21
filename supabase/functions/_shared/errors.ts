/**
 * Standardized error handling for edge functions
 * Phase 2: Database Schema Consolidation
 */

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  AI_ERROR = 'AI_ERROR',
}

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    timestamp: string;
  };
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: any,
  status: number = 400
): Response {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  };

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(data: T, status: number = 200): Response {
  const successResponse: SuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(successResponse), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

/**
 * Standardized logging format for errors
 */
export function logError(functionName: string, error: any, context?: any) {
  console.error(JSON.stringify({
    function: functionName,
    level: 'ERROR',
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : String(error),
    context,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Standardized logging format for info
 */
export function logInfo(functionName: string, message: string, data?: any) {
  console.log(JSON.stringify({
    function: functionName,
    level: 'INFO',
    message,
    data,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Standardized logging format for warnings
 */
export function logWarning(functionName: string, message: string, data?: any) {
  console.warn(JSON.stringify({
    function: functionName,
    level: 'WARNING',
    message,
    data,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Standardized logging format for debug
 */
export function logDebug(functionName: string, message: string, data?: any) {
  console.debug(JSON.stringify({
    function: functionName,
    level: 'DEBUG',
    message,
    data,
    timestamp: new Date().toISOString(),
  }));
}
