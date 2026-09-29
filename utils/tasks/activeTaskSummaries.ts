export interface RawActiveTaskRow {
  task_log_id?: string | null;
  task_name?: string | null;
  packer_id?: string | null;
  task_status?: string | null;
  package_numbers?: Array<number | string | null> | null;
}

export interface ActiveTaskSummary {
  task: string;
  packerNames: string[];
  boxes: Array<number | string | null>;
}

const fallbackName = (value?: string | null, placeholder = 'Task') => {
  if (value && value.trim().length > 0) {
    return value;
  }
  return placeholder;
};

export const buildActiveTaskSummaries = (
  rows: RawActiveTaskRow[] | null | undefined,
  idToName: Record<string, string>
): ActiveTaskSummary[] => {
  if (!rows || rows.length === 0) {
    return [];
  }

  const aggregated = new Map<string, { taskName: string; packerIds: Set<string>; boxes: Set<number | string | null> }>();

  rows.forEach((row) => {
    if (!row?.task_log_id || !row?.packer_id) {
      return;
    }

    const existing = aggregated.get(row.task_log_id) ?? {
      taskName: fallbackName(row.task_name),
      packerIds: new Set<string>(),
      boxes: new Set<number | string | null>(),
    };

    existing.taskName = fallbackName(row.task_name, existing.taskName);
    existing.packerIds.add(row.packer_id);

    (row.package_numbers || []).forEach((pkgNumber) => {
      existing.boxes.add(pkgNumber);
    });

    aggregated.set(row.task_log_id, existing);
  });

  return Array.from(aggregated.values()).map(({ taskName, packerIds, boxes }) => ({
    task: taskName,
    packerNames: Array.from(packerIds).map((id) => idToName[id] || 'Unknown'),
    boxes: Array.from(boxes),
  }));
};

export const formatPackerList = (names: string[]): string => {
  if (!names || names.length === 0) {
    return '—';
  }
  return names.join(', ');
};

export const formatBoxList = (boxes: Array<number | string | null>): string => {
  if (!boxes || boxes.length === 0) {
    return '—';
  }
  return boxes.map((value) => {
    if (value === null || value === undefined || value === '') {
      return 'Box #—';
    }
    return `Box #${value}`;
  }).join(', ');
};
