import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof payload === 'string' ? payload :
      payload && typeof payload === 'object' && 'message' in payload ? payload.message : 'Internal server error';
    if (!(exception instanceof HttpException)) this.logger.error(exception);
    response.status(statusCode).json({ statusCode, message });
  }
}
