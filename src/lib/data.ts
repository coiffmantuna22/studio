import type { Teacher } from './types';

export const initialTeachers: Teacher[] = [
  {
    id: '1',
    name: 'Maria Garcia',
    subjects: ['Math', 'Physics'],
    availability: 'Mon, Wed, Fri',
    avatar: { fallback: 'MG' },
  },
  {
    id: '2',
    name: 'David Smith',
    subjects: ['English', 'History'],
    availability: 'Tue, Thu, Fri',
    avatar: { fallback: 'DS' },
  },
  {
    id: '3',
    name: 'Chen Wei',
    subjects: ['Chemistry', 'Biology'],
    availability: 'Mon, Tue, Wed, Thu',
    avatar: { fallback: 'CW' },
  },
  {
    id: '4',
    name: 'Fatima Al-Fassi',
    subjects: ['Art', 'Music'],
    availability: 'Wed, Fri',
    avatar: { fallback: 'FA' },
  },
  {
    id: '5',
    name: 'Michael Johnson',
    subjects: ['Physical Education'],
    availability: 'Every day',
    avatar: { fallback: 'MJ' },
  },
  {
    id: '6',
    name: 'Emily Williams',
    subjects: ['Math', 'Computer Science'],
    availability: 'Tue, Thu',
    avatar: { fallback: 'EW' },
  },
  {
    id: '7',
    name: 'Daniel Brown',
    subjects: ['History', 'Geography'],
    availability: 'Mon, Fri',
    avatar: { fallback: 'DB' },
  },
  {
    id: '8',
    name: 'Olivia Jones',
    subjects: ['Spanish', 'French'],
    availability: 'Mon, Wed, Thu',
    avatar: { fallback: 'OJ' },
  },
];
