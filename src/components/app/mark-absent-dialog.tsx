'use client';

import { useEffect, useState } from 'react';
import { recommendSubstituteTeachers, RecommendSubstituteTeachersOutput } from '@/ai/flows/recommend-substitute-teachers';
import type { Teacher } from '@/lib/types';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '../ui/alert';

const formSchema = z.object({
  dateRange: z.object({
    from: z.date({ required_error: 'A start date is required.' }),
    to: z.date({ required_error: 'An end date is required.' }),
  }),
  reason: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface MarkAbsentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  teacher: Teacher | null;
  allTeachers: Teacher[];
  onShowRecommendation: (
    result: RecommendSubstituteTeachersOutput,
    absentTeacher: Teacher,
    dates: { from: Date; to: Date }
  ) => void;
}

export default function MarkAbsentDialog({
  isOpen,
  onOpenChange,
  teacher,
  allTeachers,
  onShowRecommendation,
}: MarkAbsentDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setIsSubmitting(false);
    }
  }, [isOpen, form]);

  if (!teacher) return null;

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const absenceDetails = {
        absentTeacher: teacher.name,
        startDate: format(values.dateRange.from, 'yyyy-MM-dd'),
        endDate: format(values.dateRange.to, 'yyyy-MM-dd'),
        reason: values.reason,
      };

      const teacherProfiles = allTeachers
        .filter((t) => t.id !== teacher.id)
        .map((t) => ({
          name: t.name,
          subjects: t.subjects,
          availability: t.availability,
        }));

      const result = await recommendSubstituteTeachers({ absenceDetails, teacherProfiles });
      
      onShowRecommendation(result, teacher, { from: values.dateRange.from, to: values.dateRange.to });
      onOpenChange(false);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not generate substitute recommendations. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mark {teacher.name} Absent</DialogTitle>
          <DialogDescription>Select the dates of absence to find a substitute.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Absence Dates</FormLabel>
                   <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value?.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value?.from ? (
                            field.value.to ? (
                              <>
                                {format(field.value.from, "LLL dd, y")} -{" "}
                                {format(field.value.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(field.value.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={{ from: field.value?.from, to: field.value?.to }}
                        onSelect={field.onChange}
                        numberOfMonths={2}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Professional development" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             <Alert variant="default" className="bg-secondary">
              <AlertDescription className="text-sm text-secondary-foreground">
                AI will be used to find the best available substitute teachers based on their qualifications.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finding Substitutes...
                  </>
                ) : (
                  'Find Substitutes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
