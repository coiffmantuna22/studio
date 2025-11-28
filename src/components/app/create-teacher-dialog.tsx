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
}

export default function CreateTeacherDialog({
  isOpen,
  onOpenChange,
  onAddTeacher,
}: CreateTeacherDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      subjects: '',
      availability: '',
      preferences: '',
    },
  });

  const onSubmit = (values: FormValues) => {
    const subjectsArray = values.subjects.split(',').map((s) => s.trim()).filter(Boolean);
    onAddTeacher({
      name: values.name,
      subjects: subjectsArray,
      availability: values.availability,
      preferences: values.preferences,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>יצירת פרופיל מורה</DialogTitle>
          <DialogDescription>
            הוסף מורה חדש למערכת. לחץ על שמירה בסיום.
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
                    <Input placeholder="למשל, מתמטיקה, מדעים" {...field} />
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
              <Button type="submit">שמור פרופיל</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
