/**
 * Storage Provider Contract (SOLID: Open/Closed Principle & Dependency Inversion)
 * Decouples file uploads, media persistence, and CDN streaming from specific cloud vendors (Bunny, S3, R2, GCS).
 */

export interface UploadFileResult {
  url: string;
  path: string;
  bytes?: number;
}

export interface IStorageProvider {
  readonly providerName: string;
  uploadFile(
    folder: string,
    fileName: string,
    buffer: Buffer,
    contentType?: string,
  ): Promise<UploadFileResult>;
  deleteFile?(path: string): Promise<boolean>;
}

