
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

const generateEmptySchedule = () => {
    const schedule: SchoolClass['schedule'] = {};
    daysOfWeek.forEach(day => {
        schedule[day] = {};
    });
    return schedule;
};


export const initialTeachers: Teacher[] = [
  {
    id: '1',
    name: 'מריה גרסיה',
    subjects: ['מתמטיקה', 'פיזיקה'],
    availability: [
      { day: 'ראשון', slots: [] },
      { day: 'שני', slots: [{ start: '08:00', end: '10:00' }] },
      { day: 'שלישי', slots: [] },
      { day: 'רביעי', slots: [] },
      { day: 'חמישי', slots: [] },
      { day: 'שישי', slots: [] },
    ],
    schedule: {
      'ראשון': {
        '08:45': { subject: 'מתמטיקה', classId: 'c1' },
        '10:00': { subject: 'מתמטיקה', classId: 'c1' },
      },
      'שני': {
        '08:45': { subject: 'מתמטיקה', classId: 'c1' },
      },
       'חמישי': {
        '10:00': { subject: 'פיזיקה', classId: 'c1' },
        '10:45': { subject: 'פיזיקה', classId: 'c1' },
      }
    },
    avatar: { fallback: 'מג' },
    preferences: 'מעדיפה כיתות בוגרות',
  },
  {
    id: '2',
    name: 'דוד סמית',
    subjects: ['אנגלית', 'היסטוריה'],
    availability: [
      { day: 'ראשון', slots: [] },
      { day: 'שני', slots: [{ start: '12:00', end: '13:30' }] },
      { day: 'שלישי', slots: [] },
      { day: 'רביעי', slots: [] },
      { day: 'חמישי', slots: [] },
      { day: 'שישי', slots: [{ start: '08:45', end: '12:45' }] },
    ],
     schedule: {
      'ראשון': { '10:45': { subject: 'אנגלית', classId: 'c1' }},
      'שלישי': {
        '10:00': { subject: 'אנגלית', classId: 'c1' },
        '10:45': { subject: 'אנגלית', classId: 'c1' },
      },
       'חמישי': {
        '10:00': { subject: 'אנגלית', classId: 'c4' },
        '10:45': { subject: 'אנגלית', classId: 'c4' },
      }
    },
    avatar: { fallback: 'דס' },
    preferences: 'זמין להחלפות של יום שלם',
  },
  {
    id: '3',
    name: 'חן ווי',
    subjects: ['כימיה', 'ביולוגיה'],
    availability: [
      { day: 'ראשון', slots: [] },
      { day: 'שני', slots: [] },
      { day: 'שלישי', slots: [] },
      { day: 'רביעי', slots: [] },
      { day: 'חמישי', slots: [{ start: '08:45', end: '13:30' }] },
      { day: 'שישי', slots: [] },
    ],
    schedule: {
      'שני': {
        '10:00': { subject: 'כימיה', classId: 'c1' },
        '10:45': { subject: 'כימיה', classId: 'c1' },
      },
      'שלישי': { '12:00': { subject: 'כימיה', classId: 'c1' }},
      'רביעי': {
        '08:45': { subject: 'ביולוגיה', classId: 'c4' },
        '10:00': { subject: 'ביולוגיה', classId: 'c4' },
        '10:45': { subject: 'כימיה', classId: 'c1' },
      },
    },
    avatar: { fallback: 'חו' },
    preferences: 'בעל ניסיון עם חינוך מיוחד',
  },
  {
    id: '4',
    name: 'فاطمة الفاسي',
    subjects: ['אמנות', 'מוזיקה'],
    availability: [
       { day: 'ראשון', slots: [] },
       { day: 'שני', slots: [] },
       { day: 'שלישי', slots: [] },
       { day: 'רביעי', slots: [] },
       { day: 'חמישי', slots: [] },
       { day: 'שישי', slots: [{ start: '08:45', end: '12:45' }] },
    ],
    schedule: {
        'רביעי': {
            '12:00': { subject: 'אמנות', classId: 'c1' },
            '10:45': { subject: 'מוזיקה', classId: 'c4' },
        },
    },
    avatar: { fallback: 'פא' },
    preferences: '',
  },
  {
    id: '5',
    name: 'מיכאל ג\'ונסון',
    subjects: ['חינוך גופני'],
    availability: [
      { day: 'ראשון', slots: [] },
      { day: 'שני', slots: [] },
      { day: 'שלישי', slots: [] },
      { day: 'רביעי', slots: [] },
      { day: 'חמישי', slots: [] },
      { day: 'שישי', slots: [{ start: '08:00', end: '12:00' }] },
    ],
    schedule: {
      'שני': { '12:45': { subject: 'חינוך גופני', classId: 'c1' }},
      'רביעי': { '12:45': { subject: 'חינוך גופני', classId: 'c1' }},
      'חמישי': { '12:00': { subject: 'חינוך גופני', classId: 'c1' }},
    },
    avatar: { fallback: 'מג' },
    preferences: 'יכול לאמן גם קבוצות ספורט',
  },
  {
    id: '6',
    name: 'שרה כהן',
    subjects: ['ספרות', 'לשון'],
    availability: [
      { day: 'ראשון', slots: [] },
      { day: 'שני', slots: [] },
      { day: 'שלישי', slots: [] },
      { day: 'רביעי', slots: [] },
      { day: 'חמישי', slots: [] },
      { day: 'שישי', slots: [] },
    ],
    schedule: {
        'ראשון': {'08:00': { subject: 'ספרות', classId: 'c1' }},
        'שלישי': {
            '08:00': { subject: 'ספרות', classId: 'c1' },
            '08:45': { subject: 'לשון', classId: 'c1' },
        },
        'חמישי': {'08:00': { subject: 'ספרות', classId: 'c1' }},
    },
    avatar: { fallback: 'שכ' },
    preferences: '',
  },
  {
    id: '7',
    name: 'יוסף לוי',
    subjects: ['היסטוריה', 'אזרחות'],
    availability: [
      { day: 'ראשון', slots: [] },
      { day: 'שני', slots: [] },
      { day: 'שלישי', slots: [] },
      { day: 'רביעי', slots: [] },
      { day: 'חמישי', slots: [] },
      { day: 'שישי', slots: [] },
    ],
    schedule: {
        'ראשון': {
            '12:00': { subject: 'היסטוריה', classId: 'c1' },
            '12:45': { subject: 'היסטוריה', classId: 'c1' },
        },
        'שני': {'12:00': { subject: 'היסטוריה', classId: 'c1' }},
        'רביעי': {'10:00': { subject: 'אזרחות', classId: 'c1' }},
        'חמישי': { '12:00': { subject: 'אזרחות', classId: 'c4' }},
    },
    avatar: { fallback: 'יל' },
    preferences: 'מתמחה בהיסטוריה של המזרח התיכון',
  },
  {
    id: '8',
    name: 'נועה מזרחי',
    subjects: ['מתמטיקה', 'מדעי המחשב'],
    availability: [
      { day: 'ראשון', slots: [] },
      { day: 'שני', slots: [] },
      { day: 'שלישי', slots: [] },
      { day: 'רביעי', slots: [] },
      { day: 'חמישי', slots: [] },
      { day: 'שישי', slots: [] },
    ],
    schedule: {
      'ראשון': {
        '08:45': { subject: 'מתמטיקה', classId: 'c3' },
        '10:00': { subject: 'מתמטיקה', classId: 'c3' },
      },
      'שני': {
        '08:45': { subject: 'מדעי המחשב', classId: 'c3' },
        '10:00': { subject: 'מדעי המחשב', classId: 'c3' },
      },
    },
    avatar: { fallback: 'נמ' },
    preferences: 'ראש צוות פיתוח לשעבר',
  },
  {
    id: '9',
    name: 'אביגיל ביטון',
    subjects: ['תנ"ך', 'מחשבת ישראל'],
    availability: [
      { day: 'ראשון', slots: [] },
      { day: 'שלישי', slots: [] },
      { day: 'חמישי', slots: [] },
      { day: 'שני', slots: [] },
      { day: 'רביעי', slots: [] },
      { day: 'שישי', slots: [] },
    ],
    schedule: {
      'ראשון': {
        '08:00': { subject: 'תנ"ך', classId: 'c3' },
        '10:45': { subject: 'תנ"ך', classId: 'c3' },
      },
      'שלישי': {
        '08:00': { subject: 'תנ"ך', classId: 'c3'},
        '08:45': { subject: 'תנ"ך', classId: 'c3'},
      },
    },
    avatar: { fallback: 'אב' },
    preferences: 'מעדיפה כיתות קטנות',
  },
  {
    id: '10',
    name: 'איתן ישראלי',
    subjects: ['גיאוגרפיה', 'של"ח'],
    availability: [
      { day: 'שני', slots: [] },
      { day: 'רביעי', slots: [] },
      { day: 'ראשון', slots: [] },
      { day: 'שלישי', slots: [] },
      { day: 'חמישי', slots: [] },
      { day: 'שישי', slots: [] },
    ],
    schedule: {
       'שני': {
        '08:00': { subject: 'גיאוגרפיה', classId: 'c6' },
        '08:45': { subject: 'גיאוגרפיה', classId: 'c6' },
      },
    },
    avatar: { fallback: 'אי' },
    preferences: 'אוהב לצאת לסיורים',
  },
  {
    id: '11',
    name: 'רותם חדד',
    subjects: ['לשון', 'ערבית'],
    availability: [
      { day: 'שלישי', slots: [] },
      { day: 'חמישי', slots: [] },
      { day: 'ראשון', slots: [] },
      { day: 'שני', slots: [] },
      { day: 'רביעי', slots: [] },
      { day: 'שישי', slots: [] },
    ],
    schedule: {
        'חמישי': {'08:45': { subject: 'לשון', classId: 'c1' }},
        'שלישי': {
            '10:00': { subject: 'ערבית', classId: 'c6' },
            '10:45': { subject: 'ערבית', classId: 'c6' },
        },
    },
    avatar: { fallback: 'רח' },
    preferences: '',
  },
];


