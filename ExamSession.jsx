import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import RegistrationStep from '@/components/exam/RegistrationStep';
import ExamStep from '@/components/exam/ExamStep';
import CompletionStep from '@/components/exam/CompletionStep';

// تحديث isCorrect لدعم الأسئلة المركبة
const isCorrect = (userAnswers, correctAnswers, questionType) => {
  if (!userAnswers || !correctAnswers) return false;

  if (questionType === 'compound') {
    // هنا كل واحد من correctAnswers هو مصفوفة فرعية
    if (!Array.isArray(userAnswers) || !Array.isArray(correctAnswers)) return false;
    if (userAnswers.length !== correctAnswers.length) return false;

    return userAnswers.every((partAnswers, index) => {
      const correctPartAnswers = correctAnswers[index];
      if (!Array.isArray(partAnswers) || !Array.isArray(correctPartAnswers)) return false;
      if (partAnswers.length !== correctPartAnswers.length) return false;

      const sortedUser = [...partAnswers].sort();
      const sortedCorrect = [...correctPartAnswers].sort();
      return sortedUser.every((val, i) => val === sortedCorrect[i]);
    });
  } else {
    // single أو multiple
    if (userAnswers.length !== correctAnswers.length) return false;
    const sortedUserAnswers = [...userAnswers].sort();
    const sortedCorrectAnswers = [...correctAnswers].sort();
    return sortedUserAnswers.every((val, index) => val === sortedCorrectAnswers[index]);
  }
};

const ExamSession = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [currentStep, setCurrentStep] = useState('registration');
  const [studentInfo, setStudentInfo] = useState({ name: '', phone: '' });
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [participantId, setParticipantId] = useState(null);
  const [examStartTime, setExamStartTime] = useState(null);
  const [sessionUserId, setSessionUserId] = useState(null);

  useEffect(() => {
    const fetchExamDetails = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tests')
        .select(`id, title, duration, user_id, original_test_id`)
        .eq('id', examId)
        .single();

      if (error || !data) {
        toast({ title: "خطأ", description: "جلسة الاختبار غير موجودة أو فشل في التحميل", variant: "destructive" });
        navigate('/');
        return;
      }
      
      setSessionUserId(data.user_id);
      
      const questionSourceId = data.original_test_id || data.id;

      const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('id, question_text, options, correct_answers, question_type, time_limit_seconds')
          .eq('test_id', questionSourceId);

      if (questionsError) {
          toast({ title: "خطأ", description: "فشل في تحميل أسئلة الاختبار.", variant: "destructive" });
          navigate('/');
          return;
      }

      const formattedExam = {
        id: data.id,
        title: data.title,
        duration: data.duration,
        questions: (questionsData || []).map(q => ({
          id: q.id,
          question: q.question_text,
          options: q.options || [],
          correct_answers: q.correct_answers || [],
          question_type: q.question_type || 'single',
          video_url: null,
          time_limit_seconds: q.time_limit_seconds
        })).sort((a,b) => (a.id || '').localeCompare(b.id || ''))
      };
      setExam(formattedExam);
      setTimeLeft(formattedExam.duration * 60);
      setLoading(false);
    };

    if (examId) fetchExamDetails();
    else {
      toast({ title: "خطأ", description: "معرف الجلسة مفقود", variant: "destructive" });
      navigate('/');
    }
  }, [examId, navigate]);

  useEffect(() => {
    let timer;
    if (currentStep === 'exam' && timeLeft > 0 && examStartTime) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [currentStep, timeLeft, examStartTime]);

  const handleRegistrationSubmit = async (info) => {
    setStudentInfo(info);
    if (!info.name.trim() || !info.phone.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال الاسم ورقم الهاتف", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from('session_participants')
      .insert([{ session_id: examId, name: info.name, phone_number: info.phone, session_user_id: sessionUserId }])
      .select('id').single();

    if (error || !data) {
      toast({ title: "خطأ", description: `فشل في تسجيل المشارك: ${error.message}`, variant: "destructive" });
      return;
    }
    setParticipantId(data.id);
    setExamStartTime(Date.now());
    setCurrentStep('exam');
    toast({ title: "بدء الاختبار! 🚀", description: "حظاً موفقاً في الاختبار" });
  };

  const submitExam = async () => {
    if (currentStep !== 'exam' || !exam || !exam.questions) return; 

    const score = exam.questions.reduce((total, question) => {
        const userAnswersForQuestion = answers[question.id] || [];
        return total + (isCorrect(userAnswersForQuestion, question.correct_answers, question.question_type) ? 1 : 0);
    }, 0);

    const percentage = exam.questions.length > 0 ? Math.round((score / exam.questions.length) * 100) : 0;
    const timeSpent = exam.duration * 60 - timeLeft;

    if (participantId) {
      const { error } = await supabase.from('test_results').insert([{
          test_id: examId,
          participant_id: participantId, 
          score,
          total_questions: exam.questions.length,
          percentage,
          time_spent: timeSpent,
          answers: answers,
          test_title: exam.title,
          submitted_at: new Date().toISOString()
      }]);
      if (error) {
        toast({ title: "خطأ", description: `فشل في حفظ نتيجة الاختبار: ${error.message}`, variant: "destructive" });
      }
    }
    
    setCurrentStep('completed');
    toast({ title: "تم إنهاء الاختبار! 🎉", description: `نتيجتك: ${score}/${exam.questions.length} (${percentage}%)` });
  };

  if (loading || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-white"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div><p>جاري تحميل الجلسة...</p></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-4 flex flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {currentStep === 'registration' && (<RegistrationStep key="registration" exam={exam} onSubmit={handleRegistrationSubmit} />)}
        {currentStep === 'exam' && exam.questions && exam.questions.length > 0 && (<ExamStep key="exam" exam={exam} studentInfo={studentInfo} timeLeft={timeLeft} answers={answers} setAnswers={setAnswers} onSubmit={submitExam} />)}
        {currentStep === 'exam' && (!exam.questions || exam.questions.length === 0) && (
           <motion.div key="no-questions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-2xl w-full mx-auto text-center">
            <Card className="p-8 bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700 backdrop-blur-sm">
              <h2 className="text-2xl font-bold text-white mb-4">لا توجد أسئلة</h2>
              <p className="text-gray-300 mb-6">هذا الاختبار لا يحتوي على أسئلة حالياً. يرجى مراجعة منشئ الاختبار.</p>
              <Button onClick={() => navigate('/dashboard')} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">العودة للوحة التحكم</Button>
            </Card>
           </motion.div>
        )}
        {currentStep === 'completed' && (<CompletionStep key="completed" studentInfo={studentInfo} />)}
      </AnimatePresence>
    </div>
  );
};

export default ExamSession;
