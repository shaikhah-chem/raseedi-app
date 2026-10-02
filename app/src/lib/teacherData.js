import { supabase, q, fetchAll } from './supabase';

export const loadClasses = () => q(supabase.from('classes').select('*').order('grade').order('name'));
export const loadStudents = () => fetchAll(() => supabase.from('student_summary').select('*').order('full_name'));
export const loadTasks = () => q(supabase.from('tasks').select('*, lessons(title,is_flipped), task_codes(code)').order('due_at', { ascending: false }));
export const loadLessons = () => q(supabase.from('lessons').select('*').order('created_at', { ascending: false }));
export const loadCompletions = () => fetchAll(() => supabase.from('task_completions')
  .select('id,task_id,student_id,status,method,submitted_at,on_time,points_awarded,proof_text,proof_url,reviewed_at,review_note')
  .order('submitted_at', { ascending: false }));
export const loadTransactions = () => fetchAll(() => supabase.from('points_transactions')
  .select('*, users:created_by(full_name)').order('created_at', { ascending: false }));

export const classLabel = (classes, id) => {
  if (!id) return 'كل الفصول';
  const c = (classes || []).find((x) => x.id === id);
  return c ? `${c.grade} ${c.name}` : '—';
};

// الطالبات المستهدفات بمهمة
export const eligibleFor = (task, students) =>
  students.filter((s) => s.active && (!task.class_id || s.class_id === task.class_id));

export const codeOf = (task) => (Array.isArray(task.task_codes) ? task.task_codes[0]?.code : task.task_codes?.code) || '';
