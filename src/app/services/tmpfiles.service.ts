import { Injectable } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';

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
 * Service for uploading and downloading character files from tmpfiles.org
 * tmpfiles.org provides temporary file hosting (30 days) without authentication
 * Uses corsproxy.io for downloads since tmpfiles.org doesn't support CORS
 */
@Injectable({ providedIn: 'root' })
export class TmpfilesService {
  private readonly TMPFILES_API = 'https://tmpfiles.org/api/v1/upload';
  private readonly TMPFILES_DL = 'https://tmpfiles.org/dl';
  private readonly TMPFILES_HTTP = 'http://tmpfiles.org';
  // CORS proxy for handling cross-origin requests to tmpfiles.org
  // private readonly CORS_PROXY = 'https://corsproxy.io/?';
  private readonly CORS_PROXY = 'https://whateverorigin.org/get?url=';
  /**
   * Extract file ID from a tmpfiles.org download URL or just the ID string
   * Example: https://tmpfiles.org/dl/26737738/character_upload.json -> 26737738
   * Or if just the ID: 26737738 -> 26737738
   */
  extractFileId(input: string): string | null {
    // Try to extract from full URL
    const urlMatch = input.match(/tmpfiles\.org\/dl\/(\d+)\//);
    if (urlMatch) return urlMatch[1];
    
    // Try to match just a number (file ID)
    const idMatch = input.match(/^(\d+)$/);
    if (idMatch) return idMatch[1];
    
    return null;
  }

  /**
   * Check if input is a valid tmpfiles.org download link or file ID
   */
  isTmpfilesUrl(input: string): boolean {
    return this.extractFileId(input) !== null;
  }

  /**
   * Build full tmpfiles.org URL from file ID
   * Example: 26737738 -> https://tmpfiles.org/dl/26737738/character_sync.json
   */
  buildTmpfilesUrl(fileId: string): string {
    return `${this.TMPFILES_DL}/${fileId}/character_sync.json`;
  }

  /**
   * Get the actual download URL from a tmpfiles.org link
   * The URL contains the file name, we need to use that exact URL
   */
  getTmpfilesDownloadUrl(url: string): string {
    // tmpfiles.org URLs are direct download links, just return as-is
    return url;
  }

  /**
   * Upload character data to tmpfiles.org
   * Returns the shareable URL
   */
  async uploadCharacter(character: ExportedCharacter): Promise<TmpfilesUploadResult> {
    try {
      const filename = `character_sync.json`;

      const jsonContent = JSON.stringify(character);
      const blob = new Blob([jsonContent], { type: 'application/json' });

      const formData = new FormData();
      formData.append('file', blob, filename);

      const response = await fetch(this.TMPFILES_API, {
        method: 'POST',
        body: formData,
        // Note: FormData automatically sets the correct Content-Type header
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      console.log('Upload response from tmpfiles.org:', data);

      if (data.status === "success" && data.data?.url) {
        return {
          success: true,
          url: data.data.url.replace(this.TMPFILES_HTTP, this.TMPFILES_DL), // Ensure URL is HTTPS
        };
      } else {
        throw new Error(data.status_txt || 'Unknown upload error');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to upload to tmpfiles.org: ${message}`,
      };
    }
  }

  /**
   * Download character from tmpfiles.org URL or file ID
   * Uses a CORS proxy to bypass CORS restrictions
   * Accepts either:
   * - Full URL: https://tmpfiles.org/dl/26737738/character_sync.json
   * - File ID: 26737738
   */
  async downloadCharacter(input: string): Promise<TmpfilesDownloadResult> {
    try {
      const fileId = this.extractFileId(input);
      if (!fileId) {
        return {
          success: false,
          error: 'Invalid tmpfiles.org URL or ID format. Use just the file ID (e.g., 26737738) or the full URL.',
        };
      }

      // Build the full URL from ID
      const url = this.buildTmpfilesUrl(fileId);
      
      // Use CORS proxy to fetch the file
      const proxiedUrl = this.CORS_PROXY + `${encodeURIComponent(url)}`;
      
      const response = await fetch(proxiedUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      //console.log('Download response from tmpfiles.org (via CORS proxy):', response.json());


      // response.json().then(r => console.log(r['contents'])).catch(e => console.error('Error parsing JSON from CORS proxy response:', e));

      const character = await response.json().then(r => JSON.parse(r["contents"])) as ExportedCharacter;

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
        error: `Failed to download from tmpfiles.org: ${message}`,
      };
    }
  }
}
