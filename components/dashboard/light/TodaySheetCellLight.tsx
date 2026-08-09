'use client';

import React from 'react';
import { TodaySheetCell, TodaySheetCellProps, resolveTargetSession } from '../todaySheet/TodaySheetCell';

export const TodaySheetCellLight = React.memo(function TodaySheetCellLight(props: TodaySheetCellProps) {
  return <TodaySheetCell {...props} isLight={true} />;
});

export default TodaySheetCellLight;
export { resolveTargetSession };
