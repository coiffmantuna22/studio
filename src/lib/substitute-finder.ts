
import { getDay } from 'date-fns';
import type { Teacher, SchoolClass, TimeSlot } from './types';

interface LessonDetails {
  subject: string;
  date: Date;
  time: string;
}

interface FindSubstituteResult {
  recommendation: string | null;
  recommendationId: string | null;
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

  // 1. Is the teacher present at school?
  const availabilityForDay = teacher.availability.find(a => a.day === dayOfWeek);
  if (!availabilityForDay) {
    return false;
  }
  const isPresent = availabilityForDay.slots.some(slot => {
    const startNum = parseTimeToNumber(slot.start);
    const endNum = parseTimeToNumber(slot.end);
    return lessonStartNum >= startNum && lessonEndNum <= endNum;
  });

  if (!isPresent) return false;

  // 2. Is the teacher teaching a scheduled lesson at that time?
  const isTeaching = teacher.schedule?.[dayOfWeek]?.[time];
  if (isTeaching) {
      return false;
  }

  // If present and not teaching, they are available.
  return true;
}

export function isTeacherAlreadyScheduled(teacherId: string, date: Date, time: string, allClasses: SchoolClass[], ignoreClassId?: string): boolean {
    const dayOfWeek = dayMap[getDay(date)];
    
    return allClasses.some(schoolClass => {
        if (schoolClass.id === ignoreClassId) return false;
        const lesson = schoolClass.schedule[dayOfWeek]?.[time];
        return lesson?.teacherId === teacherId;
    });
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
  
  const availableTeachers = substitutePool.filter(t => 
      isTeacherAvailable(t, lessonDetails.date, lessonDetails.time, timeSlots) &&
      !isTeacherAlreadyScheduled(t.id, lessonDetails.date, lessonDetails.time, allClasses)
  );

  if(availableTeachers.length === 0) {
      return {
          recommendation: null,
          recommendationId: null,
          reasoning: 'לא נמצאו מורים פנויים (נוכחים בבית הספר אך ללא שיעור) בשעה זו.',
      };
  }
  
  let qualifiedTeachers = availableTeachers.filter(t => t.subjects.includes(lessonDetails.subject));

  if (qualifiedTeachers.length === 0) {
     const bestOfWorst = availableTeachers[0]; // Just take the first available
      return {
        recommendation: bestOfWorst.name,
        recommendationId: bestOfWorst.id,
        reasoning: `שימו לב: לא נמצא מורה פנוי המוכשר ב${lessonDetails.subject}. ${bestOfWorst.name} מוצע/ת כמפקח/ת בלבד מאחר והוא/היא זמין/ה.`,
    };
  }
  
  const scoredTeachers = qualifiedTeachers.map(teacher => ({
    teacher,
    score: scoreTeacher(teacher, lessonDetails),
  })).sort((a, b) => b.score - a.score);

  const bestChoice = scoredTeachers[0].teacher;
  
  let reasoning = `${bestChoice.name} פנוי/ה ומוכשר/ת ב${lessonDetails.subject}.`;
  if (bestChoice.preferences) {
      reasoning += ` העדפות: ${bestChoice.preferences}.`
  }

  return {
    recommendation: bestChoice.name,
    recommendationId: bestChoice.id,
    reasoning: reasoning,
  };
}
