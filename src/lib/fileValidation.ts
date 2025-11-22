/**
 * File Validation Utilities
 * Advanced validation for document uploads
 */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  metadata?: {
    hash?: string;
    pages?: number;
    size: number;
    type: string;
  };
}

/**
 * Calculate SHA-256 hash of a file for duplicate detection
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Validate PDF file structure
 */
export async function validatePDF(file: File): Promise<FileValidationResult> {
  try {
    // Read first few bytes to check PDF header
    const headerBytes = await file.slice(0, 5).arrayBuffer();
    const header = new TextDecoder().decode(headerBytes);
    
    if (!header.startsWith('%PDF-')) {
      return {
        valid: false,
        error: 'Invalid PDF file: Missing PDF header',
      };
    }

    // Check if file is empty
    if (file.size === 0) {
      return {
        valid: false,
        error: 'PDF file is empty',
      };
    }

    // Check if file is too small to be valid
    if (file.size < 100) {
      return {
        valid: false,
        error: 'PDF file is too small to be valid',
      };
    }

    // Calculate hash for duplicate detection
    const hash = await calculateFileHash(file);

    return {
      valid: true,
      metadata: {
        hash,
        size: file.size,
        type: file.type,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validate text file
 */
export async function validateTextFile(file: File): Promise<FileValidationResult> {
  try {
    // Check if file is empty
    if (file.size === 0) {
      return {
        valid: false,
        error: 'Text file is empty',
      };
    }

    // Read file content to check if it's valid text
    const text = await file.text();
    
    if (text.trim().length === 0) {
      return {
        valid: false,
        error: 'Text file contains no content',
      };
    }

    // Check for binary content (likely not a text file)
    const binaryCheck = /[\x00-\x08\x0E-\x1F]/.test(text.substring(0, 1000));
    if (binaryCheck) {
      return {
        valid: false,
        error: 'File appears to contain binary data, not text',
      };
    }

    // Calculate hash for duplicate detection
    const hash = await calculateFileHash(file);

    return {
      valid: true,
      metadata: {
        hash,
        size: file.size,
        type: file.type,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate text file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Comprehensive file validation
 */
export async function validateFile(file: File): Promise<FileValidationResult> {
  const warnings: string[] = [];

  // Check file type
  const allowedTypes = ['application/pdf', 'text/plain'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed: ${file.type}. Only PDF and TXT files are supported.`,
    };
  }

  // Check file size limits
  const maxSize = 10 * 1024 * 1024; // 10MB
  const minSize = 100; // 100 bytes

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File is too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum size is 10MB.`,
    };
  }

  if (file.size < minSize) {
    return {
      valid: false,
      error: 'File is too small to contain valid content.',
    };
  }

  // Warn about large files
  if (file.size > 5 * 1024 * 1024) {
    warnings.push('Large file detected. Upload may take longer.');
  }

  // Type-specific validation
  if (file.type === 'application/pdf') {
    const pdfValidation = await validatePDF(file);
    if (!pdfValidation.valid) {
      return pdfValidation;
    }
    return {
      ...pdfValidation,
      warnings,
    };
  } else if (file.type === 'text/plain') {
    const textValidation = await validateTextFile(file);
    if (!textValidation.valid) {
      return textValidation;
    }
    return {
      ...textValidation,
      warnings,
    };
  }

  return {
    valid: true,
    warnings,
    metadata: {
      size: file.size,
      type: file.type,
    },
  };
}

/**
 * Validate batch of files
 */
export async function validateBatch(files: File[]): Promise<{
  valid: boolean;
  results: Map<string, FileValidationResult>;
  totalSize: number;
  duplicates: string[];
}> {
  const results = new Map<string, FileValidationResult>();
  const hashes = new Map<string, string>();
  const duplicates: string[] = [];
  let totalSize = 0;

  // Validate each file
  for (const file of files) {
    const result = await validateFile(file);
    results.set(file.name, result);
    totalSize += file.size;

    // Check for duplicates by hash
    if (result.valid && result.metadata?.hash) {
      const existingFile = hashes.get(result.metadata.hash);
      if (existingFile) {
        duplicates.push(`${file.name} is a duplicate of ${existingFile}`);
      } else {
        hashes.set(result.metadata.hash, file.name);
      }
    }
  }

  // Check total size limit
  const maxTotalSize = 50 * 1024 * 1024; // 50MB
  if (totalSize > maxTotalSize) {
    return {
      valid: false,
      results,
      totalSize,
      duplicates,
    };
  }

  // Check if all files are valid
  const allValid = Array.from(results.values()).every(r => r.valid);

  return {
    valid: allValid,
    results,
    totalSize,
    duplicates,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

/**
 * Check if filename is safe (no path traversal)
 */
export function isSafeFilename(filename: string): boolean {
  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }

  // Check for invalid characters
  const invalidChars = /[<>:"|?*\x00-\x1F]/;
  if (invalidChars.test(filename)) {
    return false;
  }

  // Check length
  if (filename.length === 0 || filename.length > 255) {
    return false;
  }

  return true;
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  filename = filename.replace(/^.*[\\\/]/, '');

  // Replace invalid characters with underscore
  filename = filename.replace(/[<>:"|?*\x00-\x1F]/g, '_');

  // Limit length
  if (filename.length > 255) {
    const ext = getFileExtension(filename);
    const nameWithoutExt = filename.substring(0, filename.length - ext.length - 1);
    filename = nameWithoutExt.substring(0, 250 - ext.length) + '.' + ext;
  }

  return filename;
}
