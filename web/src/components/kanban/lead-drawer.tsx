'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRightLeft,
  CalendarIcon,
  CirclePlus,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Tag,
  Trash2,
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeadActionsMenu } from './lead-actions/lead-actions-menu';
import { MarkLostDialog } from './lead-actions/mark-lost-dialog';
import { MarkWonDialog } from './lead-actions/mark-won-dialog';
import { DeleteLeadDialog } from './lead-actions/delete-lead-dialog';
import { WhatsappDialog } from './lead-actions/whatsapp-dialog';
import { LeadMessagesTab } from './lead-messages-tab';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TagInfo {
  id: string;
  name: string;
  color: string;
}

type CustomFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'CURRENCY'
  | 'DATE'
  | 'DATETIME'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'CHECKBOX'
  | 'URL'
  | 'PHONE'
  | 'EMAIL'
  | 'RATING'
  | 'PERCENTAGE';

interface CustomFieldDefinition {
  id: string;
  pipelineId: string;
  name: string;
  slug: string;
  type: CustomFieldType;
  options: string[] | null;
  defaultValue: string | null;
  isRequired: boolean;
  position: number;
}

interface CustomFieldValueEntry {
  id: string;
  fieldDefinitionId: string;
  textValue: string | null;
  numberValue: number | null;
  dateValue: string | null;
  booleanValue: boolean | null;
  jsonValue: unknown;
  fieldDefinition: CustomFieldDefinition;
}

interface NoteEntry {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
}

