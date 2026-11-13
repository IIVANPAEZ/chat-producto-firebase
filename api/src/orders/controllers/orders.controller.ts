import { Body, Controller, Get, HttpStatus, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import type { Order } from '../interfaces/order.interface.js';
import { OrdersService } from '../services/orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // 201 si se crea, 200 si ya existía un pedido para esa oferta
  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Order> {
    const { order, created } = await this.ordersService.create(dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return order;
  }

  @Get(':id')
  findOne(@Param('id') id: string): Order {
    return this.ordersService.findOne(id);
  }
}
