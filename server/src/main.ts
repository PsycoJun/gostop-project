import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  // 1. AppModule을 기반으로 NestJS 애플리케이션 인스턴스를 생성합니다.
  const app = await NestFactory.create(AppModule);

  // 2. CORS(Cross-Origin Resource Sharing)를 활성화합니다.
  //    (클라이언트 http://localhost:3000 에서 오는 요청을 허용하기 위함)
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000', 
      'http://127.0.0.1:3001'
    ],
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });


  // 3. WebSocket(Socket.IO)을 사용하도록 어댑터를 설정합니다.
  //    이 줄이 있어야 GameGateway가 정상적으로 작동합니다.
  app.useWebSocketAdapter(new IoAdapter(app));
  
  await app.listen(3001);
  console.log('🚀 서버가 http://localhost:3001에서 실행 중입니다.');
}
bootstrap();