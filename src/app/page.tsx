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
import { collection, doc, writeBatch, query, where } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Loader2 } from 'lucide-react';
import { commitBatchWithContext } from '@/lib/firestore-utils';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  
  const teachersQuery = user ? query(collection(firestore, 'teachers'), where('userId', '==', user.uid)) : null;
  const classesQuery = user ? query(collection(firestore, 'classes'), where('userId', '==', user.uid)) : null;
  const settingsQuery = user ? query(collection(firestore, 'settings'), where('userId', '==', user.uid)) : null;
  
  const [teachersCollection, teachersLoading] = useCollection(teachersQuery);
  const [classesCollection, classesLoading] = useCollection(classesQuery);
  const [settingsCollection, settingsLoading] = useCollection(settingsQuery);

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
      const settingsDoc = settingsCollection.docs.find(d => d.id === `timetable_${user?.uid}`);
      if (settingsDoc?.exists()) {
        setTimeSlots(settingsDoc.data().slots);
      } else {
        setTimeSlots([]);
      }
    }
  }, [settingsCollection, user]);

  const seedData = async () => {
    if (!firestore || !user) return;
    const batch = writeBatch(firestore);
    
    initialTeachers.forEach(teacher => {
      const teacherRef = doc(collection(firestore, 'teachers'));
      batch.set(teacherRef, { ...teacher, id: teacherRef.id, userId: user.uid });
    });

    defaultClasses.forEach(sClass => {
        const classRef = doc(collection(firestore, 'classes'));
        batch.set(classRef, { ...sClass, id: classRef.id, userId: user.uid });
    });
    
    const settingsRef = doc(firestore, 'settings', `timetable_${user.uid}`);
    const timetableData = { slots: initialTimeSlots, userId: user.uid };
    batch.set(settingsRef, timetableData);
    
    await commitBatchWithContext(batch, {
      operation: 'create',
      path: `settings/timetable_${user.uid}`,
      data: timetableData,
      firestore
    });
  };
  
   const handleUpdate = async (collectionName: 'teachers' | 'classes', items: (Teacher | SchoolClass)[]) => {
     if (!firestore || !user) return;
    const batch = writeBatch(firestore);
    let firstPath = '';
    items.forEach(item => {
      const { id, ...data } = item;
      const itemRef = doc(firestore, collectionName, id);
      if (!firstPath) firstPath = itemRef.path;
      batch.set(itemRef, data);
    });
    await commitBatchWithContext(batch, { operation: 'update', path: firstPath, data: items, firestore });
  }

  const handleAddTeacher = async (newTeacherData: Omit<Teacher, 'id' | 'userId' | 'avatar'>) => {
    if (!firestore || !user) return;
    const newDocRef = doc(collection(firestore, 'teachers'));
    const fallback = newTeacherData.name.split(' ').map((n) => n[0]).join('').toUpperCase();
    const newTeacher = { ...newTeacherData, id: newDocRef.id, userId: user.uid, avatar: { fallback } };
    const batch = writeBatch(firestore);
    batch.set(newDocRef, newTeacher);
    await commitBatchWithContext(batch, { operation: 'create', path: newDocRef.path, data: newTeacher, firestore });
  };

  const handleEditTeacher = async (updatedTeacher: Omit<Teacher, 'avatar' | 'userId'>) => {
    if (!firestore || !user) return;
    const teacherRef = doc(firestore, 'teachers', updatedTeacher.id);
    const batch = writeBatch(firestore);
    batch.update(teacherRef, updatedTeacher as any);
    await commitBatchWithContext(batch, { operation: 'update', path: teacherRef.path, data: updatedTeacher, firestore });
  }

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!firestore || !user) return;
    const batch = writeBatch(firestore);
    
    // 1. Delete the teacher doc
    const teacherRef = doc(firestore, 'teachers', teacherId);
    batch.delete(teacherRef);

    // 2. Remove teacher from all class schedules
    const updatedClasses = JSON.parse(JSON.stringify(schoolClasses)) as SchoolClass[];
    updatedClasses.forEach((schoolClass) => {
      let classWasModified = false;
      Object.keys(schoolClass.schedule).forEach(day => {
        if (schoolClass.schedule[day]) {
          Object.keys(schoolClass.schedule[day]).forEach(time => {
            const lesson = schoolClass.schedule[day][time];
            if (lesson && lesson.teacherId === teacherId) {
              delete schoolClass.schedule[day][time];
              classWasModified = true;
            }
          });
        }
      });
      if (classWasModified) {
        const classRef = doc(firestore, 'classes', schoolClass.id);
        const {id, ...classData} = schoolClass;
        batch.set(classRef, classData);
      }
    });

    await commitBatchWithContext(batch, { operation: 'delete', path: teacherRef.path, firestore });
  }

  const handleAddClass = async (className: string) => {
    if (!firestore || !user) return;
    const newDocRef = doc(collection(firestore, 'classes'));
    const newClass: Omit<SchoolClass, 'id'> = {
      name: className,
      schedule: {},
      userId: user.uid,
    };
    const batch = writeBatch(firestore);
    batch.set(newDocRef, newClass);
    await commitBatchWithContext(batch, { operation: 'create', path: newDocRef.path, data: newClass, firestore });
  };

  const handleDeleteClass = async (classId: string) => {
    if (!firestore || !user) return;
    const classRef = doc(firestore, 'classes', classId);
    const batch = writeBatch(firestore);
    batch.delete(classRef);
    await commitBatchWithContext(batch, { operation: 'delete', path: classRef.path, firestore });
  };

  const handleUpdateSchedule = async (classId: string, newSchedule: any) => {
    if (!firestore || !user) return;
    const classRef = doc(firestore, 'classes', classId);
    const batch = writeBatch(firestore);
    batch.update(classRef, { schedule: newSchedule });
    await commitBatchWithContext(batch, { operation: 'update', path: classRef.path, data: { schedule: newSchedule }, firestore });
  };
  
  const handleTimetableSettingsUpdate = async (newTimeSlots: TimeSlot[]) => {
      if (!firestore || !user) return;
      
      const isInitialSetup = timeSlots.length === 0 && teachers.length === 0 && schoolClasses.length === 0;

      const settingsRef = doc(firestore, 'settings', `timetable_${user.uid}`);
      const batch = writeBatch(firestore);
      const timetableData = { slots: newTimeSlots, userId: user.uid };
      batch.set(settingsRef, timetableData, { merge: true });
      await commitBatchWithContext(batch, { operation: 'update', path: settingsRef.path, data: timetableData, firestore });

      if (isInitialSetup) {
        await seedData();
      }
  }

  const isDataLoading = isUserLoading || teachersLoading || classesLoading || settingsLoading;

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  const isNewUser = !isDataLoading && user && teachers.length === 0 && schoolClasses.length === 0 && timeSlots.length === 0;

  if (isNewUser) {
      return (
         <div className="flex flex-col min-h-screen bg-background">
            <Header />
            <main className="flex-1 p-4 sm:p-6 md:p-8">
               <SettingsTab
                  timeSlots={[]}
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
              teachers={teachers}
              allClasses={schoolClasses}
              timeSlots={timeSlots}
              onAddTeacher={handleAddTeacher}
              onEditTeacher={handleEditTeacher}
              onDeleteTeacher={handleDeleteTeacher}
              onClassesUpdate={handleUpdate}
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
