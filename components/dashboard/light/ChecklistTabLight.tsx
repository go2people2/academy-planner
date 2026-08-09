'use client';

import React, { forwardRef } from 'react';
import { ChecklistTab, ChecklistTabProps } from '../todaySheet/ChecklistTab';

export const ChecklistTabLight = forwardRef<any, ChecklistTabProps>((props, ref) => {
  return <ChecklistTab ref={ref} {...props} isLight={true} />;
});

ChecklistTabLight.displayName = 'ChecklistTabLight';
export default ChecklistTabLight;
