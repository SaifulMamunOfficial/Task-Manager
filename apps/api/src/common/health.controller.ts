import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  ok() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
