import { getDay } from 'date-fns';
import type { Teacher, SchoolClass } from './types';

interface LessonDetails {
  subject: string;
  date: Date;
  time: string;
}

interface FindSubstituteResult {
  recommendation: string | null;
  reasoning: string | null;
}

const dayMap = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const parseTimeToNumber = (time: string) => parseInt(time.split(':')[0], 10);

function isTeacherAvailable(teacher: Teacher, date: Date, time: string): boolean {
  const dayOfWeek = dayMap[getDay(date)];
  const lessonHour = parseTimeToNumber(time);

  const availabilityForDay = teacher.availability.find(a => a.day === dayOfWeek);
  if (!availabilityForDay) {
    return false;
  }

  return availabilityForDay.slots.some(slot => {
    const startHour = parseTimeToNumber(slot.start);
    const endHour = parseTimeToNumber(slot.end);
    return lessonHour >= startHour && lessonHour < endHour;
  });
}

function isTeacherAlreadyScheduled(teacherId: string, date: Date, time: string, allClasses: SchoolClass[]): boolean {
    const dayOfWeek = dayMap[getDay(date)];
    
    return allClasses.some(schoolClass => {
        const lesson = schoolClass.schedule[dayOfWeek]?.[time];
        return lesson?.teacherId === teacherId;
    });
}

export async function findSubstitute(
  lessonDetails: LessonDetails,
  substitutePool: Teacher[],
  allClasses: SchoolClass[]
): Promise<FindSubstituteResult> {
  
  // 1. Filter by subject qualification
  const qualifiedTeachers = substitutePool.filter(t => t.subjects.includes(lessonDetails.subject));

  if (qualifiedTeachers.length === 0) {
    return {
      recommendation: null,
      reasoning: 'לא נמצאו מחליפים בעלי הכשרה במקצוע זה.',
    };
  }

  // 2. Filter by availability on the specific day and time
  const availableQualifiedTeachers = qualifiedTeachers.filter(t => isTeacherAvailable(t, lessonDetails.date, lessonDetails.time));

  if (availableQualifiedTeachers.length === 0) {
    return {
      recommendation: null,
      reasoning: `אף מורה מחליף שמוכשר ב${lessonDetails.subject} אינו זמין בשעה זו.`,
    };
  }
  
  // 3. Separate teachers who are free vs. already scheduled
  const freeTeachers: Teacher[] = [];
  const busyTeachers: Teacher[] = [];

  availableQualifiedTeachers.forEach(teacher => {
    if (isTeacherAlreadyScheduled(teacher.id, lessonDetails.date, lessonDetails.time, allClasses)) {
        busyTeachers.push(teacher);
    } else {
        freeTeachers.push(teacher);
    }
  });
  
  // 4. Prioritize free teachers
  if (freeTeachers.length > 0) {
    const bestChoice = freeTeachers[0]; // Simple choice for now, could be expanded
    return {
        recommendation: bestChoice.name,
        reasoning: `${bestChoice.name} זמין/ה, מוכשר/ת ב${lessonDetails.subject}, ואין לו/ה שיעור אחר באותו זמן.`,
    };
  }

  // 5. If no one is completely free, return null (or suggest someone busy as a last resort, but for now, we won't)
  return {
    recommendation: null,
    reasoning: `כל המורים המוכשרים והזמינים כבר משובצים לשיעורים אחרים בשעה זו.`,
  };
}
