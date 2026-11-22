import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  it('health check reports the API is running', () => {
    const c = new AppController(new AppService());
    expect(c.getHealth()).toMatchObject({ status: 'OK' });
  });
});
