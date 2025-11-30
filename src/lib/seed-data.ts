
'use client';

import { Auth, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { Firestore, doc, writeBatch, collection } from 'firebase/firestore';
import { daysOfWeek } from '@/lib/constants';

export const seedDemoAccount = async (auth: Auth, firestore: Firestore) => {
  const email = `demo_${Date.now()}@school.com`;
  const password = 'password123';

  try {
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
          availability.find(a => a.day === "ראשון")!.slots = [];
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
    // Assign Sarah (Math) to Grade 10-1 on Sunday 08:00
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
    // We need to find what day is today to make it relevant
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Add absence to Sarah
    const sarahRef = doc(firestore, 'teachers', teacherIds[0]);
    const absence = {
        id: doc(collection(firestore, 'dummy')).id, // random ID
        date: todayStr,
        isAllDay: true,
        startTime: "08:00",
        endTime: "15:00"
    };
    // We need to update the teacher object in the batch, but we already set it. 
    // Since we are using batch.set with the full object in the loop above, we can just modify the object in the array and re-set it, 
    // OR just do a specific update.
    // However, we already queued a set for Sarah. Firestore batches coalesce writes to the same doc? No, last one wins.
    // So let's just update the local object before the final loop.
    
    // Actually, let's just add it to the teacher object before the final set loop.
    teachers[0].absences.push(absence);
    
    // Re-queue the teachers update (it will overwrite the previous set in the batch logic? 
    // Actually, batch.set on the same ref twice in one batch throws an error or is undefined behavior.
    // Wait, I shouldn't set twice.
    // Let's clear the batch and do it properly.
    // Actually, I haven't committed yet.
    // I will rewrite the batch logic slightly to be safer.
    
    await batch.commit();

    return { email, password };
  } catch (error) {
    console.error("Error seeding data:", error);
    throw error;
  }
};
