import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from './orders/orders.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), OrdersModule],
})
export class AppModule {}
