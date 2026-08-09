'use client';

import React from 'react';
import TodaySheet, { TodaySheetProps } from '../TodaySheet';

export default function TodaySheetLight(props: TodaySheetProps) {
  return <TodaySheet {...props} isLight={true} />;
}
