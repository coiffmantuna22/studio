'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/app/header';
import TeacherList from '@/components/app/teacher-list';
import Timetable from '@/components/app/timetable';
import ClassList from '@/components/app/class-list';
import SettingsTab from '@/components/app/settings-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { initialTeachers, initialClasses as defaultClasses, initialTimeSlots } from '@/lib/data';
import type { SchoolClass, Teacher, TimeSlot } from '@/lib/types';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, doc, writeBatch, WriteBatch } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { Button } from '@/components/ui/button';

function commitBatchWithContext(batch: WriteBatch, context: { operation: 'create' | 'update' | 'delete', path: string, data?: any }) {
  batch.commit().catch(error => {
    const permissionError = new FirestorePermissionError({
      operation: context.operation,
      path: context.path,
      requestResourceData: context.data,
    });
    errorEmitter.emit('permission-error', permissionError);
  });
}

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  const [teachersCollection, teachersLoading] = useCollection(
    user ? collection(firestore, 'users', user.uid, 'teachers') : null
  );

  const [classesCollection, classesLoading] = useCollection(
    user ? collection(firestore, 'users', user.uid, 'classes') : null
  );

  const [settingsCollection, settingsLoading] = useCollection(
    user ? collection(firestore, 'users', user.uid, 'settings') : null
  );

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (teachersCollection) {
      const teachersData = teachersCollection.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher));
      setTeachers(teachersData);
    }
  }, [teachersCollection]);

  useEffect(() => {
    if (classesCollection) {
      const classesData = classesCollection.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolClass));
      setSchoolClasses(classesData);
    }
  }, [classesCollection]);

  useEffect(() => {
    if (settingsCollection) {
      const settingsDoc = settingsCollection.docs.find(d => d.id === 'timetable');
      if (settingsDoc?.exists()) {
        setTimeSlots(settingsDoc.data().slots);
      }
    }
  }, [settingsCollection]);

  // Seed data for new user
  const seedData = () => {
    if (!firestore || !user) return;
    const batch = writeBatch(firestore);
    
    initialTeachers.forEach(teacher => {
      const teacherRef = doc(collection(firestore, 'users', user.uid, 'teachers'));
      batch.set(teacherRef, { ...teacher, id: teacherRef.id });
    });

    defaultClasses.forEach(sClass => {
        const classRef = doc(collection(firestore, 'users', user.uid, 'classes'));
        batch.set(classRef, { ...sClass, id: classRef.id });
    });
    
    const settingsRef = doc(firestore, 'users', user.uid, 'settings', 'timetable');
    const timetableData = { slots: initialTimeSlots };
    batch.set(settingsRef, timetableData);
    
    commitBatchWithContext(batch, {
      operation: 'create',
      path: `users/${user.uid}/settings/timetable`,
      data: timetableData
    });
  };

  useEffect(() => {
    if (user && !teachersLoading && !classesLoading && !settingsLoading && teachersCollection?.empty && classesCollection?.empty && settingsCollection?.empty) {
      // Data is not seeded yet for this new user.
      // The UI will show the settings page.
    }
  }, [user, firestore, teachersLoading, classesLoading, settingsLoading, teachersCollection, classesCollection, settingsCollection]);

  const handleUpdate = async (collectionName: 'teachers' | 'classes', items: (Teacher | SchoolClass)[]) => {
     if (!firestore || !user) return;
    const batch = writeBatch(firestore);
    let firstPath = '';
    items.forEach(item => {
      const { id, ...data } = item;
      const itemRef = doc(firestore, 'users', user.uid, collectionName, id);
      if (!firstPath) firstPath = itemRef.path;
      batch.set(itemRef, data);
    });
    commitBatchWithContext(batch, { operation: 'update', path: firstPath, data: items });
  }
  
  const handleClassesUpdate = (updatedClasses: SchoolClass[]) => {
    handleUpdate('classes', updatedClasses);
  };
  
  const handleTeachersUpdate = (updatedTeachers: Teacher[]) => {
    handleUpdate('teachers', updatedTeachers);
  }

  const handleAddTeacher = (newTeacherData: Omit<Teacher, 'id'>) => {
    if (!firestore || !user) return;
    const newDocRef = doc(collection(firestore, 'users', user.uid, 'teachers'));
    const newTeacher = { ...newTeacherData, id: newDocRef.id };
    const batch = writeBatch(firestore);
    batch.set(newDocRef, newTeacher);
    commitBatchWithContext(batch, { operation: 'create', path: newDocRef.path, data: newTeacher });
  };

  const handleEditTeacher = (updatedTeacher: Omit<Teacher, 'avatar'>) => {
    if (!firestore || !user) return;
    const teacherRef = doc(firestore, 'users', user.uid, 'teachers', updatedTeacher.id);
    const batch = writeBatch(firestore);
    batch.update(teacherRef, updatedTeacher as any);
    commitBatchWithContext(batch, { operation: 'update', path: teacherRef.path, data: updatedTeacher });
  }

  const handleDeleteTeacher = (teacherId: string) => {
    if (!firestore || !user) return;
    const batch = writeBatch(firestore);
    const teacherRef = doc(firestore, 'users', user.uid, 'teachers', teacherId);
    batch.delete(teacherRef);
    commitBatchWithContext(batch, { operation: 'delete', path: teacherRef.path });
  }

  const handleAddClass = (className: string) => {
    if (!firestore || !user) return;
    const newDocRef = doc(collection(firestore, 'users', user.uid, 'classes'));
    const newClass: Omit<SchoolClass, 'id'> = {
      name: className,
      schedule: {},
    };
    const batch = writeBatch(firestore);
    batch.set(newDocRef, newClass);
    commitBatchWithContext(batch, { operation: 'create', path: newDocRef.path, data: newClass });
  };

  const handleDeleteClass = (classId: string) => {
    if (!firestore || !user) return;
    const classRef = doc(firestore, 'users', user.uid, 'classes', classId);
    const batch = writeBatch(firestore);
    batch.delete(classRef);
    commitBatchWithContext(batch, { operation: 'delete', path: classRef.path });
  };

  const handleUpdateSchedule = (classId: string, newSchedule: any) => {
    if (!firestore || !user) return;
    const classRef = doc(firestore, 'users', user.uid, 'classes', classId);
    const batch = writeBatch(firestore);
    batch.update(classRef, { schedule: newSchedule });
    commitBatchWithContext(batch, { operation: 'update', path: classRef.path, data: { schedule: newSchedule } });
  };
  
  const handleTimetableSettingsUpdate = (newTimeSlots: TimeSlot[]) => {
      if (!firestore || !user) return;
      
      // If this is the first time setting the slots, seed the rest of the data.
      if (timeSlots.length === 0) {
        seedData();
      }

      const settingsRef = doc(firestore, 'users', user.uid, 'settings', 'timetable');
      const batch = writeBatch(firestore);
      batch.set(settingsRef, { slots: newTimeSlots });
      commitBatchWithContext(batch, { operation: 'update', path: settingsRef.path, data: { slots: newTimeSlots } });
  }


  if (isUserLoading || (!user) || teachersLoading || classesLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  if (timeSlots.length === 0 && !teachersLoading && !classesLoading && !settingsLoading && teachersCollection?.empty && classesCollection?.empty && settingsCollection?.empty) {
      return (
         <div className="flex flex-col min-h-screen bg-background">
            <Header />
            <main className="flex-1 p-4 sm:p-6 md:p-8">
               <SettingsTab
                  timeSlots={timeSlots}
                  onUpdate={handleTimetableSettingsUpdate}
               >
                 <div className='flex justify-start pt-6'>
                    <Button variant="outline" onClick={seedData}>
                        השתמש בהגדרות ברירת מחדל
                    </Button>
                </div>
               </SettingsTab>
            </main>
         </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <Tabs defaultValue="teachers" className="w-full">
          <div className='flex justify-center'>
            <TabsList className="grid w-full grid-cols-4 max-w-2xl">
              <TabsTrigger value="teachers">פרופילי מורים</TabsTrigger>
              <TabsTrigger value="classes">כיתות לימוד</TabsTrigger>
              <TabsTrigger value="timetable">זמינות מחליפים</TabsTrigger>
              <TabsTrigger value="settings">הגדרות</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="teachers">
            <TeacherList
              initialTeachers={teachers}
              allClasses={schoolClasses}
              timeSlots={timeSlots}
              onAddTeacher={handleAddTeacher}
              onEditTeacher={handleEditTeacher}
              onDeleteTeacher={handleDeleteTeacher}
              onClassesUpdate={handleClassesUpdate}
              onTeachersUpdate={handleTeachersUpdate}
            />
          </TabsContent>
           <TabsContent value="classes">
            <ClassList 
              initialClasses={schoolClasses} 
              allTeachers={teachers}
              timeSlots={timeSlots}
              onAddClass={handleAddClass}
              onDeleteClass={handleDeleteClass}
              onUpdateSchedule={handleUpdateSchedule}
            />
          </TabsContent>
          <TabsContent value="timetable">
            <Timetable allTeachers={teachers} timeSlots={timeSlots} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab timeSlots={timeSlots} onUpdate={handleTimetableSettingsUpdate}/>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
