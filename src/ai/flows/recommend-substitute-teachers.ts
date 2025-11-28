'use server';

/**
 * @fileOverview A substitute teacher recommendation AI agent.
 *
 * - recommendSubstituteTeachers - A function that handles the substitute teacher recommendation process.
 * - RecommendSubstituteTeachersInput - The input type for the recommendSubstituteTeachers function.
 * - RecommendSubstituteTeachersOutput - The return type for the recommendSubstituteTeachers function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DayAvailabilitySchema = z.object({
  day: z.string(),
  slots: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })),
});

const TeacherProfileSchema = z.object({
  name: z.string().describe('The name of the teacher.'),
  subjects: z.array(z.string()).describe('The subjects the teacher can teach.'),
  availability: z.array(DayAvailabilitySchema).describe('The teacher weekly availability schedule.'),
  preferences: z.string().optional().describe('Any specific preferences of the teacher.'),
});

const AbsenceDaySchema = z.object({
    date: z.string().describe("The date of absence in yyyy-MM-dd format."),
    isAllDay: z.boolean().describe("Whether the absence is for the entire day."),
    startTime: z.string().describe("The start time of the absence (HH:mm format), or 'N/A' if all day."),
    endTime: z.string().describe("The end time of the absence (HH:mm format), or 'N/A' if all day.")
});

const AbsenceDetailsSchema = z.object({
  absentTeacher: z.string().describe('The name of the absent teacher.'),
  days: z.array(AbsenceDaySchema).describe('The specific days and times of the absence.'),
  reason: z.string().optional().describe('The reason for the absence.'),
});

const RecommendSubstituteTeachersInputSchema = z.object({
  absenceDetails: AbsenceDetailsSchema.describe('Details about the teacher absence.'),
  teacherProfiles: z.array(TeacherProfileSchema).describe('A list of available substitute teacher profiles.'),
});
export type RecommendSubstituteTeachersInput = z.infer<typeof RecommendSubstituteTeachersInputSchema>;

const RecommendSubstituteTeachersOutputSchema = z.object({
  recommendations: z.array(z.string()).describe('A list of recommended substitute teacher names.'),
  reasoning: z.string().describe('The reasoning behind the recommendations.'),
});
export type RecommendSubstituteTeachersOutput = z.infer<typeof RecommendSubstituteTeachersOutputSchema>;

export async function recommendSubstituteTeachers(input: RecommendSubstituteTeachersInput): Promise<RecommendSubstituteTeachersOutput> {
  return recommendSubstituteTeachersFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendSubstituteTeachersPrompt',
  input: {schema: RecommendSubstituteTeachersInputSchema},
  output: {schema: RecommendSubstituteTeachersOutputSchema},
  model: 'gemini-2.5-flash',
  prompt: `You are an expert at recommending substitute teachers based on their qualifications and availability. Your output must be in Hebrew.

  Given the following absence details:
  Absence Details: {{{json stringify=absenceDetails}}}

  And the following substitute teacher profiles:
  Teacher Profiles: 
  {{#each teacherProfiles}}
  - {{{json stringify=this}}}
  {{/each}}

  Recommend a list of substitute teachers who are qualified to cover the absence, and explain your reasoning in Hebrew.
  Consider the subjects they teach and their detailed weekly availability. You must cross-reference the specific dates and times of the absence with the substitute's weekly recurring availability. For example, if the absence is on Monday 2024-10-21 from 10:00 to 14:00, you must check which substitutes are available on Mondays during those hours.
  
  Ensure that the output only contains the names of available and qualified substitute teachers.
  The response (recommendations and reasoning) MUST be in Hebrew.
  `,
});

const recommendSubstituteTeachersFlow = ai.defineFlow(
  {
    name: 'recommendSubstituteTeachersFlow',
    inputSchema: RecommendSubstituteTeachersInputSchema,
    outputSchema: RecommendSubstituteTeachersOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
