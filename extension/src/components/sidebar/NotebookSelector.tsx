import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '@/src/db/database';
import { useSidebarStore } from '@/src/store/sidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';

export function NotebookSelector() {
  const { activeNotebookUuid, setActiveNotebookUuid } = useSidebarStore();

  const notebooks = useLiveQuery(
    () => getDb().notebooks.where('isDeleted').equals(0).sortBy('displayOrder'),
    [],
    []
  );

  return (
    <Select
      value={activeNotebookUuid ?? ''}
      onValueChange={(val: string) => setActiveNotebookUuid(val || null)}
    >
      <SelectTrigger className="h-7 text-xs w-full">
        <SelectValue placeholder="Select notebook…" />
      </SelectTrigger>
      <SelectContent>
        {notebooks?.map((nb) => (
          <SelectItem key={nb.uuid} value={nb.uuid} className="text-xs">
            {nb.name}
          </SelectItem>
        ))}
        {(!notebooks || notebooks.length === 0) && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No notebooks yet
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
