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

const TeacherProfileSchema = z.object({
  name: z.string().describe('The name of the teacher.'),
  subjects: z.array(z.string()).describe('The subjects the teacher can teach.'),
  availability: z.string().describe('The teacher availability (e.g., days of the week, specific dates).'),
  preferences: z.string().optional().describe('Any specific preferences of the teacher.'),
});

const AbsenceDetailsSchema = z.object({
  absentTeacher: z.string().describe('The name of the absent teacher.'),
  startDate: z.string().describe('The start date of the absence.'),
  endDate: z.string().describe('The end date of the absence.'),
  startTime: z.string().describe('The start time of the absence (HH:mm format).'),
  endTime: z.string().describe('The end time of the absence (HH:mm format).'),
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
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are an expert at recommending substitute teachers based on their qualifications and availability. Your output must be in Hebrew.

  Given the following absence details:
  Absence Details: {{{json stringify=absenceDetails}}}

  And the following substitute teacher profiles:
  Teacher Profiles: 
  {{#each teacherProfiles}}
  - {{{json stringify=this}}}
  {{/each}}

  Recommend a list of substitute teachers who are qualified to cover the absence, and explain your reasoning in Hebrew.
  Consider the subjects they teach, their availability (days and times), and any teacher preferences.
  Ensure that the output only contains the names of available substitute teachers.
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
