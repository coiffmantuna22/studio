import { getDay } from 'date-fns';
import type { Teacher, SchoolClass, TimeSlot } from './types';

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

const parseTimeToNumber = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours + minutes / 60;
};

export function isTeacherAvailable(teacher: Teacher, date: Date, time: string, timeSlots: TimeSlot[]): boolean {
  const dayOfWeek = dayMap[getDay(date)];
  const lessonSlot = timeSlots.find(s => s.start === time);
  if (!lessonSlot) return false;

  const lessonStartNum = parseTimeToNumber(lessonSlot.start);
  const lessonEndNum = parseTimeToNumber(lessonSlot.end);

  const availabilityForDay = teacher.availability.find(a => a.day === dayOfWeek);
  if (!availabilityForDay) {
    return false;
  }

  return availabilityForDay.slots.some(slot => {
    const startNum = parseTimeToNumber(slot.start);
    const endNum = parseTimeToNumber(slot.end);
    return lessonStartNum >= startNum && lessonEndNum <= endNum;
  });
}

export function isTeacherAlreadyScheduled(teacherId: string, date: Date, time: string, allClasses: SchoolClass[], ignoreClassId?: string): boolean {
    const dayOfWeek = dayMap[getDay(date)];
    
    for (const schoolClass of allClasses) {
        if (schoolClass.id === ignoreClassId) continue;
        
        const lesson = schoolClass.schedule[dayOfWeek]?.[time];
        if (lesson?.teacherId === teacherId) {
            return true;
        }
    }
    return false;
}

const scoreTeacher = (teacher: Teacher, lessonDetails: LessonDetails): number => {
    let score = 0;
    if (teacher.subjects.includes(lessonDetails.subject)) {
        score += 10;
    }

    if (teacher.preferences?.includes('כיתות בוגרות')) {
        score += 2;
    }
    if (teacher.preferences?.includes('חינוך מיוחד') && lessonDetails.subject === 'חינוך מיוחד') {
        score += 5;
    }

    return score;
}

export async function findSubstitute(
  lessonDetails: LessonDetails,
  substitutePool: Teacher[],
  allClasses: SchoolClass[],
  timeSlots: TimeSlot[],
): Promise<FindSubstituteResult> {
  
  let qualifiedTeachers = substitutePool.filter(t => t.subjects.includes(lessonDetails.subject));

  if (qualifiedTeachers.length === 0) {
     const anyAvailableTeacher = substitutePool.filter(t => 
        isTeacherAvailable(t, lessonDetails.date, lessonDetails.time, timeSlots) && 
        !isTeacherAlreadyScheduled(t.id, lessonDetails.date, lessonDetails.time, allClasses)
     );
     if(anyAvailableTeacher.length > 0) {
        const bestOfWorst = anyAvailableTeacher[0];
         return {
            recommendation: bestOfWorst.name,
            reasoning: `שימו לב: לא נמצא מורה המוכשר ב${lessonDetails.subject}. ${bestOfWorst.name} מוצע/ת כמפקח/ת בלבד מאחר והוא/היא זמין/ה.`,
        };
     }

    return {
      recommendation: null,
      reasoning: 'לא נמצאו מחליפים בעלי הכשרה במקצוע זה, וגם לא נמצא מורה פנוי שיכול לשמש כמפקח.',
    };
  }

  const availableQualifiedTeachers = qualifiedTeachers.filter(t => 
      isTeacherAvailable(t, lessonDetails.date, lessonDetails.time, timeSlots) &&
      !isTeacherAlreadyScheduled(t.id, lessonDetails.date, lessonDetails.time, allClasses)
  );

  if (availableQualifiedTeachers.length === 0) {
    return {
      recommendation: null,
      reasoning: `כל המורים המוכשרים ב${lessonDetails.subject} אינם זמינים או כבר משובצים לשיעורים אחרים בשעה זו.`,
    };
  }
  
  const scoredTeachers = availableQualifiedTeachers.map(teacher => ({
    teacher,
    score: scoreTeacher(teacher, lessonDetails),
  })).sort((a, b) => b.score - a.score);

  const bestChoice = scoredTeachers[0].teacher;
  
  let reasoning = `${bestChoice.name} זמין/ה ומוכשר/ת ב${lessonDetails.subject}.`;
  if (bestChoice.preferences) {
      reasoning += ` העדפות: ${bestChoice.preferences}.`
  }

  return {
    recommendation: bestChoice.name,
    reasoning: reasoning,
  };
}
