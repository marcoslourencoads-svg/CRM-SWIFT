import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { TagsService } from '../tags/tags.service';
import { NotesService } from '../notes/notes.service';
import { LeadTasksService } from '../lead-tasks/lead-tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

const MAX_DEPTH = 3;

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tags: TagsService,
    private readonly notes: NotesService,
    private readonly leadTasks: LeadTasksService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhooksService,
    private readonly customFields: CustomFieldsService,
  ) {}

  // ─── Event Listeners ───────────────────────────────────────

  @OnEvent('lead.created')
  handleLeadCreated(payload: { leadId: string; orgId: string }) {
    return this.evaluateRules(payload.leadId, 'LEAD_CREATED', payload).catch((err) =>
      this.logger.error(`evaluateRules failed for lead.created: ${err.message}`),
    );
  }

  @OnEvent('lead.status_changed')
  handleStatusChanged(payload: {
    leadId: string;
    fromStatusId: string;
    toStatusId: string;
    orgId: string;
  }) {
    return this.evaluateRules(payload.leadId, 'STATUS_CHANGED', payload).catch((err) =>
      this.logger.error(`evaluateRules failed for lead.status_changed: ${err.message}`),
    );
  }

  @OnEvent('lead.tag_added')
  handleTagAdded(payload: { leadId: string; tagId: string; orgId: string }) {
    return this.evaluateRules(payload.leadId, 'TAG_ADDED', payload).catch((err) =>
      this.logger.error(`evaluateRules failed for lead.tag_added: ${err.message}`),
    );
  }

  @OnEvent('lead.task_completed')
  handleTaskCompleted(payload: { leadId: string; taskId: string; orgId: string }) {
    return this.evaluateRules(payload.leadId, 'TASK_COMPLETED', payload).catch((err) =>
      this.logger.error(`evaluateRules failed for lead.task_completed: ${err.message}`),
    );
  }

  @OnEvent('lead.assigned')
  handleAssigned(payload: { leadId: string; assigneeId: string; orgId: string }) {
    return this.evaluateRules(payload.leadId, 'LEAD_ASSIGNED', payload).catch((err) =>
      this.logger.error(`evaluateRules failed for lead.assigned: ${err.message}`),
    );
  }

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
    const params = action.params ?? {};
    switch (action.type) {
      case 'MOVE_TO_STATUS': {
        if (!params.statusId) return 'skipped: statusId ausente';
        const updated = await this.prisma.lead.update({
          where: { id: lead.id },
          data: {
            statusId: params.statusId,
            lastActivityAt: new Date(),
            lastStatusChangedAt: new Date(),
            version: { increment: 1 },
          },
        });
        return `moved to status ${updated.statusId}`;
      }

      case 'ASSIGN_TO': {
        if (!params.assigneeId) return 'skipped: assigneeId ausente';
        await this.prisma.lead.update({
          where: { id: lead.id },
          data: { assigneeId: params.assigneeId, lastActivityAt: new Date() },
        });
        return `assigned to ${params.assigneeId}`;
      }

      case 'ADD_TAG': {
        if (params.tagId) {
          await this.tags.addTagToLead(lead.organizationId, lead.id, params.tagId);
          return `tag ${params.tagId} added`;
        }
        if (params.tagName) {
          const tag = await this.tags.upsertByName(lead.organizationId, params.tagName);
          await this.tags.addTagToLead(lead.organizationId, lead.id, tag.id);
          return `tag "${params.tagName}" added`;
        }
        return 'skipped: tagId/tagName ausente';
      }

      case 'REMOVE_TAG': {
        if (!params.tagId) return 'skipped: tagId ausente';
        try {
          await this.tags.removeTagFromLead(lead.organizationId, lead.id, params.tagId);
          return `tag ${params.tagId} removed`;
        } catch {
          return `tag ${params.tagId} já não estava no lead`;
        }
      }

      case 'SET_FIELD': {
        // Atualiza campo direto do Lead (priority, temperature, estimatedValue, etc)
        if (!params.field) return 'skipped: field ausente';
        const allowed = ['priority', 'temperature', 'estimatedValue', 'probability', 'title'];
        if (!allowed.includes(params.field)) {
          return `skipped: campo "${params.field}" não é editável via automação`;
        }
        await this.prisma.lead.update({
          where: { id: lead.id },
          data: { [params.field]: params.value, lastActivityAt: new Date() },
        });
        return `${params.field} = ${params.value}`;
      }

      case 'SET_CUSTOM_FIELD': {
        if (!params.fieldDefinitionId) return 'skipped: fieldDefinitionId ausente';
        await this.customFields.setValues(lead.id, [
          { fieldDefinitionId: params.fieldDefinitionId, value: params.value },
        ]);
        return `custom field ${params.fieldDefinitionId} = ${params.value}`;
      }

      case 'CREATE_TASK': {
        if (!params.title) return 'skipped: title ausente';
        let dueDate: string | undefined;
        if (params.dueDateOffsetMinutes) {
          const d = new Date();
          d.setMinutes(d.getMinutes() + Number(params.dueDateOffsetMinutes));
          dueDate = d.toISOString();
        }
        const task = await this.leadTasks.create(lead.id, params.createdBy ?? lead.assigneeId ?? lead.id, {
          title: params.title,
          description: params.description,
          dueDate,
          assigneeId: params.assigneeId ?? lead.assigneeId,
          priority: params.priority,
        });
        return `task ${task.id} created`;
      }

      case 'CREATE_NOTE': {
        if (!params.content) return 'skipped: content ausente';
        const note = await this.notes.create(lead.id, params.userId ?? lead.assigneeId ?? lead.id, {
          content: params.content,
        });
        return `note ${note.id} created`;
      }

      case 'SEND_NOTIFICATION': {
        const targetUser = params.userId ?? lead.assigneeId;
        if (!targetUser) return 'skipped: nenhum user pra notificar';
        await this.notifications.create(
          lead.organizationId,
          targetUser,
          (params.notificationType ?? 'AUTOMATION') as any,
          params.title ?? 'Automação',
          params.message ?? '',
          { leadId: lead.id, automation: true },
        );
        return `notification sent to ${targetUser}`;
      }

      case 'SEND_WEBHOOK': {
        // Dispara webhook avulso (não persiste delivery log do módulo webhooks)
        if (!params.url) return 'skipped: url ausente';
        try {
          const res = await fetch(params.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'automation.fired',
              lead: { id: lead.id, title: lead.title, statusId: lead.statusId },
              ...params.payload,
            }),
          });
          return `webhook ${params.url}: HTTP ${res.status}`;
        } catch (err: any) {
          return `webhook error: ${err.message}`;
        }
      }

      case 'SEND_WHATSAPP_TEMPLATE': {
        if (!params.templateId) return 'skipped: templateId ausente';
        const template = await this.prisma.whatsappTemplate.findFirst({
          where: { id: params.templateId, organizationId: lead.organizationId },
        });
        if (!template) return 'skipped: template não encontrado';

        // Aplica placeholders {{nome}}, {{empresa}}, {{telefone}}
        const contact = await this.prisma.contact.findUnique({
          where: { id: lead.contactId ?? '' },
        }).catch(() => null);
        const company = await this.prisma.company.findUnique({
          where: { id: lead.companyId ?? '' },
        }).catch(() => null);

        const content = template.content
          .replace(/\{\{nome\}\}/g, contact?.name ?? lead.title)
          .replace(/\{\{empresa\}\}/g, company?.name ?? '')
          .replace(/\{\{telefone\}\}/g, contact?.phone ?? '');

        // Registra Note como histórico (sem provider real ainda)
        await this.notes.create(lead.id, params.userId ?? lead.assigneeId ?? lead.id, {
          content: `📱 [Automação] WhatsApp template "${template.name}": ${content}`,
        });
        return `template "${template.name}" registrado como nota`;
      }

      default:
        this.logger.warn(`Unknown action type: ${action.type}`);
        return `unknown action: ${action.type}`;
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
