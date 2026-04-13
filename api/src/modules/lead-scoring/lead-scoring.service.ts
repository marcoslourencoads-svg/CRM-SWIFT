import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateScoringRuleDto, ConditionOperator } from './dto/create-scoring-rule.dto';
import { UpdateScoringRuleDto } from './dto/update-scoring-rule.dto';

interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

interface ScoringFactor {
  ruleId: string;
  ruleName: string;
  field: string;
  operator: string;
  points: number;
  matched: boolean;
}

@Injectable()
export class LeadScoringService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CRUD Rules ─────────────────────────────────────────────

  async createRule(orgId: string, dto: CreateScoringRuleDto) {
    return this.prisma.scoringRule.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        condition: dto.condition as any,
        points: dto.points,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAllRules(orgId: string) {
    return this.prisma.scoringRule.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneRule(orgId: string, id: string) {
    const rule = await this.prisma.scoringRule.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!rule) throw new NotFoundException('Scoring rule not found');
    return rule;
  }

  async updateRule(orgId: string, id: string, dto: UpdateScoringRuleDto) {
    await this.findOneRule(orgId, id);

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.condition !== undefined) data.condition = dto.condition;
    if (dto.points !== undefined) data.points = dto.points;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.scoringRule.update({ where: { id }, data });
  }

  async deleteRule(orgId: string, id: string) {
    await this.findOneRule(orgId, id);
    return this.prisma.scoringRule.delete({ where: { id } });
  }

  // ─── Scoring Engine ─────────────────────────────────────────

  calculateScore(lead: Record<string, any>, rules: { id: string; name: string; condition: any; points: number }[]) {
    const factors: ScoringFactor[] = [];
    let totalScore = 0;

    for (const rule of rules) {
      const condition = rule.condition as RuleCondition;
      const matched = this.evaluateCondition(lead, condition);

      factors.push({
        ruleId: rule.id,
        ruleName: rule.name,
        field: condition.field,
        operator: condition.operator,
        points: rule.points,
        matched,
      });

      if (matched) {
        totalScore += rule.points;
      }
    }

    return { score: totalScore, factors };
  }

  private evaluateCondition(lead: Record<string, any>, condition: RuleCondition): boolean {
    const fieldValue = lead[condition.field];

    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return fieldValue == condition.value;

      case ConditionOperator.NOT_EQUALS:
        return fieldValue != condition.value;

      case ConditionOperator.GREATER_THAN:
        return typeof fieldValue === 'number' && fieldValue > Number(condition.value);

      case ConditionOperator.LESS_THAN:
        return typeof fieldValue === 'number' && fieldValue < Number(condition.value);

      case ConditionOperator.CONTAINS:
        return typeof fieldValue === 'string' &&
          fieldValue.toLowerCase().includes(String(condition.value).toLowerCase());

      case ConditionOperator.IS_SET:
        return fieldValue !== null && fieldValue !== undefined;

      case ConditionOperator.IS_NOT_SET:
        return fieldValue === null || fieldValue === undefined;

      default:
        return false;
    }
  }

  // ─── Recalculate ────────────────────────────────────────────

  async recalculateForLead(orgId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const rules = await this.prisma.scoringRule.findMany({
      where: { organizationId: orgId, isActive: true },
    });

    const { score, factors } = this.calculateScore(lead, rules);

    return this.prisma.leadScore.upsert({
      where: { leadId },
      update: {
        score,
        factors: factors as any,
        calculatedAt: new Date(),
      },
      create: {
        leadId,
        score,
        factors: factors as any,
        calculatedAt: new Date(),
      },
    });
  }

  async recalculateAll(orgId: string) {
    const [leads, rules] = await Promise.all([
      this.prisma.lead.findMany({
        where: { organizationId: orgId, deletedAt: null },
      }),
      this.prisma.scoringRule.findMany({
        where: { organizationId: orgId, isActive: true },
      }),
    ]);

    const results = [];

    for (const lead of leads) {
      const { score, factors } = this.calculateScore(lead, rules);

      const result = await this.prisma.leadScore.upsert({
        where: { leadId: lead.id },
        update: {
          score,
          factors: factors as any,
          calculatedAt: new Date(),
        },
        create: {
          leadId: lead.id,
          score,
          factors: factors as any,
          calculatedAt: new Date(),
        },
      });

      results.push(result);
    }

    return { recalculated: results.length };
  }

  async getLeadScore(orgId: string, leadId: string) {
    // Verify lead belongs to org
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const score = await this.prisma.leadScore.findUnique({
      where: { leadId },
    });

    if (!score) {
      return { leadId, score: 0, factors: [], calculatedAt: null };
    }

    return score;
  }
}
