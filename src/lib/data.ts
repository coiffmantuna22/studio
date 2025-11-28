import type { Teacher } from './types';

const defaultAvailability = [
  { day: 'ראשון', slots: [] },
  { day: 'שני', slots: [{ start: '08:00', end: '16:00' }] },
  { day: 'שלישי', slots: [{ start: '08:00', end: '16:00' }] },
  { day: 'רביעי', slots: [{ start: '08:00', end: '12:00' }] },
  { day: 'חמישי', slots: [{ start: '08:00', end: '16:00' }] },
  { day: 'שישי', slots: [] },
];

export const initialTeachers: Teacher[] = [
  {
    id: '1',
    name: 'מריה גרסיה',
    subjects: ['מתמטיקה', 'פיזיקה'],
    availability: defaultAvailability,
    avatar: { fallback: 'מג' },
    preferences: 'מעדיפה כיתות בוגרות',
  },
  {
    id: '2',
    name: 'דוד סמית',
    subjects: ['אנגלית', 'היסטוריה'],
    availability: [
      { day: 'ראשון', slots: [] },
      { day: 'שני', slots: [] },
      { day: 'שלישי', slots: [{ start: '10:00', end: '14:00' }] },
      { day: 'רביעי', slots: [] },
      { day: 'חמישי', slots: [{ start: '10:00', end: '14:00' }] },
      { day: 'שישי', slots: [{ start: '09:00', end: '13:00' }] },
    ],
    avatar: { fallback: 'דס' },
    preferences: 'זמין להחלפות של יום שלם',
  },
  {
    id: '3',
    name: 'חן ווי',
    subjects: ['כימיה', 'ביולוגיה'],
    availability: [
      { day: 'ראשון', slots: [] },
      { day: 'שני', slots: [{ start: '09:00', end: '17:00' }] },
      { day: 'שלישי', slots: [{ start: '09:00', end: '17:00' }] },
      { day: 'רביעי', slots: [{ start: '09:00', end: '17:00' }] },
      { day: 'חמישי', slots: [{ start: '09:00', end: '17:00' }] },
      { day: 'שישי', slots: [] },
    ],
    avatar: { fallback: 'חו' },
    preferences: 'בעל ניסיון עם חינוך מיוחד',
  },
  {
    id: '4,',
    name: 'فاطمة الفاسي',
    subjects: ['אמנות', 'מוזיקה'],
    availability: [
       { day: 'ראשון', slots: [] },
       { day: 'שני', slots: [] },
       { day: 'שלישי', slots: [] },
       { day: 'רביעי', slots: [{ start: '12:00', end: '18:00' }] },
       { day: 'חמישי', slots: [] },
       { day: 'שישי', slots: [{ start: '09:00', end: '15:00' }] },
    ],
    avatar: { fallback: 'פא' },
    preferences: '',
  },
  {
    id: '5',
    name: 'מיכאל ג\'ונסון',
    subjects: ['חינוך גופני'],
    availability: [
      { day: 'ראשון', slots: [{ start: '07:00', end: '19:00' }] },
      { day: 'שני', slots: [{ start: '07:00', end: '19:00' }] },
      { day: 'שלישי', slots: [{ start: '07:00', end: '19:00' }] },
      { day: 'רביעי', slots: [{ start: '07:00', end: '19:00' }] },
      { day: 'חמישי', slots: [{ start: '07:00', end: '19:00' }] },
      { day: 'שישי', slots: [{ start: '07:00', end: '14:00' }] },
    ],
    avatar: { fallback: 'מג' },
    preferences: 'יכול לאמן גם קבוצות ספורט',
  },
];
