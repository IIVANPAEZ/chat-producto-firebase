import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOrigin = config.get<string>('CORS_ORIGIN', '*');
  app.enableCors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',') });

  const port = Number(config.get<string>('PORT', '3000'));
  await app.listen(port, '0.0.0.0');
  Logger.log(`API escuchando en http://localhost:${port}`, 'Bootstrap');
}

await bootstrap();
