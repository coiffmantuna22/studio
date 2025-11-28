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

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  subjects: z.string().min(1, { message: 'Please enter at least one subject.' }),
  availability: z.string().min(1, { message: 'Please specify availability.' }),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTeacherDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddTeacher: (teacher: Omit<FormValues, 'subjects'> & { subjects: string[] }) => void;
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
    },
  });

  const onSubmit = (values: FormValues) => {
    const subjectsArray = values.subjects.split(',').map((s) => s.trim()).filter(Boolean);
    onAddTeacher({
      name: values.name,
      subjects: subjectsArray,
      availability: values.availability,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Teacher Profile</DialogTitle>
          <DialogDescription>
            Add a new teacher to the system. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Jane Doe" {...field} />
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
                  <FormLabel>Subjects Taught</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Math, Science" {...field} />
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
                  <FormLabel>Typical Availability</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Mon, Wed, Fri afternoons" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Save Profile</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
