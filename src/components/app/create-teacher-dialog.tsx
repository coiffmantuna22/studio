'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Teacher, DayAvailability, TimeSlot } from '@/lib/types';
import { useEffect } from 'react';
import WeeklyScheduleSelector from './weekly-schedule-selector';
import SubjectInput from './subject-input';

const dayAvailabilitySchema = z.object({
  day: z.string(),
  slots: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })),
});

const formSchema = z.object({
  name: z.string().min(2, { message: 'השם חייב להכיל לפחות 2 תווים.' }),
  subjects: z.array(z.string()).min(1, { message: 'אנא הזן לפחות מקצוע אחד.' }),
  availability: z.array(dayAvailabilitySchema).min(1, { message: 'אנא ציין זמינות.' }),
  preferences: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTeacherDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddTeacher: (teacher: Omit<Teacher, 'id' | 'userId' | 'avatar'>) => void;
  onEditTeacher: (teacher: Omit<Teacher, 'userId' | 'avatar'>) => void;
  teacherToEdit: Teacher | null;
  timeSlots: TimeSlot[];
}

const defaultAvailability = [
  { day: 'ראשון', slots: [] },
  { day: 'שני', slots: [] },
  { day: 'שלישי', slots: [] },
  { day: 'רביעי', slots: [] },
  { day: 'חמישי', slots: [] },
  { day: 'שישי', slots: [] },
];

export default function CreateTeacherDialog({
  isOpen,
  onOpenChange,
  onAddTeacher,
  onEditTeacher,
  teacherToEdit,
  timeSlots,
}: CreateTeacherDialogProps) {
  const isEditMode = !!teacherToEdit;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      subjects: [],
      availability: defaultAvailability,
      preferences: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && teacherToEdit) {
        form.reset({
          name: teacherToEdit.name,
          subjects: teacherToEdit.subjects,
          availability: teacherToEdit.availability.length > 0 ? teacherToEdit.availability : defaultAvailability,
          preferences: teacherToEdit.preferences || '',
        });
      } else {
        form.reset({
          name: '',
          subjects: [],
          availability: defaultAvailability,
          preferences: '',
        });
      }
    }
  }, [isOpen, isEditMode, teacherToEdit, form]);

  const onSubmit = (values: FormValues) => {
    const teacherData = {
      name: values.name,
      subjects: values.subjects,
      availability: values.availability,
      preferences: values.preferences,
    };

    if (isEditMode && teacherToEdit) {
      onEditTeacher({ ...teacherData, id: teacherToEdit.id });
    } else {
      onAddTeacher(teacherData);
    }
    
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'עריכת פרופיל מורה' : 'יצירת פרופיל מורה'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'עדכן את פרטי המורה. לחץ על שמירה בסיום.' : 'הוסף מורה חדש למערכת. לחץ על שמירה בסיום.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם מלא</FormLabel>
                  <FormControl>
                    <Input placeholder="למשל, ישראלה ישראלי" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subjects"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מקצועות לימוד</FormLabel>
                  <FormControl>
                    <SubjectInput {...field} placeholder="הקש 'Enter' להוספת מקצוע..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="availability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>זמינות שבועית</FormLabel>
                   <p className="text-sm text-muted-foreground">לחץ על משבצות זמן כדי לסמן זמינות.</p>
                  <FormControl>
                    <WeeklyScheduleSelector {...field} timeSlots={timeSlots} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="preferences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>העדפות (אופציונלי)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="למשל, מעדיף/ה כיתות קטנות" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">{isEditMode ? 'שמור שינויים' : 'שמור פרופיל'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
