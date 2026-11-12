import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
}
