
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { initializeFirebase } from '@/firebase';
import { createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, writeBatch, collection } from 'firebase/firestore';
import { daysOfWeek } from '@/lib/constants';

export default function DemoSetupPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [credentials, setCredentials] = useState<{email: string, password: string} | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    setStatus('loading');
    try {
      const { auth, firestore } = initializeFirebase();
      const email = `demo_${Date.now()}@school.com`;
      const password = 'password123';

      // 1. Create User
      await signOut(auth);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: "Demo Admin" });

      const batch = writeBatch(firestore);
      const userId = user.uid;

      // 2. Settings (Time Slots)
      const timeSlots = [
        { id: '1', start: '08:00', end: '08:45', type: 'lesson' },
        { id: '2', start: '08:45', end: '09:30', type: 'lesson' },
        { id: '3', start: '09:30', end: '09:45', type: 'break' },
        { id: '4', start: '09:45', end: '10:30', type: 'lesson' },
        { id: '5', start: '10:30', end: '11:15', type: 'lesson' },
        { id: '6', start: '11:15', end: '12:00', type: 'lesson' },
      ];
      batch.set(doc(firestore, 'settings', `timetable_${userId}`), { 
        userId, 
        slots: timeSlots,
        updatedAt: new Date().toISOString()
      });

      // 3. Teachers
      const teachersData = [
        { name: "Sarah Cohen", subjects: ["Mathematics", "Physics"], preferences: "Morning classes" },
        { name: "David Levi", subjects: ["History", "Bible"], preferences: "No Sundays" },
        { name: "Rachel Mizrahi", subjects: ["English", "Literature"], preferences: "" },
        { name: "Yossi Ben-Ari", subjects: ["Sports", "Biology"], preferences: "Gym access" },
        { name: "Michal Golan", subjects: ["Art", "Chemistry"], preferences: "" },
      ];

      const teacherIds: string[] = [];
      const teachers: any[] = [];

      teachersData.forEach((t, index) => {
        const teacherRef = doc(collection(firestore, 'teachers'));
        const teacherId = teacherRef.id;
        teacherIds.push(teacherId);

        const availability = daysOfWeek.map(day => ({
          day,
          slots: timeSlots.filter(s => s.type === 'lesson').map(s => ({ start: s.start, end: s.end }))
        }));

        // Make David unavailable on Sunday
        if (t.name === "David Levi") {
            const sunday = availability.find(a => a.day === "ראשון");
            if (sunday) sunday.slots = [];
        }

        const teacher = {
          id: teacherId,
          userId,
          name: t.name,
          subjects: t.subjects,
          availability,
          preferences: t.preferences,
          avatar: { fallback: t.name.split(' ').map(n => n[0]).join('') },
          schedule: {},
          absences: []
        };
        
        teachers.push(teacher);
        batch.set(teacherRef, teacher);
      });

      // 4. Classes
      const classNames = ["Grade 10-1", "Grade 11-2", "Grade 12-1"];
      const classIds: string[] = [];
      const classes: any[] = [];

      classNames.forEach(name => {
          const classRef = doc(collection(firestore, 'classes'));
          classIds.push(classRef.id);
          const schoolClass = {
              id: classRef.id,
              userId,
              name,
              schedule: {}
          };
          classes.push(schoolClass);
          batch.set(classRef, schoolClass);
      });

      // 5. Schedule (Assign some lessons)
      const assignLesson = (classIndex: number, teacherIndex: number, day: string, time: string, subject: string) => {
          const classId = classIds[classIndex];
          const teacherId = teacherIds[teacherIndex];
          
          // Update Class Schedule
          if (!classes[classIndex].schedule[day]) classes[classIndex].schedule[day] = {};
          if (!classes[classIndex].schedule[day][time]) classes[classIndex].schedule[day][time] = [];
          classes[classIndex].schedule[day][time].push({ subject, teacherId, classId });

          // Update Teacher Schedule
          if (!teachers[teacherIndex].schedule[day]) teachers[teacherIndex].schedule[day] = {};
          if (!teachers[teacherIndex].schedule[day][time]) teachers[teacherIndex].schedule[day][time] = [];
          teachers[teacherIndex].schedule[day][time].push({ subject, teacherId, classId });
      };

      assignLesson(0, 0, "ראשון", "08:00", "Mathematics"); // Sarah, 10-1, Sun 8:00
      assignLesson(0, 1, "ראשון", "08:45", "History");     // David, 10-1, Sun 8:45
      assignLesson(1, 2, "ראשון", "08:00", "English");     // Rachel, 11-2, Sun 8:00
      assignLesson(2, 3, "שני", "10:30", "Sports");        // Yossi, 12-1, Mon 10:30

      // Update modified docs
      classes.forEach(c => batch.set(doc(firestore, 'classes', c.id), c));
      teachers.forEach(t => batch.set(doc(firestore, 'teachers', t.id), t));

      // 6. Absences (Mark Sarah absent for today)
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const absence = {
          id: doc(collection(firestore, 'dummy')).id,
          date: todayStr,
          isAllDay: true,
          startTime: "08:00",
          endTime: "15:00"
      };
      
      // Update Sarah's absence in the batch
      // Since we already set Sarah in the batch, and batch operations are not applied until commit,
      // we can't "update" the doc we just set in the same batch easily without overwriting or merging carefully.
      // But we have the 'teachers' array which we used to set. We can modify it and re-set.
      // Wait, we already called batch.set(teacherRef, teacher) inside the loop.
      // And then we called batch.set(doc(..., t.id), t) at the end of step 5.
      // So we just need to modify teachers[0] before step 5's batch.set loop?
      // Actually, step 5 loop iterates over 'teachers' array.
      // So if I modify teachers[0] NOW (after step 5 loop ran), I need to re-set it.
      
      teachers[0].absences.push(absence);
      batch.set(doc(firestore, 'teachers', teachers[0].id), teachers[0]);

      await batch.commit();

      setCredentials({ email, password });
      setStatus('success');
    } catch (e: any) {
      console.error(e);
      setError(e.message);
      setStatus('error');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Setup Demo Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'idle' && (
            <Button onClick={handleSeed} className="w-full">
              Create & Seed Demo Account
            </Button>
          )}
          
          {status === 'loading' && (
            <div className="text-center">Creating account and seeding data...</div>
          )}

          {status === 'success' && credentials && (
            <div className="space-y-2 bg-green-50 p-4 rounded border border-green-200">
              <div className="font-bold text-green-800">Success!</div>
              <div>Email: <span className="font-mono select-all">{credentials.email}</span></div>
              <div>Password: <span className="font-mono select-all">{credentials.password}</span></div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-red-500">Error: {error}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
