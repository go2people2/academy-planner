'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';

export interface UnitRowData {
  id?: string;
  bookcode: string;
  unit_order: number;
  unit_name: string;
  start_page: number;
  end_page: number;
}

interface TextbookUnitRowProps {
  unit: UnitRowData;
  index: number;
  readOnly?: boolean;
  onChange: (index: number, field: keyof UnitRowData, val: any) => void;
  onDelete: (index: number) => void;
}

export default function TextbookUnitRow({
  unit,
  index,
  readOnly = false,
  onChange,
  onDelete,
}: TextbookUnitRowProps) {
  return (
    <tr className="hover:bg-gray-800/30 transition-colors">
      <td className="py-1.5 px-3 text-center font-mono text-gray-500">
        {index + 1}
      </td>
      <td className="py-1.5 px-3">
        {readOnly ? (
          <span className="text-white text-xs block py-1 font-medium">{unit.unit_name}</span>
        ) : (
          <input
            type="text"
            value={unit.unit_name}
            onChange={(e) => onChange(index, 'unit_name', e.target.value)}
            className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-indigo-500"
          />
        )}
      </td>
      <td className="py-1.5 px-3">
        {readOnly ? (
          <span className="text-gray-300 font-mono text-xs block py-1 text-center">{unit.start_page}</span>
        ) : (
          <input
            type="number"
            value={unit.start_page}
            onChange={(e) => onChange(index, 'start_page', parseInt(e.target.value, 10) || 0)}
            className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-xs text-center focus:outline-none focus:border-indigo-500"
          />
        )}
      </td>
      <td className="py-1.5 px-3">
        {readOnly ? (
          <span className="text-gray-300 font-mono text-xs block py-1 text-center">{unit.end_page}</span>
        ) : (
          <input
            type="number"
            value={unit.end_page}
            onChange={(e) => onChange(index, 'end_page', parseInt(e.target.value, 10) || 0)}
            className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-xs text-center focus:outline-none focus:border-indigo-500"
          />
        )}
      </td>
      {!readOnly && (
        <td className="py-1.5 px-3 text-center">
          <button
            onClick={() => onDelete(index)}
            className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
            title="단원 삭제"
          >
            <Trash2 size={14} />
          </button>
        </td>
      )}
    </tr>
  );
}
