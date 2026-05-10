import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): any {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): any {
    return {
      status: 'OK',
      message: 'Backend is running successfully!',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'Connected',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  @Get('status')
  getStatus(): any {
    return {
      api: 'Typing Master Backend',
      version: '1.0.0',
      status: 'running',
      database: 'PostgreSQL',
      port: process.env.PORT || 3012,
      timestamp: new Date().toISOString()
    };
  }
}
