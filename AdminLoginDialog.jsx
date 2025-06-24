import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

const AdminLoginDialog = ({ open, onOpenChange }) => {
  const [pin, setPin] = useState('');
  const navigate = useNavigate();

  const handleLogin = () => {
    if (pin === 'lcood2285') {
      sessionStorage.setItem('isAdminAccess', 'true');
      toast({ title: "تم التحقق بنجاح", description: "مرحباً أيها المسؤول!" });
      navigate('/admin');
      onOpenChange(false);
    } else {
      toast({ title: "خطأ في التحقق", description: "الرمز السري غير صحيح.", variant: "destructive" });
    }
    setPin('');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>دخول المسؤول</AlertDialogTitle>
          <AlertDialogDescription>
            الرجاء إدخال الرمز السري للوصول إلى قسم إدارة الاختبارات الثابتة.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="pin" className="text-right sr-only">الرمز السري</Label>
          <Input 
            id="pin" 
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="ادخل الرمز السري هنا"
            className="bg-slate-800 border-slate-600 text-white text-center tracking-widest"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={handleLogin} className="bg-yellow-500 hover:bg-yellow-600">
            دخول
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AdminLoginDialog;