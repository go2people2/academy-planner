'use client';

import React from 'react';
import Overview, { OverviewProps } from '../Overview';

export default function OverviewLight(props: OverviewProps) {
  return <Overview {...props} isLight={true} />;
}
