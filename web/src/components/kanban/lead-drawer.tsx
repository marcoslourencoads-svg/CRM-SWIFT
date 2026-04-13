'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRightLeft,
  CalendarIcon,
  CirclePlus,
  Pencil,
  Plus,
  Tag,
  UserPlus,
  X,
} from 'lucide-react';

import api from '@/lib/api';
import { formatCurrency } from '@/lib/format';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TagInfo {
  id: string;
  name: string;
  color: string;
}

interface LeadDetail {
  id: string;
  title: string;
  estimatedValue: number;
  priority: string;
  temperature: string;
  probability: number;
  expectedCloseDate: string | null;
  version: number;
  status: { id: string; name: string; color: string };
  pipeline: { id: string; name: string };
  assignee: { id: string; name: string; email: string; avatarUrl?: string } | null;
  contact: { id: string; name: string; email: string; phone: string; jobTitle: string } | null;
  company: { id: string; name: string; domain: string } | null;
  tags?: { tag: TagInfo }[];
}

interface Activity {
  id: string;
  type: string;
  metadata: Record<string, string>;
  createdAt: string;
  user: { name: string };
}

interface LeadDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

const TEMPERATURE_OPTIONS = [
  { value: 'COLD', label: 'Frio' },
  { value: 'WARM', label: 'Morno' },
  { value: 'HOT', label: 'Quente' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatActivityMessage(activity: Activity): string {
  switch (activity.type) {
    case 'STATUS_CHANGED':
      return `moveu de ${activity.metadata.from ?? '?'} para ${activity.metadata.to ?? '?'}`;
    case 'ASSIGNED':
      return `atribuiu para ${activity.metadata.assignee ?? '?'}`;
    case 'CREATED':
      return 'criou este lead';
    default:
      return activity.type;
  }
}

function activityIcon(type: string) {
  switch (type) {
    case 'STATUS_CHANGED':
      return <ArrowRightLeft className="size-4" />;
    case 'ASSIGNED':
      return <UserPlus className="size-4" />;
    case 'CREATED':
      return <CirclePlus className="size-4" />;
    default:
      return <Pencil className="size-4" />;
  }
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function displayToCents(display: string): number {
  const cleaned = display.replace(/[^\d,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeadDrawer({ leadId, onClose, onLeadUpdated }: LeadDrawerProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Tags
  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [showTagSelect, setShowTagSelect] = useState(false);

  // Local field state for controlled inputs
  const [estimatedValueDisplay, setEstimatedValueDisplay] = useState('');
  const [probabilityDisplay, setProbabilityDisplay] = useState('');
  const [expectedCloseDateDisplay, setExpectedCloseDateDisplay] = useState('');

  // ------ Data fetching ------

  const fetchLead = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/leads/${id}`);
      const detail: LeadDetail = data.data;
      setLead(detail);
      setEstimatedValueDisplay(centsToDisplay(detail.estimatedValue));
      setProbabilityDisplay(String(detail.probability ?? 0));
      setExpectedCloseDateDisplay(
        detail.expectedCloseDate
          ? format(new Date(detail.expectedCloseDate), 'yyyy-MM-dd')
          : '',
      );
    } catch (err) {
      console.error('Failed to fetch lead', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActivities = useCallback(async (id: string) => {
    setActivitiesLoading(true);
    try {
      const { data } = await api.get(`/leads/${id}/activities`);
      setActivities(data.data);
    } catch (err) {
      console.error('Failed to fetch activities', err);
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const { data } = await api.get('/tags');
      setAllTags(data.data);
    } catch {
      // tags are optional — silently fail
    }
  }, []);

  useEffect(() => {
    if (leadId) {
      fetchLead(leadId);
      fetchActivities(leadId);
      fetchTags();
    } else {
      setLead(null);
      setActivities([]);
    }
  }, [leadId, fetchLead, fetchActivities, fetchTags]);

  // ------ Patch helper ------

  const patchLead = useCallback(
    async (fields: Record<string, unknown>) => {
      if (!lead) return;
      try {
        const { data } = await api.patch(`/leads/${lead.id}`, {
          ...fields,
          version: lead.version,
        });
        const updated: LeadDetail = data.data;
        setLead(updated);
        onLeadUpdated();
      } catch (err) {
        console.error('Failed to update lead', err);
      }
    },
    [lead, onLeadUpdated],
  );

  // ------ Tag handlers ------

  const addTag = useCallback(
    async (tagId: string) => {
      if (!lead) return;
      try {
        await api.post(`/leads/${lead.id}/tags`, { tagId });
        await fetchLead(lead.id);
        setShowTagSelect(false);
      } catch (err) {
        console.error('Failed to add tag', err);
      }
    },
    [lead, fetchLead],
  );

  const removeTag = useCallback(
    async (tagId: string) => {
      if (!lead) return;
      try {
        await api.delete(`/leads/${lead.id}/tags/${tagId}`);
        await fetchLead(lead.id);
      } catch (err) {
        console.error('Failed to remove tag', err);
      }
    },
    [lead, fetchLead],
  );

  // ------ Title editing handlers ------

  const startEditingTitle = () => {
    if (!lead) return;
    setTitleDraft(lead.title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const saveTitle = () => {
    setEditingTitle(false);
    if (!lead || titleDraft.trim() === '' || titleDraft === lead.title) return;
    patchLead({ title: titleDraft.trim() });
  };

  // ------ Field blur handlers ------

  const handleEstimatedValueBlur = () => {
    if (!lead) return;
    const cents = displayToCents(estimatedValueDisplay);
    if (cents !== lead.estimatedValue) {
      patchLead({ estimatedValue: cents });
    }
  };

  const handleProbabilityBlur = () => {
    if (!lead) return;
    const val = Math.min(100, Math.max(0, parseInt(probabilityDisplay, 10) || 0));
    setProbabilityDisplay(String(val));
    if (val !== lead.probability) {
      patchLead({ probability: val });
    }
  };

  const handleExpectedCloseDateBlur = () => {
    if (!lead) return;
    const current = lead.expectedCloseDate
      ? format(new Date(lead.expectedCloseDate), 'yyyy-MM-dd')
      : '';
    if (expectedCloseDateDisplay !== current) {
      patchLead({
        expectedCloseDate: expectedCloseDateDisplay || null,
      });
    }
  };

  // ------ Render ------

  const isOpen = leadId !== null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" showCloseButton={false} className="w-full sm:max-w-[500px] overflow-y-auto">
        {/* Hidden description for accessibility */}
        <SheetDescription className="sr-only">Detalhes do lead</SheetDescription>

        {loading || !lead ? (
          <div className="flex flex-col gap-4 p-6">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            {/* ---- Header ---- */}
            <SheetHeader className="flex-row items-start justify-between gap-2 pr-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {editingTitle ? (
                    <Input
                      ref={titleInputRef}
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle();
                        if (e.key === 'Escape') setEditingTitle(false);
                      }}
                      className="text-base font-medium"
                    />
                  ) : (
                    <SheetTitle
                      className="cursor-pointer truncate"
                      onClick={startEditingTitle}
                    >
                      {lead.title}
                    </SheetTitle>
                  )}

                  <Badge
                    className="text-[10px] px-1.5 py-0 h-4 font-medium shrink-0 opacity-80"
                    style={{ backgroundColor: lead.status?.color, color: '#fff' }}
                  >
                    {lead.status?.name}
                  </Badge>
                </div>
              </div>

              <Button variant="ghost" size="icon-sm" onClick={onClose}>
                <X className="size-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </SheetHeader>

            {/* Tags */}
            <div className="px-6 pt-2 pb-0 flex flex-wrap items-center gap-1 min-h-[28px]">
              {lead.tags?.map(({ tag }) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="gap-1 pr-1"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => removeTag(tag.id)}
                    className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}

              {showTagSelect ? (
                <div className="flex items-center gap-1">
                  <Select onValueChange={(val) => val && addTag(val as string)}>
                    <SelectTrigger className="h-6 w-35 text-xs">
                      <SelectValue placeholder="Selecionar tag" />
                    </SelectTrigger>
                    <SelectContent>
                      {allTags
                        .filter(
                          (t) => !lead.tags?.some(({ tag }) => tag.id === t.id),
                        )
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="flex items-center gap-1.5">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: t.color }}
                              />
                              {t.name}
                            </span>
                          </SelectItem>
                        ))}
                      {allTags.filter(
                        (t) => !lead.tags?.some(({ tag }) => tag.id === t.id),
                      ).length === 0 && (
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">
                          Nenhuma tag disponível
                        </p>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowTagSelect(false)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowTagSelect(true)}
                  className="size-6"
                >
                  <Plus className="size-3" />
                </Button>
              )}
            </div>

            <Separator />

            {/* ---- Contact / Company info ---- */}
            {(lead.contact || lead.company) && (
              <div className="grid gap-1 px-4 text-sm">
                {lead.contact?.name && (
                  <p>
                    <span className="text-muted-foreground">Contato:</span>{' '}
                    {lead.contact?.name ?? '—'}
                  </p>
                )}
                {lead.contact?.email && (
                  <p>
                    <span className="text-muted-foreground">Email:</span>{' '}
                    {lead.contact?.email ?? '—'}
                  </p>
                )}
                {lead.contact?.phone && (
                  <p>
                    <span className="text-muted-foreground">Telefone:</span>{' '}
                    {lead.contact?.phone ?? '—'}
                  </p>
                )}
                {lead.company?.name && (
                  <p>
                    <span className="text-muted-foreground">Empresa:</span>{' '}
                    {lead.company?.name ?? '—'}
                  </p>
                )}
              </div>
            )}

            <Separator className="mx-4" />

            {/* ---- Tabs ---- */}
            <Tabs defaultValue="details" className="flex-1 px-4 pb-4">
              <TabsList variant="line">
                <TabsTrigger value="details">Detalhes</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              {/* -- Details Tab -- */}
              <TabsContent value="details" className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Priority */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Prioridade</Label>
                    <Select
                      value={lead.priority}
                      onValueChange={(val) => patchLead({ priority: val })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Temperature */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Temperatura</Label>
                    <Select
                      value={lead.temperature}
                      onValueChange={(val) => patchLead({ temperature: val })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPERATURE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Estimated Value */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Valor Estimado</Label>
                    <Input
                      value={estimatedValueDisplay}
                      onChange={(e) => setEstimatedValueDisplay(e.target.value)}
                      onBlur={handleEstimatedValueBlur}
                      placeholder="0,00"
                    />
                  </div>

                  {/* Probability */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Probabilidade %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={probabilityDisplay}
                      onChange={(e) => setProbabilityDisplay(e.target.value)}
                      onBlur={handleProbabilityBlur}
                      placeholder="0"
                    />
                  </div>

                  {/* Expected Close Date */}
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Previsão de Fechamento
                    </Label>
                    <Input
                      type="date"
                      value={expectedCloseDateDisplay}
                      onChange={(e) => setExpectedCloseDateDisplay(e.target.value)}
                      onBlur={handleExpectedCloseDateBlur}
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-6 rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">Resumo</p>
                  <div className="mt-2 grid grid-cols-2 gap-y-1 text-muted-foreground">
                    <span>Pipeline</span>
                    <span className="text-foreground">{lead.pipeline?.name ?? '—'}</span>
                    <span>Responsável</span>
                    <span className="text-foreground">
                      {lead.assignee?.name ?? 'Sem responsável'}
                    </span>
                    <span>Valor</span>
                    <span className="text-foreground font-semibold text-emerald-600">
                      {formatCurrency(lead.estimatedValue)}
                    </span>
                  </div>
                </div>
              </TabsContent>

              {/* -- Timeline Tab -- */}
              <TabsContent value="timeline" className="pt-4">
                {activitiesLoading ? (
                  <div className="flex flex-col gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma atividade registrada.
                  </p>
                ) : (
                  <ol className="relative border-l border-border ml-3">
                    {activities.map((activity) => (
                      <li key={activity.id} className="mb-6 ml-6">
                        <span className="absolute -left-3 flex size-6 items-center justify-center rounded-full bg-muted ring-4 ring-background">
                          {activityIcon(activity.type)}
                        </span>
                        <p className="text-sm">
                          <span className="font-medium">{activity.user.name}</span>{' '}
                          {formatActivityMessage(activity)}
                        </p>
                        <time className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.createdAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </time>
                      </li>
                    ))}
                  </ol>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
