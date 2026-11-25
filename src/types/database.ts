export type Role = 'instructor' | 'student';
export type MaterialType = 'presentation' | 'exercise';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
}

export interface Course {
  id: string;
  title: string;
  code: string;
  join_code: string;
  instructor_id: string;
  created_at: string;
}

export interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  enrolled_at: string;
}

export interface Material {
  id: string;
  course_id: string;
  type: MaterialType;
  title: string;
  instructions: string | null;
  file_url: string | null;
  file_name: string | null;
  due_date: string | null;
  max_score: number;
  created_at: string;
}

export interface Submission {
  id: string;
  material_id: string;
  student_id: string;
  answer_text: string | null;
  file_url: string | null;
  file_name: string | null;
  score: number | null;
  feedback: string | null;
  submitted_at: string;
}