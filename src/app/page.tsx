'use client';

import { useState } from 'react';
import Header from '@/components/app/header';
import TeacherList from '@/components/app/teacher-list';
import Timetable from '@/components/app/timetable';
import ClassList from '@/components/app/class-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { initialTeachers, initialClasses as defaultClasses } from '@/lib/data';
import type { SchoolClass, Teacher } from '@/lib/types';

export default function Home() {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>(defaultClasses);

  const handleTeachersUpdate = (updatedTeachers: Teacher[]) => {
    setTeachers(updatedTeachers);
  };
  
  const handleClassesUpdate = (updatedClasses: SchoolClass[]) => {
    setSchoolClasses(updatedClasses);
  };

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
              onTeachersUpdate={handleTeachersUpdate} 
              onClassesUpdate={handleClassesUpdate}
            />
          </TabsContent>
           <TabsContent value="classes">
            <ClassList 
              initialClasses={schoolClasses} 
              allTeachers={teachers}
              onClassesUpdate={handleClassesUpdate}
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
