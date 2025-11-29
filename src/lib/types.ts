



export interface DayAvailability {
  day: string;
  slots: { start: string; end: string }[];
}

export interface Teacher {
  id: string;
  userId: string; 
  name: string;
  subjects: string[];
  availability: DayAvailability[];
  schedule?: ClassSchedule;
  preferences?: string;
  avatar: {
    fallback: string;
  };
  absences?: AbsenceDay[];
}

export interface AbsenceDay {
  date: Date | string;
  isAllDay: boolean;
  startTime: string;
  endTime: string;
}

export interface Lesson {
  subject: string;
  teacherId: string;
  classId: string;
}

export type ClassSchedule = {
    [day: string]: {
        [time: string]: Lesson | null;
    }
};

export interface SchoolClass {
  id: string;
  userId: string; 
  name: string;
  schedule: ClassSchedule;
}

export interface AffectedLesson {
    classId: string;
    className: string;
    date: Date;
    time: string;
    lesson: Lesson;
    isCovered?: boolean;
    absentTeacherName?: string;
    recommendation: string | null;
    recommendationId: string | null;
    reasoning: string | null;
    substituteOptions: Teacher[];
}

export interface TimeSlot {
  id: string;
  start: string;
  end: string;
  type: 'lesson' | 'break';
  userId?: string;
}

export type TeacherAvailabilityStatus = 'available' | 'teaching' | 'absent' | 'not_in_school' | 'unknown';

export interface SubstitutionRecord {
  id: string;
  date: string;
  time: string;
  classId: string;
  className: string;
  absentTeacherId: string;
  absentTeacherName: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
  subject: string;
  userId: string;
  createdAt: string;
}
