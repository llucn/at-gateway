import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  @OnEvent('modem.**')
  handleModemEvent(payload: any) {
    this.server.emit('modem.event', payload);
  }

  @OnEvent('sms.**')
  handleSmsEvent(payload: any) {
    this.server.emit('sms.event', payload);
  }

  @OnEvent('call.**')
  handleCallEvent(payload: any) {
    this.server.emit('call.event', payload);
  }
}
