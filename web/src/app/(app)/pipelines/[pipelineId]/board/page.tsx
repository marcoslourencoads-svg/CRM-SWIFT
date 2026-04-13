'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import type { Lead } from '@/components/kanban/lead-card';

interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Pipeline {
  id: string;
  name: string;
  statuses: Status[];
}

export default function BoardPage() {
  const params = useParams<{ pipelineId: string }>();
  const pipelineId = params.pipelineId;

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!pipelineId) return;
    try {
      const [pipelineRes, leadsRes] = await Promise.all([
        api.get(`/pipelines`),
        api.get(`/pipelines/${pipelineId}/leads`),
      ]);

      const found = (pipelineRes.data.data as Pipeline[]).find(
        (p) => p.id === pipelineId,
      );
      if (found) setPipeline(found);
      setLeads(leadsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch board data:', err);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72" />
          ))}
        </div>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="text-center text-muted-foreground">
        Pipeline nao encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{pipeline.name}</h1>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button variant="secondary" size="sm" disabled>
            <LayoutGrid className="mr-1.5 size-4" />
            Board
          </Button>
          <Link
            href={`/pipelines/${pipelineId}/list`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            <List className="mr-1.5 size-4" />
            Lista
          </Link>
        </div>
      </div>
      <KanbanBoard
        pipelineId={pipelineId}
        statuses={pipeline.statuses}
        initialLeads={leads}
        onRefresh={fetchData}
      />
    </div>
  );
}
