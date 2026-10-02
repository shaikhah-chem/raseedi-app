import { supabase, q } from './supabase';

export async function loadStudentAll() {
  const [me, tasks, comps, txs, rewards, reds] = await Promise.all([
    q(supabase.from('student_summary').select('*').maybeSingle()),
    q(supabase.from('tasks').select('*, lessons(id,title,is_flipped,lesson_date)').eq('status', 'active').order('sort_order').order('due_at')),
    q(supabase.from('task_completions').select('id,task_id,status,submitted_at,on_time,points_awarded,method,review_note')),
    q(supabase.from('points_transactions').select('*').order('created_at', { ascending: false })),
    q(supabase.from('rewards').select('*').eq('active', true).order('sort_order').order('cost')),
    q(supabase.from('redemptions').select('*, rewards(title,icon)').order('created_at', { ascending: false })),
  ]);
  return { me, tasks, comps, txs, rewards, reds };
}

export function nextRewardTarget(balance, rewards, reds) {
  const usable = rewards.filter((r) => !r.max_per_student || reds.filter((x) => x.reward_id === r.id && x.status !== 'rejected').length < r.max_per_student);
  const above = usable.filter((r) => r.cost > balance).sort((a, b) => a.cost - b.cost);
  const affordable = usable.filter((r) => r.cost <= balance);
  return { next: above[0] || null, affordable };
}
