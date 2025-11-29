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

export function isTeacherAvailable(teacher: Teacher, date: Date, time: string): boolean {
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

export function isTeacherAlreadyScheduled(teacherId: string, date: Date, time: string, allClasses: SchoolClass[], ignoreClassId?: string): boolean {
    const dayOfWeek = dayMap[getDay(date)];
    
    return allClasses.some(schoolClass => {
        // If we're checking for a specific class's timetable, we should ignore that class itself.
        if (schoolClass.id === ignoreClassId) return false;

        const lesson = schoolClass.schedule[dayOfWeek]?.[time];
        return lesson?.teacherId === teacherId;
    });
}

// Function to score a teacher's suitability for a substitution.
const scoreTeacher = (teacher: Teacher, lessonDetails: LessonDetails): number => {
    let score = 0;
    // Base score for being qualified
    if (teacher.subjects.includes(lessonDetails.subject)) {
        score += 10;
    }

    // Bonus for matching preferences (example: prefers certain levels)
    // This is a simple example. A real-world scenario could be more complex.
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
  allClasses: SchoolClass[]
): Promise<FindSubstituteResult> {
  
  // 1. Filter by subject qualification
  let qualifiedTeachers = substitutePool.filter(t => t.subjects.includes(lessonDetails.subject));

  if (qualifiedTeachers.length === 0) {
     // If no one is qualified, check for any teacher available as a last resort
     const anyAvailableTeacher = substitutePool.filter(t => isTeacherAvailable(t, lessonDetails.date, lessonDetails.time) && !isTeacherAlreadyScheduled(t.id, lessonDetails.date, lessonDetails.time, allClasses));
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

  // 2. Filter by availability on the specific day and time
  const availableQualifiedTeachers = qualifiedTeachers.filter(t => 
      isTeacherAvailable(t, lessonDetails.date, lessonDetails.time) &&
      !isTeacherAlreadyScheduled(t.id, lessonDetails.date, lessonDetails.time, allClasses)
  );

  if (availableQualifiedTeachers.length === 0) {
    return {
      recommendation: null,
      reasoning: `כל המורים המוכשרים ב${lessonDetails.subject} אינם זמינים או כבר משובצים לשיעורים אחרים בשעה זו.`,
    };
  }
  
  // 3. Score and sort the available teachers
  const scoredTeachers = availableQualifiedTeachers.map(teacher => ({
    teacher,
    score: scoreTeacher(teacher, lessonDetails),
  })).sort((a, b) => b.score - a.score);

  // 4. Select the best choice
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
