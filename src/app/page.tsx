'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/app/header';
import TeacherList from '@/components/app/teacher-list';
import Timetable from '@/components/app/timetable';
import ClassList from '@/components/app/class-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { initialTeachers, initialClasses as defaultClasses } from '@/lib/data';
import type { SchoolClass, Teacher } from '@/lib/types';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);

  const [teachersCollection, teachersLoading, teachersError] = useCollection(
    user ? collection(firestore, 'users', user.uid, 'teachers') : null
  );

  const [classesCollection, classesLoading, classesError] = useCollection(
    user ? collection(firestore, 'users', user.uid, 'classes') : null
  );

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

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
  
  // Seed data for new user
  useEffect(() => {
    if (user && !teachersLoading && !classesLoading && teachersCollection?.empty && classesCollection?.empty) {
      const seedData = async () => {
        if (!firestore) return;
        const batch = writeBatch(firestore);
        
        initialTeachers.forEach(teacher => {
          const teacherRef = doc(collection(firestore, 'users', user.uid, 'teachers'));
          batch.set(teacherRef, { ...teacher, id: teacherRef.id });
        });

        defaultClasses.forEach(sClass => {
           const classRef = doc(collection(firestore, 'users', user.uid, 'classes'));
           batch.set(classRef, { ...sClass, id: classRef.id });
        });
        
        await batch.commit();
      };
      seedData();
    }
  }, [user, firestore, teachersLoading, classesLoading, teachersCollection, classesCollection]);


  const handleTeachersUpdate = async (updatedTeachers: Teacher[]) => {
    if (!firestore || !user) return;
    const batch = writeBatch(firestore);
    updatedTeachers.forEach(teacher => {
      const { id, ...data } = teacher;
      const teacherRef = doc(firestore, 'users', user.uid, 'teachers', id);
      batch.set(teacherRef, data);
    });
    await batch.commit();
  };
  
  const handleClassesUpdate = async (updatedClasses: SchoolClass[]) => {
    if (!firestore || !user) return;
    const batch = writeBatch(firestore);
    updatedClasses.forEach(schoolClass => {
        const { id, ...data } = schoolClass;
        const classRef = doc(firestore, 'users', user.uid, 'classes', id);
        batch.set(classRef, data);
    });
    await batch.commit();
  };

  const handleAddTeacher = async (newTeacherData: Omit<Teacher, 'id'>) => {
    if (!firestore || !user) return;
    const newDocRef = doc(collection(firestore, 'users', user.uid, 'teachers'));
    const newTeacher = { ...newTeacherData, id: newDocRef.id };
    const batch = writeBatch(firestore);
    batch.set(newDocRef, newTeacher);
    await batch.commit();
  };

  const handleEditTeacher = async (updatedTeacher: Omit<Teacher, 'avatar'>) => {
    if (!firestore || !user) return;
    const teacherRef = doc(firestore, 'users', user.uid, 'teachers', updatedTeacher.id);
    const batch = writeBatch(firestore);
    batch.update(teacherRef, updatedTeacher as any);
    await batch.commit();
  }

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!firestore || !user) return;
    const batch = writeBatch(firestore);
    const teacherRef = doc(firestore, 'users', user.uid, 'teachers', teacherId);
    batch.delete(teacherRef);
    await batch.commit();
  }

  const handleAddClass = async (className: string) => {
    if (!firestore || !user) return;
    const newDocRef = doc(collection(firestore, 'users', user.uid, 'classes'));
    const newClass: Omit<SchoolClass, 'id'> = {
      name: className,
      schedule: {},
    };
    const batch = writeBatch(firestore);
    batch.set(newDocRef, newClass);
    await batch.commit();
  };

  const handleDeleteClass = async (classId: string) => {
    if (!firestore || !user) return;
    const classRef = doc(firestore, 'users', user.uid, 'classes', classId);
    const batch = writeBatch(firestore);
    batch.delete(classRef);
    await batch.commit();
  };

  const handleUpdateSchedule = async (classId: string, newSchedule: any) => {
    if (!firestore || !user) return;
    const classRef = doc(firestore, 'users', user.uid, 'classes', classId);
    const batch = writeBatch(firestore);
    batch.update(classRef, { schedule: newSchedule });
    await batch.commit();
  };


  if (userLoading || (!user) || teachersLoading || classesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <Tabs defaultValue="teachers" className="w-full">
          <div className='flex justify-center'>
            <TabsList className="grid w-full grid-cols-3 max-w-xl">
              <TabsTrigger value="teachers">פרופילי מורים</TabsTrigger>
              <TabsTrigger value="classes">כיתות לימוד</TabsTrigger>
              <TabsTrigger value="timetable">זמינות מחליפים</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="teachers">
            <TeacherList
              initialTeachers={teachers}
              allClasses={schoolClasses}
              onAddTeacher={handleAddTeacher}
              onEditTeacher={handleEditTeacher}
              onDeleteTeacher={handleDeleteTeacher}
              onClassesUpdate={handleClassesUpdate}
            />
          </TabsContent>
           <TabsContent value="classes">
            <ClassList 
              initialClasses={schoolClasses} 
              allTeachers={teachers}
              onAddClass={handleAddClass}
              onDeleteClass={handleDeleteClass}
              onUpdateSchedule={handleUpdateSchedule}
            />
          </TabsContent>
          <TabsContent value="timetable">
            <Timetable allTeachers={teachers} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
