'use server';

/**
 * @fileOverview A substitute teacher recommendation AI agent.
 *
 * - findSubstitute - A function that handles finding a single best substitute for a specific lesson.
 * - FindSubstituteInput - The input type for the findSubstitute function.
 * - FindSubstituteOutput - The return type for the findSubstitute function.
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

const LessonDetailsSchema = z.object({
  subject: z.string().describe('The subject of the lesson that needs a substitute.'),
  date: z.string().describe("The date of the lesson in yyyy-MM-dd format."),
  time: z.string().describe("The start time of the lesson (HH:mm format)."),
});

const FindSubstituteInputSchema = z.object({
  lessonDetails: LessonDetailsSchema.describe('Details about the specific lesson needing a substitute.'),
  teacherProfiles: z.array(TeacherProfileSchema).describe('A list of available substitute teacher profiles.'),
});
export type FindSubstituteInput = z.infer<typeof FindSubstituteInputSchema>;

const FindSubstituteOutputSchema = z.object({
  recommendation: z.string().nullable().describe('The name of the single best substitute teacher for this lesson, or null if no one is suitable.'),
  reasoning: z.string().nullable().describe('A brief reasoning for why this teacher was recommended, or why no one was found. The reasoning MUST be in Hebrew.'),
});
export type FindSubstituteOutput = z.infer<typeof FindSubstituteOutputSchema>;

export async function findSubstitute(input: FindSubstituteInput): Promise<FindSubstituteOutput> {
  return findSubstituteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findSubstitutePrompt',
  input: {schema: FindSubstituteInputSchema},
  output: {schema: FindSubstituteOutputSchema},
  model: "gemini-2.5-flash",
  prompt: `You are an expert at recommending a single substitute teacher for a specific lesson. Your output must be in Hebrew.

  Given the following lesson that needs coverage:
  Lesson Details: {{{json stringify=lessonDetails}}}

  And the following substitute teacher profiles:
  Teacher Profiles: 
  {{#each teacherProfiles}}
  - {{{json stringify=this}}}
  {{/each}}

  Recommend the single best substitute teacher who is qualified and available to cover this specific lesson.
  1. Qualification: The teacher must be able to teach the subject of the lesson.
  2. Availability: You must cross-reference the specific date and time of the lesson with the substitute's weekly recurring availability. For example, if the lesson is on Monday 2024-10-21 at 10:00, you must check which substitutes are available on Mondays at 10:00.
  
  Your task is to choose only ONE teacher who is the best fit. If multiple teachers are available, choose the one with more relevant subjects or preferences.
  If no one is available or qualified, return null for the recommendation.

  The reasoning MUST be in Hebrew.
  `,
});

const findSubstituteFlow = ai.defineFlow(
  {
    name: 'findSubstituteFlow',
    inputSchema: FindSubstituteInputSchema,
    outputSchema: FindSubstituteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
