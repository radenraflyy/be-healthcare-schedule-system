import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';

@Injectable()
export class SmtpTransportService {
  private readonly transporter: Transporter;

  constructor(config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');
    const host =
      config.get<string>('NODE_ENV') === 'production'
        ? config.get<string>('SMTP_HOST', 'mailpit')
        : config.get<string>('SMTP_HOST_LOCAL', config.get<string>('SMTP_HOST', '127.0.0.1'));
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(config.get<string>('SMTP_PORT', '1025')),
      secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });
  }

  sendMail(options: SendMailOptions): Promise<unknown> {
    return this.transporter.sendMail(options);
  }
}
