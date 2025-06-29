import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, X, Video, Info, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from '@/components/ui/textarea';

const PermanentExamForm = ({ onExamCreated, onCancel, userId, examToEdit }) => {
  const [examTitle, setExamTitle] = useState('');
  const [examDuration, setExamDuration] = useState(60);
  const [questions, setQuestions] = useState([{
    id: crypto.randomUUID(),
    question: '',
    options: ['', ''],
    correct_answers: [],
    question_type: 'single',
    video_url: '',
    time_limit_seconds: 30,
    explanation: '',
    explanation_video_url: ''
  }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (examToEdit) {
      setExamTitle(examToEdit.title);
      setExamDuration(examToEdit.duration);
      setQuestions(examToEdit.questions.map(q => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correct_answers: q.correct_answers,
          question_type: q.question_type,
          video_url: q.video_url || '',
          time_limit_seconds: q.time_limit_seconds || 30,
          explanation: q.explanation || '',
          explanation_video_url: q.explanation_video_url || ''
      })));
    }
  }, [examToEdit]);

  const addQuestion = () => {
    setQuestions([...questions, {
      id: crypto.randomUUID(),
      question: '',
      options: ['', ''],
      correct_answers: [],
      question_type: 'single',
      video_url: '',
      time_limit_seconds: 30,
      explanation: '',
      explanation_video_url: ''
    }]);
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) setQuestions(questions.filter((_, i) => i !== index));
    else toast({ title: "تنبيه", description: "يجب أن يحتوي الاختبار على سؤال واحد على الأقل." });
  };

  const updateQuestionField = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    if(field === 'question_type') updated[index].correct_answers = [];
    setQuestions(updated);
  };

  const addOption = (qIndex) => {
    const updated = [...questions];
    updated[qIndex].options.push('');
    setQuestions(updated);
  };

  const removeOption = (qIndex, oIndex) => {
    const updated = [...questions];
    if (updated[qIndex].options.length > 2) {
      updated[qIndex].options.splice(oIndex, 1);
      updated[qIndex].correct_answers = updated[qIndex].correct_answers.filter(i => i !== oIndex);
      setQuestions(updated);
    } else {
      toast({ title: "تنبيه", description: "يجب أن يحتوي السؤال على خيارين على الأقل." });
    }
  };

  const updateOption = (qIndex, oIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const handleCorrectAnswerChange = (qIndex, oIndex) => {
    const updated = [...questions];
    const question = updated[qIndex];
    if (question.question_type === 'single') question.correct_answers = [oIndex];
    else {
      const currentIndex = question.correct_answers.indexOf(oIndex);
      if (currentIndex === -1) question.correct_answers.push(oIndex);
      else question.correct_answers.splice(currentIndex, 1);
    }
    setQuestions(updated);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    if (!userId || !examTitle.trim() || questions.some(q => !q.question.trim() || q.options.some(opt => !opt.trim()) || q.correct_answers.length === 0)) {
        toast({ title: "بيانات غير مكتملة", description: "يرجى تعبئة جميع الحقول المطلوبة.", variant: "destructive" });
        setIsSubmitting(false); return;
    }

    try {
      if (examToEdit && examToEdit.id) {
        // تحديث اختبار موجود
        const { error: updateError } = await supabase
          .from('tests')
          .update({ title: examTitle, duration: examDuration })
          .eq('id', examToEdit.id);

        if (updateError) throw updateError;

        // حذف جميع الأسئلة القديمة المرتبطة بالاختبار
        const { error: deleteQuestionsError } = await supabase
          .from('questions')
          .delete()
          .eq('test_id', examToEdit.id);

        if (deleteQuestionsError) throw deleteQuestionsError;

        // إدخال الأسئلة الجديدة المرتبطة بالاختبار
        const questionsToInsert = questions.map(q => ({
          test_id: examToEdit.id,
          question_text: q.question,
          options: q.options,
          correct_answers: q.correct_answers,
          question_type: q.question_type,
          video_url: q.video_url,
          time_limit_seconds: q.time_limit_seconds,
          explanation: q.explanation,
          explanation_video_url: q.explanation_video_url
        }));

        const { error: insertQuestionsError } = await supabase.from('questions').insert(questionsToInsert);
        if (insertQuestionsError) throw insertQuestionsError;

        toast({ title: "تم التحديث!", description: "تم تعديل الاختبار بنجاح." });
      } else {
        // إنشاء اختبار جديد
        const { data: testData, error: testError } = await supabase
          .from('tests')
          .insert([{ title: examTitle, duration: examDuration, user_id: userId, is_permanent: true }])
          .select().single();

        if (testError) throw testError;

        const questionsToInsert = questions.map(q => ({
          test_id: testData.id,
          question_text: q.question,
          options: q.options,
          correct_answers: q.correct_answers,
          question_type: q.question_type,
          video_url: q.video_url,
          time_limit_seconds: q.time_limit_seconds,
          explanation: q.explanation,
          explanation_video_url: q.explanation_video_url
        }));

        const { error: questionsError } = await supabase.from('questions').insert(questionsToInsert);
        if (questionsError) {
          await supabase.from('tests').delete().eq('id', testData.id);
          throw questionsError;
        }

        toast({ title: "تم بنجاح!", description: "تم حفظ الاختبار الثابت بنجاح." });
      }

      onExamCreated();
    } catch (error) {
      toast({ title: "خطأ", description: error.message || "حدث خطأ أثناء الحفظ.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">{examToEdit ? 'تعديل اختبار ثابت' : 'إنشاء اختبار ثابت جديد'}</h2>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label htmlFor="title" className="text-white mb-2 block">عنوان الاختبار</Label><Input id="title" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="أدخل عنوان الاختبار" className="bg-slate-700 border-slate-600 text-white" disabled={isSubmitting} /></div>
            <div><Label htmlFor="duration" className="text-white mb-2 block">المدة الإجمالية (دقائق)</Label><Input id="duration" type="number" value={examDuration} onChange={(e) => setExamDuration(parseInt(e.target.value) || 1)} className="bg-slate-700 border-slate-600 text-white" min="1" disabled={isSubmitting} /></div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-4"><Label className="text-white text-lg">الأسئلة</Label><Button onClick={addQuestion} variant="outline" className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/20" disabled={isSubmitting}><Plus className="w-4 h-4 ml-2" /> إضافة سؤال</Button></div>
            <div className="space-y-6">
              {questions.map((q, qIndex) => (
                <motion.div key={q.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex justify-between items-center mb-3"><Label cl
