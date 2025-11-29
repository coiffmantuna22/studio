
import type { Teacher, SchoolClass, TimeSlot } from './types';
import { daysOfWeek } from './constants';

export const initialTimeSlots: TimeSlot[] = [
  { id: "1", start: '08:00', end: '08:45', type: 'lesson' },
  { id: "2", start: '08:45', end: '09:30', type: 'lesson' },
  { id: "3", start: '09:30', end: '10:00', type: 'break' },
  { id: "4", start: '10:00', end: '10:45', type: 'lesson' },
  { id: "5", start: '10:45', end: '11:30', type: 'lesson' },
  { id: "6", start: '11:30', end: '12:00', type: 'break' },
  { id: "7", start: '12:00', end: '12:45', type: 'lesson' },
  { id: "8", start: '12:45', end: '13:30', type: 'lesson' },
];

// All initial data has been removed to prepare the app for deployment.
export const initialTeachers: Omit<Teacher, 'id' | 'userId' | 'schedule' | 'avatar' | 'absences'>[] = [];

export const initialClasses: Omit<SchoolClass, 'id' | 'userId'>[] = [];
