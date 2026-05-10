import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetaAdsReportsService } from '../meta-ads-reports.service';

@Injectable()
export class DailyReportScheduler {
  private readonly logger = new Logger(DailyReportScheduler.name);

  constructor(private readonly service: MetaAdsReportsService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'meta-ads-hourly-tick' })
  async tick() {
    const now = new Date();
    const accounts = await this.service.listActiveAccounts();
    if (accounts.length === 0) return;

    const dueAccounts = accounts.filter((a: { scheduleCron: string }) =>
      this.isDue(a.scheduleCron, now),
    );
    if (dueAccounts.length === 0) return;

    this.logger.log(
      `Disparando relatório para ${dueAccounts.length} conta(s) Meta`,
    );

    for (const account of dueAccounts) {
      try {
        await this.service.runForAccount(account, 'yesterday', true);
        this.logger.log(`Relatório enviado: ${account.clientName}`);
      } catch (err: any) {
        const msg = err.message ?? String(err);
        this.logger.error(`Falha em ${account.clientName}: ${msg}`);
        await this.service.markAccountError(account.id, msg);
      }
    }
  }

  private isDue(cronExpr: string, now: Date): boolean {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) return false;
    const [minutePart, hourPart] = parts;

    const minute = now.getMinutes();
    const hour = now.getHours();

    return matchesField(minutePart, minute) && matchesField(hourPart, hour);
  }
}

function matchesField(field: string, value: number): boolean {
  if (field === '*') return true;
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return step > 0 && value % step === 0;
  }
  if (field.includes(',')) {
    return field.split(',').some((part) => matchesField(part, value));
  }
  if (field.includes('-')) {
    const [from, to] = field.split('-').map((n) => parseInt(n, 10));
    return value >= from && value <= to;
  }
  const n = parseInt(field, 10);
  return !Number.isNaN(n) && n === value;
}
