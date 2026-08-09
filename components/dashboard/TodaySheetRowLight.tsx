'use client';

import React from 'react';
import { TodaySheetRow, TodaySheetRowProps } from './TodaySheetRow';

export const TodaySheetRowLight = React.memo(function TodaySheetRowLight(props: TodaySheetRowProps) {
  return <TodaySheetRow {...props} isLight={true} />;
});

export default TodaySheetRowLight;
