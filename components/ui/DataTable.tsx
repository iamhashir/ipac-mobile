import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react-native';

export type SortDirection = 'asc' | 'desc' | null;

export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor: (row: T) => any;
  sortable?: boolean;
  width?: number;
  minWidth?: number;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  sortColumn,
  sortDirection,
  onSort,
  emptyMessage = 'No data available'
}: DataTableProps<T>) {
  return (
    <View className="bg-white rounded-lg border border-gray-200 overflow-hidden flex-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View style={{ minWidth: '100%' }}>
          {/* Table Header */}
          <View className="flex-row bg-gray-50 border-b border-gray-200">
            {columns.map((column) => (
              <TableHeader
                key={column.key}
                column={column}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={onSort}
              />
            ))}
          </View>

          {/* Table Body */}
          <ScrollView className="flex-1">
            {data.length === 0 ? (
              <View className="p-8 items-center justify-center">
                <Text className="text-gray-500 text-center">{emptyMessage}</Text>
              </View>
            ) : (
              data.map((row, index) => (
                <TableRow key={index} columns={columns} row={row} index={index} />
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

interface TableHeaderProps<T> {
  column: ColumnDef<T>;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
}

function TableHeader<T>({
  column,
  sortColumn,
  sortDirection,
  onSort,
}: TableHeaderProps<T>) {
  const isSorted = sortColumn === column.key;
  const width = column.width || column.minWidth || 150;

  return (
    <View
      style={[styles.headerCell, { width, minWidth: column.minWidth || width }]}
      className="border-r border-gray-200"
    >
      {column.sortable !== false ? (
        <TouchableOpacity
          onPress={() => onSort(column.key)}
          className="flex-row items-center justify-between px-4 py-3 flex-1"
          activeOpacity={0.7}
        >
          <Text className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            {column.header}
          </Text>
          <View className="ml-2">
            {!isSorted ? (
              <ChevronsUpDown size={14} color="#9ca3af" />
            ) : sortDirection === 'asc' ? (
              <ChevronUp size={14} color="#3b82f6" />
            ) : (
              <ChevronDown size={14} color="#3b82f6" />
            )}
          </View>
        </TouchableOpacity>
      ) : (
        <View className="px-4 py-3">
          <Text className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            {column.header}
          </Text>
        </View>
      )}
    </View>
  );
}

interface TableRowProps<T> {
  columns: ColumnDef<T>[];
  row: T;
  index: number;
}

function TableRow<T>({ columns, row, index }: TableRowProps<T>) {
  return (
    <View
      className={`flex-row border-b border-gray-100 ${
        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
      }`}
    >
      {columns.map((column) => (
        <TableCell key={column.key} column={column} row={row} />
      ))}
    </View>
  );
}

interface TableCellProps<T> {
  column: ColumnDef<T>;
  row: T;
}

function TableCell<T>({ column, row }: TableCellProps<T>) {
  const value = column.accessor(row);
  const width = column.width || column.minWidth || 150;

  return (
    <View
      style={[styles.cell, { width, minWidth: column.minWidth || width }]}
      className="px-4 py-3 border-r border-gray-100"
    >
      {column.render ? (
        column.render(value, row)
      ) : (
        <Text className="text-sm text-gray-900" numberOfLines={2}>
          {value != null ? String(value) : '-'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cell: {
    justifyContent: 'center',
  },
});
