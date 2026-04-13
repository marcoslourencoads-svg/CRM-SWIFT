'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  closestCorners,
  rectIntersection,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import api from '@/lib/api';
import { DroppableColumn } from './droppable-column';
import { LeadCard, type Lead } from './lead-card';
import { CreateLeadDialog } from './create-lead-dialog';
import { LeadDrawer } from './lead-drawer';

interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface KanbanBoardProps {
  pipelineId: string;
  statuses: Status[];
  initialLeads: Lead[];
  onRefresh: () => void;
}

export function KanbanBoard({
  pipelineId,
  statuses,
  initialLeads,
  onRefresh,
}: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStatusId, setDialogStatusId] = useState<string>('');

  // Keep leads in sync when parent refetches
  const [prevInitial, setPrevInitial] = useState(initialLeads);
  if (initialLeads !== prevInitial) {
    setLeads(initialLeads);
    setPrevInitial(initialLeads);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  const sortedStatuses = [...statuses].sort((a, b) => a.position - b.position);
  const statusIds = new Set(sortedStatuses.map((s) => s.id));

  // Custom collision: try pointerWithin first (precise), then rectIntersection (broad)
  // Prioritize column droppables over card droppables
  const collisionDetection = useCallback(
    (args: Parameters<typeof pointerWithin>[0]) => {
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) {
        // Prefer column over card
        const columnHit = pointerCollisions.find((c) => statusIds.has(c.id as string));
        if (columnHit) return [columnHit];
        return pointerCollisions;
      }
      return rectIntersection(args);
    },
    [statusIds],
  );

  function getLeadsForStatus(statusId: string) {
    return leads
      .filter((l) => l.status.id === statusId)
      .sort((a, b) => a.position - b.position);
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeLeadId = active.id as string;
    const overId = over.id as string;

    // Check if over is a column (status) or another lead
    const overIsColumn = statusIds.has(overId);
    const targetStatusId = overIsColumn
      ? overId
      : leads.find((l) => l.id === overId)?.status.id;

    if (!targetStatusId) return;

    // Find full status to preserve name/color
    const targetStatus = sortedStatuses.find((s) => s.id === targetStatusId);
    if (!targetStatus) return;

    setLeads((prev) => {
      const lead = prev.find((l) => l.id === activeLeadId);
      if (!lead || lead.status.id === targetStatusId) return prev;

      return prev.map((l) =>
        l.id === activeLeadId
          ? { ...l, status: { id: targetStatus.id, name: targetStatus.name, color: targetStatus.color } }
          : l,
      );
    });
  }, [leads, sortedStatuses]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const leadId = active.id as string;
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;

      const overId = over.id as string;
      const overIsColumn = sortedStatuses.some((s) => s.id === overId);
      const targetStatusId = overIsColumn
        ? overId
        : leads.find((l) => l.id === overId)?.status.id;

      if (!targetStatusId) return;

      try {
        await api.patch(`/leads/${leadId}/move`, {
          statusId: targetStatusId,
        });
        onRefresh();
      } catch (err) {
        console.error('Failed to move lead:', err);
        onRefresh(); // revert by re-fetching
      }
    },
    [leads, sortedStatuses, onRefresh],
  );

  function handleAddLead(statusId: string) {
    setDialogStatusId(statusId);
    setDialogOpen(true);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {sortedStatuses.map((status) => (
            <DroppableColumn
              key={status.id}
              status={status}
              leads={getLeadsForStatus(status.id)}
              onAddLead={handleAddLead}
              onLeadClick={setSelectedLeadId}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <CreateLeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pipelineId={pipelineId}
        statusId={dialogStatusId}
        onCreated={onRefresh}
      />

      <LeadDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={onRefresh}
      />
    </>
  );
}
