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
import type { Teacher } from '@/lib/types';
import { useEffect } from 'react';

const formSchema = z.object({
  name: z.string().min(2, { message: 'השם חייב להכיל לפחות 2 תווים.' }),
  subjects: z.string().min(1, { message: 'אנא הזן לפחות מקצוע אחד.' }),
  availability: z.string().min(1, { message: 'אנא ציין זמינות.' }),
  preferences: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTeacherDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddTeacher: (teacher: Omit<Teacher, 'id' | 'avatar'>) => void;
  onEditTeacher: (teacher: Omit<Teacher, 'avatar'>) => void;
  teacherToEdit: Teacher | null;
}

export default function CreateTeacherDialog({
  isOpen,
  onOpenChange,
  onAddTeacher,
  onEditTeacher,
  teacherToEdit,
}: CreateTeacherDialogProps) {
  const isEditMode = !!teacherToEdit;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      subjects: '',
      availability: '',
      preferences: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        form.reset({
          name: teacherToEdit.name,
          subjects: teacherToEdit.subjects.join(', '),
          availability: teacherToEdit.availability,
          preferences: teacherToEdit.preferences || '',
        });
      } else {
        form.reset({
          name: '',
          subjects: '',
          availability: '',
          preferences: '',
        });
      }
    }
  }, [isOpen, isEditMode, teacherToEdit, form]);

  const onSubmit = (values: FormValues) => {
    const subjectsArray = values.subjects.split(',').map((s) => s.trim()).filter(Boolean);
    const teacherData = {
      name: values.name,
      subjects: subjectsArray,
      availability: values.availability,
      preferences: values.preferences,
    };

    if (isEditMode) {
      onEditTeacher({ ...teacherData, id: teacherToEdit.id });
    } else {
      onAddTeacher(teacherData);
    }
    
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
                    <Input placeholder="למשל, מתמטיקה, מדעים (מופרדים בפסיק)" {...field} />
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
                  <FormLabel>זמינות טיפוסית</FormLabel>
                  <FormControl>
                    <Textarea placeholder="למשל, שני, רביעי, שישי אחר הצהריים" {...field} />
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
