import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security
  app.use(helmet());

  // CORS
  const origins = config.get('CORS_ORIGINS');
  app.enableCors({
    origin: origins === '*' ? '*' : origins!.split(',').map((o: string) => o.trim()),
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix(config.get('API_PREFIX')!);

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger
  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AT Gateway API')
      .setDescription('Voice & SMS gateway for 4G LTE USB dongles')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const host = config.get('API_HOST');
  const port = config.get('API_PORT');

  await app.listen(port!, host!);

  console.log(`🚀 API server running on http://${host}:${port}/${config.get('API_PREFIX')}`);
  if (config.get('NODE_ENV') !== 'production') {
    console.log(`📚 API docs available at http://${host}:${port}/docs`);
  }
}

bootstrap();
