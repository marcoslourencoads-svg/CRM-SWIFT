import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

const MAX_DEPTH = 3;

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CRUD ──────────────────────────────────────────────────

  async create(orgId: string, dto: CreateAutomationDto) {
    return this.prisma.automationRule.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        pipelineId: dto.pipelineId,
        trigger: dto.trigger as any,
        conditions: dto.conditions as any,
        actions: dto.actions as any,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(orgId: string) {
    return this.prisma.automationRule.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(orgId: string, id: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!rule) throw new NotFoundException('Automation rule not found');
    return rule;
  }

  async update(orgId: string, id: string, dto: UpdateAutomationDto) {
    await this.findOne(orgId, id);

    return this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.pipelineId !== undefined && { pipelineId: dto.pipelineId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.trigger !== undefined && { trigger: dto.trigger as any }),
        ...(dto.conditions !== undefined && { conditions: dto.conditions as any }),
        ...(dto.actions !== undefined && { actions: dto.actions as any }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(orgId: string, id: string) {
    await this.findOne(orgId, id);
    return this.prisma.automationRule.delete({ where: { id } });
  }

  // ─── Logs ──────────────────────────────────────────────────

  async findLogs(orgId: string, ruleId: string, limit = 50, cursor?: string) {
    await this.findOne(orgId, ruleId);

    return this.prisma.automationLog.findMany({
      where: { ruleId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  // ─── Preview ───────────────────────────────────────────────

  async preview(orgId: string, id: string) {
    const rule = await this.findOne(orgId, id);
    const trigger = rule.trigger as any;
    const conditions = (rule.conditions ?? []) as any[];

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (rule.pipelineId) {
      where.pipelineId = rule.pipelineId;
    }

    // Apply conditions to build a rough filter
    for (const cond of conditions) {
      this.applyConditionToWhere(where, cond);
    }

    const count = await this.prisma.lead.count({ where });

    return {
      ruleId: id,
      triggerType: trigger.type,
      conditionsCount: conditions.length,
      matchingLeads: count,
    };
  }

  // ─── Engine ────────────────────────────────────────────────

  async evaluateRules(
    leadId: string,
    eventType: string,
    eventData: Record<string, any>,
    depth = 0,
  ) {
    if (depth >= MAX_DEPTH) {
      this.logger.warn(
        `Max automation depth (${MAX_DEPTH}) reached for lead ${leadId}. Stopping.`,
      );
      return;
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { status: true, pipeline: true, assignee: true },
    });
    if (!lead) return;

    const rules = await this.prisma.automationRule.findMany({
      where: {
        organizationId: lead.organizationId,
        isActive: true,
        ...(lead.pipelineId
          ? {
              OR: [
                { pipelineId: lead.pipelineId },
                { pipelineId: null },
              ],
            }
          : {}),
      },
    });

    for (const rule of rules) {
      const trigger = rule.trigger as any;
      if (trigger.type !== eventType) continue;

      // Check trigger params match
      if (!this.matchTriggerParams(trigger.params, eventData)) continue;

      // Evaluate conditions
      const conditions = (rule.conditions ?? []) as any[];
      if (!this.evaluateConditions(conditions, lead, eventData)) continue;

      // Execute actions
      const startTime = Date.now();
      const executedActions: any[] = [];
      let error: string | undefined;

      try {
        const actions = rule.actions as any[];
        for (const action of actions) {
          const result = await this.executeAction(action, lead, eventData);
          executedActions.push({ type: action.type, params: action.params, result });
        }
      } catch (err: any) {
        error = err.message;
        this.logger.error(
          `Automation rule ${rule.id} failed for lead ${leadId}: ${err.message}`,
        );
      }

      const executionTimeMs = Date.now() - startTime;

      // Create log
      await this.prisma.automationLog.create({
        data: {
          ruleId: rule.id,
          leadId,
          status: error ? 'FAILED' : 'SUCCESS',
          executedActions,
          error,
          executionTimeMs,
        },
      });

      // Update rule stats
      await this.prisma.automationRule.update({
        where: { id: rule.id },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date(),
        },
      });
    }
  }

  // ─── Private Helpers ───────────────────────────────────────

  private matchTriggerParams(
    params: Record<string, any> | undefined,
    eventData: Record<string, any>,
  ): boolean {
    if (!params) return true;

    for (const [key, value] of Object.entries(params)) {
      if (eventData[key] !== value) return false;
    }
    return true;
  }

  private evaluateConditions(
    conditions: any[],
    lead: any,
    eventData: Record<string, any>,
  ): boolean {
    for (const cond of conditions) {
      const fieldValue = this.resolveField(cond.field, lead, eventData);
      if (!this.evaluateOperator(fieldValue, cond.operator, cond.value)) {
        return false;
      }
    }
    return true;
  }

  private resolveField(
    field: string,
    lead: any,
    eventData: Record<string, any>,
  ): any {
    // Support dotted paths like "status.name" or "event.previousStatusId"
    if (field.startsWith('event.')) {
      return eventData[field.slice(6)];
    }

    const parts = field.split('.');
    let value = lead;
    for (const part of parts) {
      value = value?.[part];
    }
    return value;
  }

  private evaluateOperator(fieldValue: any, operator: string, condValue: any): boolean {
    switch (operator) {
      case 'EQUALS':
        return fieldValue === condValue;
      case 'NOT_EQUALS':
        return fieldValue !== condValue;
      case 'CONTAINS':
        return typeof fieldValue === 'string' && fieldValue.includes(condValue);
      case 'GT':
        return fieldValue > condValue;
      case 'LT':
        return fieldValue < condValue;
      case 'IN':
        return Array.isArray(condValue) && condValue.includes(fieldValue);
      case 'NOT_IN':
        return Array.isArray(condValue) && !condValue.includes(fieldValue);
      default:
        this.logger.warn(`Unknown condition operator: ${operator}`);
        return false;
    }
  }

  private async executeAction(
    action: any,
    lead: any,
    _eventData: Record<string, any>,
  ): Promise<string> {
    switch (action.type) {
      case 'MOVE_TO_STATUS':
        this.logger.log(
          `[ACTION] MOVE_TO_STATUS: lead=${lead.id} -> statusId=${action.params.statusId}`,
        );
        // TODO: actually call leadsService.move() when wired up
        return `Would move lead to status ${action.params.statusId}`;

      case 'ASSIGN_TO':
        this.logger.log(
          `[ACTION] ASSIGN_TO: lead=${lead.id} -> assigneeId=${action.params.assigneeId}`,
        );
        return `Would assign lead to ${action.params.assigneeId}`;

      case 'ADD_TAG':
        this.logger.log(
          `[ACTION] ADD_TAG: lead=${lead.id} -> tag=${action.params.tagId}`,
        );
        return `Would add tag ${action.params.tagId}`;

      case 'SET_FIELD':
        this.logger.log(
          `[ACTION] SET_FIELD: lead=${lead.id} -> ${action.params.field}=${action.params.value}`,
        );
        return `Would set ${action.params.field} to ${action.params.value}`;

      case 'SEND_NOTIFICATION':
        this.logger.log(
          `[ACTION] SEND_NOTIFICATION: lead=${lead.id} -> ${action.params.message}`,
        );
        return `Would send notification: ${action.params.message}`;

      default:
        this.logger.warn(`Unknown action type: ${action.type}`);
        return `Unknown action type: ${action.type}`;
    }
  }

  private applyConditionToWhere(where: any, cond: any): void {
    // Best-effort mapping of conditions to Prisma where clauses for preview
    const field = cond.field;
    if (field.startsWith('event.')) return; // Can't filter by event data

    switch (cond.operator) {
      case 'EQUALS':
        where[field] = cond.value;
        break;
      case 'NOT_EQUALS':
        where[field] = { not: cond.value };
        break;
      case 'CONTAINS':
        where[field] = { contains: cond.value, mode: 'insensitive' };
        break;
      case 'IN':
        where[field] = { in: cond.value };
        break;
      case 'NOT_IN':
        where[field] = { notIn: cond.value };
        break;
      case 'GT':
        where[field] = { gt: cond.value };
        break;
      case 'LT':
        where[field] = { lt: cond.value };
        break;
    }
  }
}
