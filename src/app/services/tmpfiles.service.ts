import { inject, Injectable } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { APP_RUNTIME_CONFIG } from '../app.tokens';

export interface TmpfilesUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface TmpfilesDownloadResult {
  success: boolean;
  character?: ExportedCharacter;
  error?: string;
}

/**
 * Service for uploading and downloading temporary character files
 * using a user-controlled Cloudflare Worker + KV storage.
 */
@Injectable({ providedIn: 'root' })
export class TmpfilesService {
  private readonly MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
  private readonly runtimeConfig = inject(APP_RUNTIME_CONFIG);
  private readonly CORS_PROXY = this.runtimeConfig.tmpfilesProxyUrl;
  private readonly AUTH_TOKEN = this.runtimeConfig.tmpfilesProxyAuthToken;
  /**
   * Extract file ID from worker download URL or just the ID string.
   * Example: https://worker.example.workers.dev/files/123456 -> 123456
   */
  extractFileId(input: string): string | null {
    const trimmedInput = input.trim();

    // Accept direct short-form IDs (current: 6 digits, legacy: 32 hex chars).
    const idMatch = trimmedInput.match(/^(\d{6}|[a-f0-9]{32})$/i);
    if (idMatch) return idMatch[1].toLowerCase();

    // Accept worker-style links (/files/:id).
    const urlMatch = trimmedInput.match(/\/files\/(\d{6}|[a-f0-9]{32})(?:\/)?$/i);
    if (urlMatch) return urlMatch[1].toLowerCase();

    return null;
  }

  /**
   * Check if input is a valid worker download link or file ID.
   */
  isTmpfilesUrl(input: string): boolean {
    return this.extractFileId(input) !== null;
  }

  /**
   * Build full worker download URL from file ID.
   */
  buildTmpfilesUrl(fileId: string): string {
    return `${this.CORS_PROXY}/files/${fileId}`;
  }

  /**
   * Kept for backward compatibility with callers that expect URL normalization.
   */
  getTmpfilesDownloadUrl(url: string): string {
    return url;
  }

  /**
   * Upload character data to the Cloudflare Worker temporary storage.
   */
  async uploadCharacter(character: ExportedCharacter): Promise<TmpfilesUploadResult> {
    try {
      const jsonContent = JSON.stringify(character);
      const payloadSize = new TextEncoder().encode(jsonContent).byteLength;
      if (payloadSize > this.MAX_UPLOAD_SIZE_BYTES) {
        return {
          success: false,
          error: `Character payload exceeds 5MB limit (${this.MAX_UPLOAD_SIZE_BYTES} bytes).`,
        };
      }

      if (this.CORS_PROXY.includes('REPLACE_WITH_YOUR_WORKER')) {
        return {
          success: false,
          error: 'Share worker URL is not configured yet. Deploy cloudflare/tmpfiles-proxy-worker.js and set tmpfilesProxyUrl in public/runtime-config.js.',
        };
      }

      if (this.AUTH_TOKEN.includes('REPLACE_WITH_YOUR_AUTH_TOKEN')) {
        return {
          success: false,
          error: 'Share worker auth token is not configured. Set tmpfilesProxyAuthToken in public/runtime-config.js.',
        };
      }

      const response = await fetch(`${this.CORS_PROXY}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: jsonContent,
      });

      if (!response.ok) {
        let errorText = `${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.json() as { error?: string };
          if (errorBody.error) errorText = errorBody.error;
        } catch {
          // Fallback to HTTP status text when JSON error body is unavailable.
        }
        throw new Error(errorText);
      }

      const data = await response.json() as {
        success?: boolean;
        data?: { url?: string };
      };

      if (data.success && data.data?.url) {
        return {
          success: true,
          url: data.data.url,
        };
      } else {
        throw new Error('Worker did not return a share URL');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to upload to temporary share storage: ${message}`,
      };
    }
  }

  /**
   * Download character from worker URL or file ID.
   */
  async downloadCharacter(input: string): Promise<TmpfilesDownloadResult> {
    try {
      if (this.CORS_PROXY.includes('REPLACE_WITH_YOUR_WORKER')) {
        return {
          success: false,
          error: 'Share worker URL is not configured yet. Deploy cloudflare/tmpfiles-proxy-worker.js and set tmpfilesProxyUrl in public/runtime-config.js.',
        };
      }

      if (this.AUTH_TOKEN.includes('REPLACE_WITH_YOUR_AUTH_TOKEN')) {
        return {
          success: false,
          error: 'Share worker auth token is not configured. Set tmpfilesProxyAuthToken in public/runtime-config.js.',
        };
      }

      const fileId = this.extractFileId(input);
      if (!fileId) {
        return {
          success: false,
          error: 'Invalid share URL or ID format. Use the full share link or the short file ID.',
        };
      }

      const url = this.buildTmpfilesUrl(fileId);

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.AUTH_TOKEN}` },
      });
      if (!response.ok) {
        let errorText = `${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.json() as { error?: string };
          if (errorBody.error) errorText = errorBody.error;
        } catch {
          // Fallback to HTTP status text when JSON error body is unavailable.
        }
        throw new Error(errorText);
      }

      const character = await response.json() as ExportedCharacter;

      // Validate basic structure
      if (!character.character) {
        console.error('Invalid character data structure:', character);
        throw new Error('Invalid character data: missing character object');
      }

      return {
        success: true,
        character,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to download from temporary share storage: ${message}`,
      };
    }
  }
}
