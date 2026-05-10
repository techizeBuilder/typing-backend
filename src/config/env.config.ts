import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Environment configuration service
 * Provides centralized access to environment variables
 */
@Injectable()
export class EnvConfigService {
  constructor(private configService: ConfigService) {}

  get apiBaseUrl(): string {
    return this.configService.get<string>('API_BASE_URL') || 'http://localhost:5000';
  }

  get port(): number {
    return this.configService.get<number>('PORT') || 5000;
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV') || 'development';
  }

  /**
   * Construct full URL for uploaded files
   * @param uploadPath - Relative path from uploads folder (e.g., 'exams/filename.jpg')
   * @returns Full URL to the uploaded file
   */
  getFileUrl(uploadPath: string): string {
    return `${this.apiBaseUrl}/uploads/${uploadPath}`;
  }
}
