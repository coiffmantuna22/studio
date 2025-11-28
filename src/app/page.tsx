import Header from '@/components/app/header';
import TeacherList from '@/components/app/teacher-list';
import { initialTeachers } from '@/lib/data';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <TeacherList initialTeachers={initialTeachers} />
      </main>
    </div>
  );
}
