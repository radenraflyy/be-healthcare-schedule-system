import { ConfigService } from '@nestjs/config';

import type { ScheduleEmailJob } from '../../../common/types/schedule-email-job.js';
import type { SmtpTransportService } from './smtp-transport.service.js';

export class EmailService {
  private readonly from: string;

  constructor(
    config: ConfigService,
    private readonly smtp: SmtpTransportService,
  ) {
    this.from = config.get<string>('SMTP_FROM', 'Healthcare Schedule <no-reply@healthcare.local>');
  }

  async sendScheduleEmail(job: ScheduleEmailJob): Promise<void> {
    const created = job.event === 'created';
    const subject = created ? 'Janji temu Anda berhasil dibuat' : 'Janji temu Anda telah dihapus';
    const greeting = job.customerName.trim() || 'Pelanggan';
    const text = [
      `Halo ${greeting},`,
      '',
      created
        ? 'Janji temu Anda berhasil dibuat dengan detail berikut:'
        : 'Janji temu Anda telah dihapus dengan detail berikut:',
      `Dokter: dr. ${job.doctorName}`,
      `Tujuan: ${job.objective}`,
      `Waktu (UTC): ${job.scheduledAt}`,
      `ID jadwal: ${job.scheduleId}`,
      '',
      'Email ini dikirim otomatis. Mohon jangan membalas email ini.',
    ].join('\n');

    await this.smtp.sendMail({
      from: this.from,
      to: job.customerEmail,
      subject,
      text,
    });
  }
}
