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
  isLight?: boolean;
}

export default function TextbookUnitRow({
  unit,
  index,
  readOnly = false,
  onChange,
  onDelete,
  isLight = false,
}: TextbookUnitRowProps) {
  const inputClass = `w-full px-2 py-1 rounded text-xs focus:outline-none focus:border-indigo-500 border ${
    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-white'
  }`;

  return (
    <tr className={`${isLight ? 'hover:bg-gray-50' : 'hover:bg-gray-800/30'} transition-colors`}>
      <td className={`py-1.5 px-3 text-center font-mono ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
        {index + 1}
      </td>
      <td className="py-1.5 px-3">
        {readOnly ? (
          <span className={`text-xs block py-1 font-medium ${isLight ? 'text-gray-900' : 'text-white'}`}>{unit.unit_name}</span>
        ) : (
          <input
            type="text"
            value={unit.unit_name}
            onChange={(e) => onChange(index, 'unit_name', e.target.value)}
            className={inputClass}
          />
        )}
      </td>
      <td className="py-1.5 px-3">
        {readOnly ? (
          <span className={`font-mono text-xs block py-1 text-center ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>{unit.start_page}</span>
        ) : (
          <input
            type="number"
            value={unit.start_page}
            onChange={(e) => onChange(index, 'start_page', parseInt(e.target.value, 10) || 0)}
            className={`${inputClass} text-center`}
          />
        )}
      </td>
      <td className="py-1.5 px-3">
        {readOnly ? (
          <span className={`font-mono text-xs block py-1 text-center ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>{unit.end_page}</span>
        ) : (
          <input
            type="number"
            value={unit.end_page}
            onChange={(e) => onChange(index, 'end_page', parseInt(e.target.value, 10) || 0)}
            className={`${inputClass} text-center`}
          />
        )}
      </td>
      {!readOnly && (
        <td className="py-1.5 px-3 text-center">
          <button
            onClick={() => onDelete(index)}
            className={`p-1 rounded transition-colors ${isLight ? 'text-gray-400 hover:text-red-600' : 'text-gray-500 hover:text-red-400'}`}
            title="단원 삭제"
          >
            <Trash2 size={14} />
          </button>
        </td>
      )}
    </tr>
  );
}
