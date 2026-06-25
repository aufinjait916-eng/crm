import React, { useState } from 'react';
import { FormQuestion, SubmissionAnswer } from '../types';
import { Check, ClipboardList, Info } from 'lucide-react';

interface DynamicFormRendererProps {
  questions: FormQuestion[];
  onSubmit: (answers: SubmissionAnswer[]) => Promise<void>;
  loading?: boolean;
  initialAnswers?: SubmissionAnswer[];
}

export default function DynamicFormRenderer({ questions, onSubmit, loading = false, initialAnswers = [] }: DynamicFormRendererProps) {
  // Store form state: key is question ID, value is the compiled string answer
  const [formState, setFormState] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    if (initialAnswers && initialAnswers.length > 0) {
      initialAnswers.forEach(sa => {
        initial[sa.question_id] = sa.answer_value;
      });
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);

  const questionsKey = (questions || []).map(q => q.id).join(',');
  const initialAnswersKey = (initialAnswers || []).map(ia => `${ia.question_id}:${ia.answer_value}`).join(',');

  React.useEffect(() => {
    if (initialAnswers && initialAnswers.length > 0) {
      const initial: Record<number, string> = {};
      initialAnswers.forEach(sa => {
        initial[sa.question_id] = sa.answer_value;
      });
      setFormState(initial);
    } else {
      setFormState({});
    }
  }, [initialAnswersKey, questionsKey]);

  const handleInputChange = (questionId: number, value: string) => {
    setFormState(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleCheckboxChange = (questionId: number, option: string, checked: boolean) => {
    const currentAnswer = formState[questionId] || "";
    let selectedOptions = currentAnswer ? currentAnswer.split(", ") : [];

    if (checked) {
      if (!selectedOptions.includes(option)) {
        selectedOptions.push(option);
      }
    } else {
      selectedOptions = selectedOptions.filter(o => o !== option);
    }

    setFormState(prev => ({
      ...prev,
      [questionId]: selectedOptions.join(", ")
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation: Check for required questions
    const submissionAnswers: SubmissionAnswer[] = [];

    for (const q of questions) {
      const val = formState[q.id];
      const answerTrimmed = val ? val.trim() : "";

      if (q.is_required && !answerTrimmed) {
        setError(`"${q.question_text}" is a required field. Please answer it.`);
        // Scroll to error
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      submissionAnswers.push({
        question_id: q.id,
        answer_value: answerTrimmed
      });
    }

    onSubmit(submissionAnswers);
  };

  if (questions.length === 0) {
    return (
      <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500">
        <Info className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm font-medium">No dynamic client questions are active in the system.</p>
        <p className="text-xs text-slate-400 mt-1">Request an Admin to configure fields in the Form Builder.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q) => {
          const value = formState[q.id] || "";

          return (
            <div key={q.id} className="p-5 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col space-y-2">
              <label className="text-sm font-semibold text-slate-900" htmlFor={`question-${q.id}`}>
                {q.question_text}
                {q.is_required && <span className="ml-1 text-rose-500 text-sm">*</span>}
              </label>

              {/* RENDER DYNAMIC FIELD TYPES */}
              <div className="mt-1">
                {q.input_type === "text" && (
                  <textarea
                    id={`question-${q.id}`}
                    rows={3}
                    value={value}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    required={q.is_required}
                    className="block w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder-slate-400"
                    placeholder="Type your detailed observations here..."
                  />
                )}

                {q.input_type === "number" && (
                  <input
                    id={`question-${q.id}`}
                    type="number"
                    value={value}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    required={q.is_required}
                    className="block w-36 px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="e.g. 100"
                  />
                )}

                {q.input_type === "dropdown" && (
                  <select
                    id={`question-${q.id}`}
                    value={value}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    required={q.is_required}
                    className="block w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">-- Choose one --</option>
                    {q.options?.map((opt, idx) => (
                      <option key={idx} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}

                {q.input_type === "datetime" && (
                  <input
                    id={`question-${q.id}`}
                    type="datetime-local"
                    value={value}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    required={q.is_required}
                    className="block w-64 px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                )}

                {q.input_type === "radio" && (
                  <div className="space-y-2 mt-1">
                    {q.options?.map((opt, idx) => (
                      <label key={idx} className="flex items-center space-x-3 cursor-pointer group">
                        <input
                          type="radio"
                          name={`radio-group-${q.id}`}
                          value={opt}
                          checked={value === opt}
                          onChange={() => handleInputChange(q.id, opt)}
                          className="h-4 w-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 select-none">
                          {opt}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {q.input_type === "checkbox" && (
                  <div className="space-y-2 mt-1">
                    {q.options?.map((opt, idx) => {
                      const list = value ? value.split(", ") : [];
                      const isChecked = list.includes(opt);

                      return (
                        <label key={idx} className="flex items-center space-x-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleCheckboxChange(q.id, opt, e.target.checked)}
                            className="h-4 w-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 select-none">
                            {opt}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2">
        <button
          id="confirm-form-renderer-submit"
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 active:scale-[0.98] disabled:opacity-50 transition-all shadow-md shadow-emerald-600/15"
        >
          <Check className="h-5 w-5" />
          <span>{loading ? "Completing Task & Saving Entry..." : "Submit Report & Complete Task"}</span>
        </button>
      </div>
    </form>
  );
}
