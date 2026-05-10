import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): any {
    return {
      message: 'Typing Master API is running!',
      status: 'success',
      timestamp: new Date().toISOString(),
      endpoints: [
        '/users',
        '/exams', 
        '/chapters',
        '/results',
        '/result-patterns',
        '/messages',
        '/flash-banners'
      ]
    };
  }
}
