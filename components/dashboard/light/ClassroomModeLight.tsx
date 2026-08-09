'use client';

import React from 'react';
import ClassroomMode, { ClassroomModeProps } from '../ClassroomMode';

export default function ClassroomModeLight(props: ClassroomModeProps) {
  return <ClassroomMode {...props} isLight={true} />;
}
