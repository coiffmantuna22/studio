import type { Teacher, SchoolClass, TimeSlot } from './types';
import { daysOfWeek } from './constants';

export const initialTimeSlots: TimeSlot[] = [];

// All initial data has been removed to prepare the app for deployment.
export const initialTeachers: Omit<Teacher, 'id' | 'userId' | 'schedule' | 'avatar' | 'absences'>[] = [];

export const initialClasses: Omit<SchoolClass, 'id' | 'userId'>[] = [];
