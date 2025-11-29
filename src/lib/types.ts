export interface DayAvailability {
  day: string;
  slots: { start: string; end: string }[];
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  availability: DayAvailability[];
  preferences?: string;
  avatar: {
    fallback: string;
  };
}

export interface AbsenceDay {
  date: Date;
  isAllDay: boolean;
  startTime: string;
  endTime: string;
}

export interface Lesson {
  subject: string;
  teacherId: string | null;
}

export type ClassSchedule = {
    [day: string]: {
        [time: string]: Lesson | null;
    }
};

export interface SchoolClass {
  id: string;
  name: string;
  schedule: ClassSchedule;
}

export interface AffectedLesson {
    classId: string;
    className: string;
    date: Date;
    time: string;
    lesson: Lesson;
    recommendation: string | null;
    reasoning: string | null;
}

export interface TimeSlot {
  id: string;
  start: string;
  end: string;
  type: 'lesson' | 'break';
}