export const initialClasses: SchoolClass[] = [
    {
        id: 'c1',
        name: 'כיתה י׳1',
        schedule: {
            'ראשון': {
                '08:00': { subject: 'ספרות', teacherId: '6' },
                '08:45': { subject: 'מתמטיקה', teacherId: '1' },
                '10:00': { subject: 'מתמטיקה', teacherId: '1' },
                '10:45': { subject: 'אנגלית', teacherId: '2' },
                '12:00': { subject: 'היסטוריה', teacherId: '7' },
                '12:45': { subject: 'היסטוריה', teacherId: '7' },
            },
            'שני': {
                '08:45': { subject: 'מתמטיקה', teacherId: '1' },
                '10:00': { subject: 'כימיה', teacherId: '3' },
                '10:45': { subject: 'כימיה', teacherId: '3' },
                 '12:00': { subject: 'היסטוריה', teacherId: '7' },
                '12:45': { subject: 'חינוך גופני', teacherId: '5' },
            },
            'שלישי': {
                '08:00': { subject: 'ספרות', teacherId: '6' },
                '08:45': { subject: 'לשון', teacherId: '6' },
                '10:00': { subject: 'אנגלית', teacherId: '2' },
                '10:45': { subject: 'אנגלית', teacherId: '2' },
                '12:00': { subject: 'כימיה', teacherId: '3' },
            },
            'רביעי': {
                '10:00': { subject: 'אזרחות', teacherId: '7' },
                '10:45': { subject: 'כימיה', teacherId: '3' },
                '12:00': { subject: 'אמנות', teacherId: '4' },
                '12:45': { subject: 'חינוך גופני', teacherId: '5' },
            },
            'חמישי': {
                '08:00': { subject: 'ספרות', teacherId: '6' },
                '08:45': { subject: 'לשון', teacherId: '11' },
                '10:00': { subject: 'פיזיקה', teacherId: '1' },
                '10:45': { subject: 'פיזיקה', teacherId: '1' },
                 '12:00': { subject: 'חינוך גופני', teacherId: '5' },
            },
            'שישי': {},
        }
    },
    {
        id: 'c2',
        name: 'כיתה י״א3',
        schedule: generateEmptySchedule(),
    },
     {
        id: 'c3',
        name: 'כיתה ט׳1',
        schedule: {
            'ראשון': {
                '08:45': { subject: 'מתמטיקה', teacherId: '8' },
                '10:00': { subject: 'מתמטיקה', teacherId: '8' },
                '10:45': { subject: 'תנ"ך', teacherId: '9' },
                '08:00': { subject: 'תנ"ך', teacherId: '9' },
            },
            'שני': {
                '08:45': { subject: 'מדעי המחשב', teacherId: '8' },
                '10:00': { subject: 'מדעי המחשב', teacherId: '8' },
                '10:45': { subject: 'חינוך גופני', teacherId: '5' },
            },
            'שלישי': {
                '08:00': { subject: 'תנ"ך', teacherId: '9'},
                '08:45': { subject: 'תנ"ך', teacherId: '9'},
            },
            'רביעי': {},'חמישי': {},'שישי': {},
        }
    },
    {
        id: 'c4',
        name: 'כיתה י״ב2',
        schedule: {
             'רביעי': {
                '08:45': { subject: 'ביולוגיה', teacherId: '3' },
                '10:00': { subject: 'ביולוגיה', teacherId: '3' },
                '10:45': { subject: 'מוזיקה', teacherId: '4' },
            },
            'חמישי': {
                '10:00': { subject: 'אנגלית', teacherId: '2' },
                '10:45': { subject: 'אנגלית', teacherId: '2' },
                '12:00': { subject: 'אזרחות', teacherId: '7' },
            },
            'ראשון': {}, 'שני': {}, 'שלישי': {},'שישי': {},
        }
    },
    {
        id: 'c5',
        name: 'כיתה ז׳4',
        schedule: generateEmptySchedule(),
    },
    {
        id: 'c6',
        name: 'כיתה ח׳2',
        schedule: {
            'שני': {
                '08:00': { subject: 'גיאוגרפיה', teacherId: '10' },
                '08:45': { subject: 'גיאוגרפיה', teacherId: '10' },
            },
            'שלישי': {
                '10:00': { subject: 'ערבית', teacherId: '11' },
                '10:45': { subject: 'ערבית', teacherId: '11' },
            },
            'ראשון': {}, 'רביעי': {}, 'חמישי': {}, 'שישי': {},
        },
    }
]
