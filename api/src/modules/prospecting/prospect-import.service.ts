import { Injectable, BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { ProspectStage, ProspectChannel, TouchOutcome } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface ImportError {
  row: number;
  message: string;
}

export interface ProspectImportResult {
  imported: number;
  skipped: number;
  touchesCreated: number;
  errors: ImportError[];
  avisos: string[];
}

// A planilha de origem tem cabeçalhos em português com acento e
// maiúsculas irregulares; normalizamos antes de casar.
function normalizeKey(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const COLUMN_MAP: Record<string, string> = {
  nome: 'name',
  nome_do_contato: 'name',
  contato: 'name',
  responsavel_contato: 'name',
  negocio: 'business',
  empresa: 'business',
  negocio_nicho: 'business',
  nome_do_negocio: 'business',
  nicho: 'niche',
  segmento: 'niche',
  tem_anuncio: 'hasAds',
  anuncia: 'hasAds',
  link_do_instagram: 'profileUrl',
  instagram: 'profileUrl',
  perfil: 'profileUrl',
  do_instagram: 'handle',
  arroba: 'handle',
  telefone: 'phone',
  telefone_whatsapp: 'phone',
  whatsapp: 'phone',
  celular: 'phone',
  email: 'email',
  e_mail: 'email',
  cidade: 'city',
  seguidores: 'followers',
  canal: 'channel',
  canal_do_primeiro_toque: 'channel',
  data_da_mensagem: 'touch1Date',
  enviou_mensagem: 'touch1Done',
  principal_abordagem: 'approach',
  abordagem: 'approach',
  data_do_fup_1: 'fup1Date',
  fez_fup_1: 'fup1Done',
  data_do_fup_2: 'fup2Date',
  fez_fup_2: 'fup2Done',
  data_do_fup_3: 'fup3Date',
  fez_fup_3: 'fup3Done',
  respondeu: 'responded',
  agendou_reuniao: 'meetingSet',
  fez_reuniao: 'meetingHeld',
  fechou_contrato: 'won',
  valor: 'dealValue',
  se_nao_fechou_qual_motivo: 'lostNote',
  motivo: 'lostNote',
  observacoes: 'notes',
};

const CHANNEL_MAP: Record<string, ProspectChannel> = {
  instagram: 'INSTAGRAM',
  ig: 'INSTAGRAM',
  direct: 'INSTAGRAM',
  dm: 'INSTAGRAM',
  whatsapp: 'WHATSAPP',
  wpp: 'WHATSAPP',
  zap: 'WHATSAPP',
  email: 'EMAIL',
  e_mail: 'EMAIL',
  telefone: 'PHONE',
  ligacao: 'PHONE',
  phone: 'PHONE',
};

@Injectable()
export class ProspectImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importCsv(
    orgId: string,
    userId: string,
    fileBuffer: Buffer,
    listId?: string,
  ): Promise<ProspectImportResult> {
    if (listId) {
      const list = await this.prisma.prospectList.findFirst({
        where: { id: listId, organizationId: orgId },
        select: { id: true },
      });
      if (!list) throw new BadRequestException('Lista nao encontrada');
    }

    let records: Record<string, string>[];
    try {
      records = parse(fileBuffer, {
        columns: (header: string[]) => header.map((h) => COLUMN_MAP[normalizeKey(h)] ?? normalizeKey(h)),
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
      });
    } catch (err) {
      throw new BadRequestException(
        `CSV invalido: ${err instanceof Error ? err.message : 'erro ao ler'}`,
      );
    }

    if (!records.length) throw new BadRequestException('CSV vazio');

    const approaches = await this.prisma.prospectApproach.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
    });
    const approachByName = new Map(approaches.map((a) => [a.name.toLowerCase(), a.id]));

    const errors: ImportError[] = [];
    const avisos = new Set<string>();
    let imported = 0;
    let skipped = 0;
    let touchesCreated = 0;

    for (const [index, row] of records.entries()) {
      const rowNum = index + 2; // +1 pelo cabeçalho, +1 porque planilha conta de 1
      try {
        const handle = this.handleFrom(row.handle, row.profileUrl);
        const name = row.name?.trim() || row.business?.trim() || handle || '';

        if (!name) {
          skipped += 1;
          errors.push({ row: rowNum, message: 'Sem nome, negocio ou perfil identificavel' });
          continue;
        }

        const touches = this.buildTouches(row);
        const stamps = this.buildStamps(row, touches, avisos);

        // Abordagem nova vira registro no catalogo: sem isso o corte
        // "conversao por script" nasceria vazio na primeira importacao.
        let approachId: string | undefined;
        const approachName = row.approach?.trim();
        if (approachName) {
          const key = approachName.toLowerCase();
          if (!approachByName.has(key)) {
            const created = await this.prisma.prospectApproach.create({
              data: { organizationId: orgId, name: approachName },
            });
            approachByName.set(key, created.id);
          }
          approachId = approachByName.get(key);
        }

        const channel = this.channelFrom(row.channel) ?? (handle ? 'INSTAGRAM' : 'WHATSAPP');

        await this.prisma.prospect.create({
          data: {
            organizationId: orgId,
            listId,
            ownerId: userId,
            name,
            business: row.business?.trim() || null,
            handle,
            profileUrl: row.profileUrl?.trim() || null,
            phone: row.phone?.trim() || null,
            email: row.email?.trim() || null,
            city: row.city?.trim() || null,
            niche: row.niche?.trim() || null,
            hasAds: this.boolFrom(row.hasAds),
            followers: this.intFrom(row.followers),
            channel,
            stage: stamps.stage,
            touchCount: touches.length,
            lastTouchAt: touches.at(-1)?.sentAt ?? null,
            nextActionAt: null,
            firstContactedAt: stamps.firstContactedAt,
            respondedAt: stamps.respondedAt,
            meetingSetAt: stamps.meetingSetAt,
            meetingHeldAt: stamps.meetingHeldAt,
            wonAt: stamps.wonAt,
            lostAt: stamps.lostAt,
            dealValue: this.moneyFrom(row.dealValue),
            lostNote: row.lostNote?.trim() || null,
            // A coluna de observacoes da planilha vira a primeira
            // entrada do diario, carimbada com a etapa deduzida.
            ...(row.notes?.trim()
              ? {
                  notes: {
                    create: {
                      userId,
                      stage: stamps.stage,
                      content: row.notes.trim(),
                    },
                  },
                }
              : {}),
            touches: {
              create: touches.map((t, i) => ({
                userId,
                sequence: i + 1,
                channel,
                approachId: i === 0 ? approachId : undefined,
                outcome: t.outcome,
                sentAt: t.sentAt,
              })),
            },
          },
        });

        imported += 1;
        touchesCreated += touches.length;
      } catch (err) {
        skipped += 1;
        errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    return {
      imported,
      skipped,
      touchesCreated,
      errors: errors.slice(0, 100),
      avisos: [...avisos],
    };
  }

  async exportCsv(orgId: string, listId?: string): Promise<string> {
    const prospects = await this.prisma.prospect.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        ...(listId ? { listId } : {}),
      },
      include: {
        owner: { select: { name: true } },
        list: { select: { name: true } },
        touches: { orderBy: { sequence: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = prospects.map((p) => ({
      Nome: p.name,
      Negocio: p.business ?? '',
      Nicho: p.niche ?? '',
      Instagram: p.handle ? `@${p.handle}` : '',
      Telefone: p.phone ?? '',
      'E-mail': p.email ?? '',
      Cidade: p.city ?? '',
      'Tem anuncio': p.hasAds === null ? '' : p.hasAds ? 'Sim' : 'Nao',
      Canal: p.channel,
      Etapa: p.stage,
      Lista: p.list?.name ?? '',
      Responsavel: p.owner?.name ?? '',
      Toques: p.touchCount,
      'Data da abordagem': this.fmtDate(p.firstContactedAt),
      'Ultimo toque': this.fmtDate(p.lastTouchAt),
      'Proxima acao': this.fmtDate(p.nextActionAt),
      Respondeu: p.respondedAt ? 'Sim' : 'Nao',
      'Data da resposta': this.fmtDate(p.respondedAt),
      'Agendou reuniao': p.meetingSetAt ? 'Sim' : 'Nao',
      'Fez reuniao': p.meetingHeldAt ? 'Sim' : 'Nao',
      'Fechou contrato': p.wonAt ? 'Sim' : 'Nao',
      Valor: (p.dealValue / 100).toFixed(2),
      'Motivo da perda': p.lostNote ?? '',
    }));

    return stringify(rows, { header: true, bom: true });
  }

  // ─── Reconstrucao dos toques ────────────────────────────────

  // Cada par (data do FUP n, FEZ FUP n?) da planilha vira uma linha em
  // prospect_touches. E o que destrava a cadencia ilimitada e a taxa de
  // resposta por numero de toque.
  private buildTouches(row: Record<string, string>) {
    const specs = [
      { date: row.touch1Date, done: row.touch1Done },
      { date: row.fup1Date, done: row.fup1Done },
      { date: row.fup2Date, done: row.fup2Done },
      { date: row.fup3Date, done: row.fup3Done },
    ];

    const touches: { sentAt: Date; outcome: TouchOutcome }[] = [];
    for (const spec of specs) {
      const date = this.dateFrom(spec.date);
      const done = this.boolFrom(spec.done);
      // Sem data e sem "Sim" o toque nao aconteceu. Um "Nao" explicito
      // tambem nao conta como toque — era so a celula preenchida.
      if (!date && done !== true) break;
      touches.push({
        sentAt: date ?? touches.at(-1)?.sentAt ?? new Date(),
        outcome: 'NO_REPLY',
      });
    }

    return touches;
  }

  private buildStamps(
    row: Record<string, string>,
    touches: { sentAt: Date; outcome: TouchOutcome }[],
    avisos: Set<string>,
  ) {
    const firstContactedAt = touches[0]?.sentAt ?? null;
    const lastTouchAt = touches.at(-1)?.sentAt ?? null;

    const responded = this.boolFrom(row.responded) === true;
    const meetingSet = this.boolFrom(row.meetingSet) === true;
    const meetingHeld = this.boolFrom(row.meetingHeld) === true;
    const won = this.boolFrom(row.won) === true;

    // A planilha nao registra QUANDO houve resposta ou reuniao, so se
    // houve. Ancoramos no ultimo toque conhecido e avisamos: ciclo de
    // venda e tempo-ate-resposta dos dados importados sao aproximados.
    const fallback = lastTouchAt ?? firstContactedAt;
    if ((responded || meetingSet || meetingHeld || won) && fallback) {
      avisos.add(
        'A planilha nao guarda a data da resposta, da reuniao nem do fechamento. ' +
          'Esses carimbos foram ancorados na data do ultimo toque, entao ciclo medio ' +
          'e tempo ate resposta dos registros importados sao aproximados.',
      );
    }

    // Monotonico: quem fez reuniao necessariamente respondeu antes.
    const anyForward = responded || meetingSet || meetingHeld || won;
    const respondedAt = anyForward ? fallback : null;
    const meetingSetAt = meetingSet || meetingHeld || won ? fallback : null;
    const meetingHeldAt = meetingHeld || won ? fallback : null;
    const wonAt = won ? fallback : null;

    const explicitLoss = this.boolFrom(row.won) === false && !!row.lostNote?.trim();
    const lostAt = !won && explicitLoss ? fallback : null;

    let stage: ProspectStage = 'NEW';
    if (won) stage = 'WON';
    else if (lostAt) stage = 'LOST';
    else if (meetingHeldAt) stage = 'MEETING_DONE';
    else if (meetingSetAt) stage = 'MEETING_SET';
    else if (respondedAt) stage = 'RESPONDED';
    else if (touches.length > 1) stage = 'FOLLOW_UP';
    else if (touches.length === 1) stage = 'CONTACTED';

    if (touches.length > 0) {
      // Marca a resposta no ultimo toque para o corte "resposta por
      // numero de toque" nao nascer zerado na base importada.
      if (anyForward) touches[touches.length - 1].outcome = 'REPLIED_POSITIVE';
    }

    return {
      stage,
      firstContactedAt,
      respondedAt,
      meetingSetAt,
      meetingHeldAt,
      wonAt,
      lostAt,
    };
  }

  // ─── Parsers ────────────────────────────────────────────────

  private boolFrom(value?: string): boolean | null {
    if (!value) return null;
    const v = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    if (['sim', 's', 'yes', 'y', 'true', '1', 'x'].includes(v)) return true;
    if (['nao', 'n', 'no', 'false', '0'].includes(v)) return false;
    return null;
  }

  // Aceita DD/MM/AAAA (o formato da planilha) e ISO.
  private dateFrom(value?: string): Date | null {
    const raw = value?.trim();
    if (!raw) return null;

    const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (br) {
      const [, d, m, y] = br;
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      const date = new Date(Date.UTC(year, Number(m) - 1, Number(d), 12));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const iso = new Date(raw);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }

  private intFrom(value?: string): number | null {
    if (!value) return null;
    const n = parseInt(value.replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? null : n;
  }

  // "R$ 2.500,00" -> 250000. O CRM guarda dinheiro em CENTAVOS
  // (formatCurrency divide por 100) e dealValue e copiado direto para
  // Lead.estimatedValue na conversao — sair em reais aqui faria o
  // ticket medio e o total em contratos sairem 100x menores.
  private moneyFrom(value?: string): number {
    if (!value) return 0;
    const cleaned = value
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}\b)/g, '')
      .replace(',', '.');
    const reais = Number(cleaned);
    if (!Number.isFinite(reais) || reais <= 0) return 0;
    return Math.round(reais * 100);
  }

  private channelFrom(value?: string): ProspectChannel | null {
    if (!value) return null;
    return CHANNEL_MAP[normalizeKey(value)] ?? null;
  }

  private handleFrom(handle?: string, profileUrl?: string): string | null {
    const raw = handle?.trim() || profileUrl?.trim();
    if (!raw) return null;
    const fromUrl = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    if (fromUrl) return fromUrl[1].toLowerCase();
    if (/^https?:\/\//i.test(raw)) return null;
    return raw.replace(/^@/, '').replace(/\/+$/, '').toLowerCase() || null;
  }

  private fmtDate(date: Date | null): string {
    if (!date) return '';
    return date.toISOString().slice(0, 10);
  }
}
