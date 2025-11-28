import Header from '@/components/app/header';
import TeacherList from '@/components/app/teacher-list';
import Timetable from '@/components/app/timetable';
import ClassList from '@/components/app/class-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { initialTeachers, initialClasses } from '@/lib/data';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <Tabs defaultValue="teachers" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-xl mx-auto">
            <TabsTrigger value="teachers">פרופילי מורים</TabsTrigger>
            <TabsTrigger value="classes">כיתות לימוד</TabsTrigger>
            <TabsTrigger value="timetable">זמינות מחליפים</TabsTrigger>
          </TabsList>
          <TabsContent value="teachers">
            <TeacherList initialTeachers={initialTeachers} />
          </TabsContent>
           <TabsContent value="classes">
            <ClassList initialClasses={initialClasses} allTeachers={initialTeachers} />
          </TabsContent>
          <TabsContent value="timetable">
            <Timetable allTeachers={initialTeachers} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