interface TaskEntry {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completedAt: string | null;
  priority: string;
  createdAt: string;
  assignee: { id: string; name: string; avatarUrl?: string | null } | null;
  creator: { id: string; name: string };
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
  notes?: NoteEntry[];
  customFieldValues?: CustomFieldValueEntry[];
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

function getCustomFieldDisplayValue(value: CustomFieldValueEntry | undefined): string | number | boolean | string[] | null {
  if (!value) return null;
  switch (value.fieldDefinition.type) {
    case 'NUMBER':
    case 'CURRENCY':
    case 'RATING':
    case 'PERCENTAGE':
      return value.numberValue;
    case 'CHECKBOX':
      return value.booleanValue;
    case 'DATE':
    case 'DATETIME':
      return value.dateValue;
    case 'MULTI_SELECT':
      return Array.isArray(value.jsonValue) ? (value.jsonValue as string[]) : null;
    default:
      return value.textValue;
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

  // Notes
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteDraft, setEditingNoteDraft] = useState('');

  // Custom field definitions for the lead's pipeline
  const [fieldDefinitions, setFieldDefinitions] = useState<CustomFieldDefinition[]>([]);

  // Lead actions
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [showWonDialog, setShowWonDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showWhatsappDialog, setShowWhatsappDialog] = useState(false);

  // Tasks
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [taskDraftTitle, setTaskDraftTitle] = useState('');
  const [taskDraftDueDate, setTaskDraftDueDate] = useState('');
  const [taskDraftType, setTaskDraftType] = useState<'TASK' | 'CALL' | 'MEETING' | 'EMAIL' | 'DEADLINE' | 'LUNCH'>('TASK');
  const [savingTask, setSavingTask] = useState(false);

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

  const fetchFieldDefinitions = useCallback(async (pipelineId: string) => {
    try {
      const { data } = await api.get(
        `/pipelines/${pipelineId}/custom-fields`,
      );
      setFieldDefinitions(data.data ?? []);
    } catch {
      // custom fields are optional — silently fail
    }
  }, []);

  const fetchTasks = useCallback(async (id: string) => {
    try {
      const { data } = await api.get(`/leads/${id}/tasks`);
      setTasks(data.data ?? []);
    } catch {
      // tasks are optional
    }
  }, []);

  useEffect(() => {
    if (leadId) {
      fetchLead(leadId);
      fetchActivities(leadId);
      fetchTags();
      fetchTasks(leadId);
    } else {
      setLead(null);
      setActivities([]);
      setFieldDefinitions([]);
      setTasks([]);
    }
  }, [leadId, fetchLead, fetchActivities, fetchTags, fetchTasks]);

  useEffect(() => {
    if (lead?.pipeline?.id) {
      fetchFieldDefinitions(lead.pipeline.id);
    }
  }, [lead?.pipeline?.id, fetchFieldDefinitions]);

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

  // ------ Note handlers ------

  const submitNote = useCallback(async () => {
    if (!lead) return;
    const content = noteDraft.trim();
    if (!content) return;
    setSavingNote(true);
    try {
      await api.post(`/leads/${lead.id}/notes`, { content });
      setNoteDraft('');
      await fetchLead(lead.id);
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setSavingNote(false);
    }
  }, [lead, noteDraft, fetchLead]);

  const startEditingNote = (note: NoteEntry) => {
    setEditingNoteId(note.id);
    setEditingNoteDraft(note.content);
  };

  const saveEditingNote = useCallback(async () => {
    if (!lead || !editingNoteId) return;
    const content = editingNoteDraft.trim();
    if (!content) return;
    try {
      await api.patch(`/notes/${editingNoteId}`, { content });
      setEditingNoteId(null);
      setEditingNoteDraft('');
      await fetchLead(lead.id);
    } catch (err) {
      console.error('Failed to update note', err);
    }
  }, [lead, editingNoteId, editingNoteDraft, fetchLead]);

  const deleteNote = useCallback(
    async (noteId: string) => {
      if (!lead) return;
      if (!window.confirm('Tem certeza que quer apagar esta nota?')) return;
      try {
        await api.delete(`/notes/${noteId}`);
        await fetchLead(lead.id);
      } catch (err) {
        console.error('Failed to delete note', err);
      }
    },
    [lead, fetchLead],
  );

  // ------ Task handlers ------

  const submitTask = useCallback(async () => {
    if (!lead) return;
    const title = taskDraftTitle.trim();
    if (!title) return;
    setSavingTask(true);
    try {
      const payload: { title: string; type: string; dueDate?: string } = {
        title,
        type: taskDraftType,
      };
      if (taskDraftDueDate) payload.dueDate = new Date(taskDraftDueDate).toISOString();
      await api.post(`/leads/${lead.id}/tasks`, payload);
      setTaskDraftTitle('');
      setTaskDraftDueDate('');
      setTaskDraftType('TASK');
      await fetchTasks(lead.id);
    } catch (err) {
      console.error('Failed to add task', err);
    } finally {
      setSavingTask(false);
    }
  }, [lead, taskDraftTitle, taskDraftDueDate, taskDraftType, fetchTasks]);

  const completeTask = useCallback(
    async (taskId: string) => {
      if (!lead) return;
      try {
        await api.patch(`/tasks/${taskId}/complete`);
        await fetchTasks(lead.id);
      } catch (err) {
        console.error('Failed to complete task', err);
      }
    },
    [lead, fetchTasks],
  );

  // ------ Custom field handlers ------

  const setCustomFieldValue = useCallback(
    async (fieldDefinitionId: string, value: unknown) => {
      if (!lead) return;
      try {
        await api.put(`/leads/${lead.id}/custom-fields`, {
          values: [{ fieldDefinitionId, value }],
        });
        await fetchLead(lead.id);
      } catch (err) {
        console.error('Failed to set custom field value', err);
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

              <div className="flex items-center gap-1">
                {lead.contact?.phone && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowWhatsappDialog(true)}
                    title="Mandar WhatsApp"
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    <MessageSquare className="size-4" />
                  </Button>
                )}
                <LeadActionsMenu
                  onMarkWon={() => setShowWonDialog(true)}
                  onMarkLost={() => setShowLostDialog(true)}
                  onDelete={() => setShowDeleteDialog(true)}
                />
                <Button variant="ghost" size="icon-sm" onClick={onClose}>
                  <X className="size-4" />
                  <span className="sr-only">Fechar</span>
                </Button>
              </div>
            </SheetHeader>

            <MarkLostDialog
              open={showLostDialog}
              onOpenChange={setShowLostDialog}
              leadId={lead.id}
              pipelineId={lead.pipeline.id}
              leadVersion={lead.version}
              onSuccess={() => {
                fetchLead(lead.id);
                onLeadUpdated();
              }}
            />
            <MarkWonDialog
              open={showWonDialog}
              onOpenChange={setShowWonDialog}
              leadId={lead.id}
              pipelineId={lead.pipeline.id}
              leadVersion={lead.version}
              currentEstimatedValue={lead.estimatedValue}
              onSuccess={() => {
                fetchLead(lead.id);
                onLeadUpdated();
              }}
            />
            <DeleteLeadDialog
              open={showDeleteDialog}
              onOpenChange={setShowDeleteDialog}
              leadId={lead.id}
              leadTitle={lead.title}
              onSuccess={() => {
                onClose();
                onLeadUpdated();
              }}
            />
            <WhatsappDialog
              open={showWhatsappDialog}
              onOpenChange={setShowWhatsappDialog}
              leadId={lead.id}
              leadName={lead.contact?.name ?? lead.title}
              leadPhone={lead.contact?.phone ?? null}
              companyName={lead.company?.name ?? null}
            />

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
                <TabsTrigger value="tasks">
                  Tarefas
                  {tasks.filter((t) => !t.completedAt).length > 0 && (
                    <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0 text-[10px] font-semibold text-white">
                      {tasks.filter((t) => !t.completedAt).length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="messages">Mensagens</TabsTrigger>
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

                {/* Custom Fields */}
                {fieldDefinitions.length > 0 && (
                  <div className="mt-6">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Campos adicionais
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {fieldDefinitions.map((def) => {
                        const valueEntry = lead.customFieldValues?.find(
                          (v) => v.fieldDefinitionId === def.id,
                        );
                        const current = getCustomFieldDisplayValue(valueEntry);

                        return (
                          <div
                            key={def.id}
                            className={
                              def.type === 'TEXTAREA' || def.type === 'MULTI_SELECT'
                                ? 'col-span-2 flex flex-col gap-1.5'
                                : 'flex flex-col gap-1.5'
                            }
                          >
                            <Label className="text-xs text-muted-foreground">
                              {def.name}
                              {def.isRequired && <span className="ml-0.5 text-red-500">*</span>}
                            </Label>

                            {def.type === 'SELECT' && (
                              <Select
                                value={(current as string) ?? ''}
                                onValueChange={(val) =>
                                  setCustomFieldValue(def.id, val || null)
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(def.options ?? []).map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {def.type === 'CHECKBOX' && (
                              <div className="flex h-9 items-center">
                                <Switch
                                  checked={Boolean(current)}
                                  onCheckedChange={(checked) =>
                                    setCustomFieldValue(def.id, checked)
                                  }
                                />
                              </div>
                            )}

                            {(def.type === 'NUMBER' ||
                              def.type === 'CURRENCY' ||
                              def.type === 'RATING' ||
                              def.type === 'PERCENTAGE') && (
                              <Input
                                type="number"
                                defaultValue={current != null ? String(current) : ''}
                                onBlur={(e) => {
                                  const v = e.target.value;
                                  const num = v === '' ? null : Number(v);
                                  if (num !== current) setCustomFieldValue(def.id, num);
                                }}
                                placeholder="0"
                              />
                            )}

                            {(def.type === 'DATE' || def.type === 'DATETIME') && (
                              <Input
                                type={def.type === 'DATETIME' ? 'datetime-local' : 'date'}
                                defaultValue={
                                  current
                                    ? format(
                                        new Date(current as string),
                                        def.type === 'DATETIME' ? "yyyy-MM-dd'T'HH:mm" : 'yyyy-MM-dd',
                                      )
                                    : ''
                                }
                                onBlur={(e) => setCustomFieldValue(def.id, e.target.value || null)}
                              />
                            )}

                            {def.type === 'TEXTAREA' && (
                              <textarea
                                defaultValue={(current as string) ?? ''}
                                onBlur={(e) => setCustomFieldValue(def.id, e.target.value || null)}
                                placeholder="..."
                                className="min-h-[72px] rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              />
                            )}

                            {(def.type === 'TEXT' ||
                              def.type === 'URL' ||
                              def.type === 'PHONE' ||
                              def.type === 'EMAIL') && (
                              <Input
                                defaultValue={(current as string) ?? ''}
                                onBlur={(e) => setCustomFieldValue(def.id, e.target.value || null)}
                                placeholder="..."
                              />
                            )}

                            {def.type === 'MULTI_SELECT' && (
                              <div className="flex flex-wrap gap-1">
                                {(def.options ?? []).map((opt) => {
                                  const arr = Array.isArray(current) ? (current as string[]) : [];
                                  const active = arr.includes(opt);
                                  return (
                                    <button
                                      type="button"
                                      key={opt}
                                      onClick={() => {
                                        const next = active
                                          ? arr.filter((x) => x !== opt)
                                          : [...arr, opt];
                                        setCustomFieldValue(def.id, next);
                                      }}
                                      className={`rounded-full border px-2 py-0.5 text-xs ${
                                        active
                                          ? 'border-primary bg-primary/10 text-primary'
                                          : 'border-border text-muted-foreground hover:bg-muted'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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

              {/* -- Tasks Tab -- */}
              <TabsContent value="tasks" className="pt-4">
                {/* Add task box */}
                <div className="mb-4 rounded-lg border bg-muted/30 p-3 space-y-2">
                  <Input
                    value={taskDraftTitle}
                    onChange={(e) => setTaskDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        submitTask();
                      }
                    }}
                    placeholder="O que precisa ser feito?"
                  />
                  <div className="flex items-center gap-2">
                    <Select
                      value={taskDraftType}
                      onValueChange={(v) =>
                        setTaskDraftType(
                          (v ?? 'TASK') as 'TASK' | 'CALL' | 'MEETING' | 'EMAIL' | 'DEADLINE' | 'LUNCH',
                        )
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TASK">Tarefa</SelectItem>
                        <SelectItem value="CALL">Ligação</SelectItem>
                        <SelectItem value="MEETING">Reunião</SelectItem>
                        <SelectItem value="EMAIL">E-mail</SelectItem>
                        <SelectItem value="DEADLINE">Prazo</SelectItem>
                        <SelectItem value="LUNCH">Almoço</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="datetime-local"
                      value={taskDraftDueDate}
                      onChange={(e) => setTaskDraftDueDate(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={submitTask}
                      disabled={savingTask || !taskDraftTitle.trim()}
                    >
                      <Plus className="size-3 mr-1" />
                      {savingTask ? 'Salvando...' : 'Adicionar'}
                    </Button>
                  </div>
                </div>

                {/* Tasks list */}
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma tarefa. Adicione uma acima.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => {
                      const overdue =
                        !task.completedAt &&
                        task.dueDate &&
                        new Date(task.dueDate) < new Date();
                      return (
                        <div
                          key={task.id}
                          className={
                            'rounded-lg border p-3 ' +
                            (task.completedAt
                              ? 'bg-muted/40 opacity-60'
                              : overdue
                              ? 'border-red-300 bg-red-50/60'
                              : 'bg-background')
                          }
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={!!task.completedAt}
                              disabled={!!task.completedAt}
                              onChange={() => completeTask(task.id)}
                              className="mt-1 h-4 w-4 rounded border-border"
                            />
                            <div className="flex-1 min-w-0">
                              <p
                                className={
                                  'text-sm font-medium ' +
                                  (task.completedAt ? 'line-through' : '')
                                }
                              >
                                {task.title}
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                {task.dueDate && (
                                  <span
                                    className={
                                      overdue ? 'text-red-600 font-semibold' : ''
                                    }
                                  >
                                    <CalendarIcon className="inline size-3 mr-0.5" />
                                    {format(new Date(task.dueDate), "dd/MM/yyyy 'às' HH:mm")}
                                    {overdue ? ' (atrasada)' : ''}
                                  </span>
                                )}
                                {task.assignee && (
                                  <span>· {task.assignee.name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* -- Messages Tab -- */}
              <TabsContent value="messages" className="pt-4">
                <LeadMessagesTab leadId={lead.id} />
              </TabsContent>

              {/* -- Timeline Tab -- */}
              <TabsContent value="timeline" className="pt-4">
                {/* Add note box */}
                <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        submitNote();
                      }
                    }}
                    placeholder="Adicionar nota... (Ctrl+Enter pra salvar)"
                    className="min-h-[72px] w-full resize-none border-0 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-end">
                    <Button
                      size="sm"
                      onClick={submitNote}
                      disabled={savingNote || !noteDraft.trim()}
                    >
                      <MessageSquare className="size-3 mr-1" />
                      {savingNote ? 'Salvando...' : 'Salvar nota'}
                    </Button>
                  </div>
                </div>

                {/* Notes list */}
                {(lead.notes?.length ?? 0) > 0 && (
                  <div className="mb-4 space-y-2">
                    {lead.notes!.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-lg border border-amber-200 bg-amber-50/60 p-3"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs">
                            <MessageSquare className="size-3 text-amber-600" />
                            <span className="font-medium">{note.user.name}</span>
                            <span className="text-muted-foreground">
                              {formatDistanceToNow(new Date(note.createdAt), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => startEditingNote(note)}
                              className="size-6"
                            >
                              <Pencil className="size-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => deleteNote(note.id)}
                              className="size-6"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>

                        {editingNoteId === note.id ? (
                          <div>
                            <textarea
                              value={editingNoteDraft}
                              onChange={(e) => setEditingNoteDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                  e.preventDefault();
                                  saveEditingNote();
                                }
                                if (e.key === 'Escape') setEditingNoteId(null);
                              }}
                              className="min-h-[72px] w-full resize-none rounded border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                              autoFocus
                            />
                            <div className="mt-2 flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingNoteId(null)}
                              >
                                Cancelar
                              </Button>
                              <Button size="sm" onClick={saveEditingNote}>
                                <Save className="size-3 mr-1" />
                                Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Activities list */}
                {activitiesLoading ? (
                  <div className="flex flex-col gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : activities.length === 0 && (lead.notes?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma atividade registrada.
                  </p>
                ) : activities.length > 0 ? (
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
                ) : null}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>

      {lead && (
        <>
          <MarkLostDialog
            open={showLostDialog}
            onOpenChange={setShowLostDialog}
            leadId={lead.id}
            pipelineId={lead.pipeline.id}
            leadVersion={lead.version}
            onSuccess={() => {
              onLeadUpdated();
              onClose();
            }}
          />
          <MarkWonDialog
            open={showWonDialog}
            onOpenChange={setShowWonDialog}
            leadId={lead.id}
            pipelineId={lead.pipeline.id}
            leadVersion={lead.version}
            currentEstimatedValue={lead.estimatedValue}
            onSuccess={() => {
              onLeadUpdated();
              onClose();
            }}
          />
          <DeleteLeadDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            leadId={lead.id}
            leadTitle={lead.title}
            onSuccess={() => {
              onLeadUpdated();
              onClose();
            }}
          />
        </>
      )}
    </Sheet>
  );
}
