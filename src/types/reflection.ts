/**
 * Shared types for the reflection/study flow.
 *
 * Extracted from ReflectionQuestions.tsx and ReadingPlanWidget.tsx
 * to eliminate type duplication.
 */

export type AiQuestions = {
  q1: string;
  q1_suggestions: string[];
  q2: string;
  q2_suggestions: string[];
  q3: string;
  q3_suggestions: string[];
  q4: string;
  q4_suggestions: string[];
};

export type ReflectionAnswer = {
  questionIndex: number;
  question: string;
  answer: string;
  timestamp: string;
};

export type ReflectionEntry = {
  planId: string;
  dayIndex: number;
  bookId: string;
  chapter: number;
  answers: ReflectionAnswer[];
  createdAt: string;
};
