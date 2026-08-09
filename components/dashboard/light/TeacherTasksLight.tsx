'use client';

import React from 'react';
import TeacherTasks, { TeacherTasksProps } from '../TeacherTasks';

export default function TeacherTasksLight(props: TeacherTasksProps) {
  return <TeacherTasks {...props} isLight={true} />;
}
