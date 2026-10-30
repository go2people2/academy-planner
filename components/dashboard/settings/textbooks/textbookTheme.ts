export const getCardStyle = (isLight: boolean) =>
  isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#111111] border-gray-800';

export const getTableHeaderStyle = (isLight: boolean) =>
  isLight ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-[#181818] border-gray-800 text-gray-400';

export const getTableDivideStyle = (isLight: boolean) =>
  isLight ? 'divide-gray-200' : 'divide-gray-800/60';

export const getSearchInputStyle = (isLight: boolean) =>
  isLight
    ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
    : 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500';

export const getFilterGroupStyle = (isLight: boolean) =>
  isLight ? 'bg-gray-100 border-gray-200' : 'bg-gray-900/60 border-gray-800';

export const getFilterInactiveBtnStyle = (isLight: boolean) =>
  isLight ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60' : 'text-gray-400 hover:text-white hover:bg-gray-800';

export const getRowHoverStyle = (isLight: boolean) =>
  isLight ? 'hover:bg-gray-50' : 'hover:bg-gray-800/30';

export const getInputStyle = (isLight: boolean) =>
  isLight
    ? 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
    : 'bg-gray-900 border-gray-700 text-white focus:border-indigo-500';
