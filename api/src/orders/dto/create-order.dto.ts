import { Type } from 'class-transformer';
import {
  IsDefined,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import type { Product } from '../interfaces/order.interface.js';

export class ProductDto implements Product {
  @IsString({ message: 'id debe ser un texto' })
  @IsNotEmpty({ message: 'id es obligatorio' })
  id: string;

  @IsString({ message: 'name debe ser un texto' })
  @IsNotEmpty({ message: 'name es obligatorio' })
  name: string;

  @IsNumber({}, { message: 'price debe ser un número' })
  @IsPositive({ message: 'price debe ser mayor que cero' })
  price: number;

  @IsISO4217CurrencyCode({ message: 'currency debe ser un código ISO 4217 (ej. COP)' })
  currency: string;

  @IsOptional()
  @IsUrl({}, { message: 'imageUrl debe ser una URL válida' })
  imageUrl?: string;
}

export class CreateOrderDto {
  @IsString({ message: 'chatId debe ser un texto' })
  @IsNotEmpty({ message: 'chatId es obligatorio' })
  chatId: string;

  @IsString({ message: 'messageId debe ser un texto' })
  @IsNotEmpty({ message: 'messageId es obligatorio' })
  messageId: string;

  @IsDefined({ message: 'product es obligatorio' })
  @IsObject({ message: 'product debe ser un objeto' })
  @ValidateNested()
  @Type(() => ProductDto)
  product: ProductDto;
}
