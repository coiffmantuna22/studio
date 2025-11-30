import { useState, useMemo } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, deleteDoc, doc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Edit, Trash2, Users, BookOpen, Clock } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { Teacher, SchoolClass, Major, TimeSlot } from '@/lib/types';
import CreateMajorDialog from './create-major-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MajorsTabProps {
  teachers: Teacher[];
  classes: SchoolClass[];
  timeSlots: TimeSlot[];
}

export default function MajorsTab({ teachers, classes, timeSlots }: MajorsTabProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [majorToEdit, setMajorToEdit] = useState<Major | null>(null);

  const majorsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'majors'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: majors, isLoading } = useCollection<Major>(majorsQuery);

  const handleDeleteMajor = async (majorId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'majors', majorId));
    } catch (error) {
      console.error("Error deleting major:", error);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ניהול מגמות</h2>
          <p className="text-muted-foreground">צור ונהל שיעורים משותפים למספר כיתות (כמו מתמטיקה 5 יח״ל).</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="ml-2 h-4 w-4" />
          הוסף מגמה
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {majors?.map((major) => {
          const teacher = teachers.find(t => t.id === major.teacherId);
          const participatingClasses = classes.filter(c => major.classIds.includes(c.id));
          const totalHours = Object.values(major.schedule).reduce((acc, curr) => acc + curr.length, 0);

          return (
            <Card key={major.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{major.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      setMajorToEdit(major);
                      setIsCreateDialogOpen(true);
                    }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                          <AlertDialogDescription>
                            פעולה זו תמחק את המגמה "{major.name}" לצמיתות.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>ביטול</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteMajor(major.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            מחק
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {major.subject}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {participatingClasses.length > 0 
                      ? participatingClasses.map(c => c.name).join(', ') 
                      : 'אין כיתות משויכות'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground">מורה:</span>
                  <span>{teacher?.name || 'לא משויך'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{totalHours} שעות שבועיות</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CreateMajorDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setMajorToEdit(null);
        }}
        teachers={teachers}
        classes={classes}
        timeSlots={timeSlots}
        majorToEdit={majorToEdit}
      />
    </div>
  );
}
