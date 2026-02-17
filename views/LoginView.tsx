
import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Coffee, User, Lock, ArrowRight, ArrowLeft, Loader2, 
  AlertCircle, Languages, Moon, Sun, Mail, CheckCircle2, 
  ShieldCheck, Eye, EyeOff
} from 'lucide-react';
import { useLanguage, useTheme } from '../App';
import { useAuth } from '../contexts/AuthContext';

interface LoginViewProps {
  onLogin: (role: string) => void;
}

type LoginFormValues = {
  identifier: string;
  password: string;
  rememberMe: boolean;
};

type ForgotPasswordFormValues = {
  email: string;
};

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const { lang, setLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { login, forgotPassword } = useAuth();
  const loginSchema = useMemo(() => z.object({
    identifier: z.string().min(3, { message: t.usernameRequired }),
    password: z.string().min(8, { message: t.passwordMinLength }),
    rememberMe: z.boolean().default(false),
  }), [t]);
  const forgotPasswordSchema = useMemo(() => z.object({
    email: z.string().email({ message: t.invalidEmail }),
  }), [t]);
  
  const [viewMode, setViewMode] = useState<'login' | 'forgotPassword'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isResetSent, setIsResetSent] = useState(false);
  const [lastResetEmail, setLastResetEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '', rememberMe: false }
  });

  const {
    register: registerForgot,
    handleSubmit: handleSubmitForgot,
    formState: { errors: forgotErrors, isSubmitting: isSubmittingForgot },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const getLoginErrorMessage = (message?: string) => {
    if (!message) return t.invalidLogin;
    const normalized = message.toLowerCase();
    if (normalized.includes('email not confirmed')) return t.emailNotConfirmed;
    if (normalized.includes('invalid login credentials')) return t.invalidLogin;
    return message;
  };

  const onLoginSubmit = async (values: LoginFormValues) => {
    setApiError('');
    try {
      await login(values);
      onLogin('redirecting'); 
    } catch (err: any) {
      setApiError(getLoginErrorMessage(err?.message || err?.error_description));
    }
  };

  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  const renderResetSent = () => (
    <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-center">
        <div className="bg-orange-600 text-white p-4 rounded-full border-2 border-orange-600">
          <CheckCircle2 size={48} />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-black ">{t.resetLinkSent}</h3>
        <p className="text-black  text-sm">
          {t.resetLinkSentTo.replace('{email}', lastResetEmail)}
        </p>
      </div>
      <button 
        onClick={() => { setViewMode('login'); setIsResetSent(false); }}
        className="text-black  font-bold hover:underline flex items-center gap-2 justify-center w-full"
      >
        {t.backToLogin}
      </button>
    </div>
  );

  const renderForgotPassword = () => (
    <div className="animate-in slide-in-from-bottom-4 duration-300">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-black  mb-2">{t.resetPasswordTitle}</h2>
        <p className="text-black  text-sm">{t.resetPasswordDesc}</p>
      </div>
      <form onSubmit={handleSubmitForgot(async (v) => {
        try {
          await forgotPassword(v.email);
          setLastResetEmail(v.email);
          setIsResetSent(true);
        } catch (e: any) { setApiError(e.message); }
      })} className="space-y-6">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-black  block">{t.emailAddress}</label>
          <div className="relative">
            <Mail className={`absolute ${t.dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-black`} size={20} />
            <input {...registerForgot('email')} type="email" className={`w-full bg-white  border ${forgotErrors.email ? 'border-orange-600' : 'border-orange-100 '} rounded-2xl ${t.dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 outline-none focus:ring-2 focus:ring-orange-600 transition-all`} />
          </div>
        </div>
        <button type="submit" disabled={isSubmittingForgot} className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-3 border-2 border-orange-600 hover">
          {isSubmittingForgot ? <Loader2 className="animate-spin" size={24} /> : t.sendResetLink}
        </button>
        <button type="button" onClick={() => { setViewMode('login'); setApiError(''); }} className="w-full text-black text-sm font-bold  transition-colors">{t.backToLogin}</button>
      </form>
    </div>
  );

  return (
    <div className={`min-h-screen flex items-center justify-center bg-white p-4 transition-colors duration-300 ${lang === 'ar' ? 'font-arabic' : 'font-sans'}`} dir={t.dir}>
      <div className="fixed top-6 left-6 right-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="bg-orange-600 p-2 rounded-xl text-white shadow-lg border-2 border-orange-600"><Coffee size={24} /></div>
          <span className="font-bold text-xl text-black ">{t.appName}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleLang} className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-white  border border-orange-100  rounded-full shadow-sm  transition-colors"><Languages size={16} />{lang === 'ar' ? t.languageEnglish : t.languageArabic}</button>
        </div>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white  rounded-[32px] shadow-2xl border border-orange-100  p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-orange-600" />
          
          {isResetSent ? renderResetSent() : (
            viewMode === 'forgotPassword' ? renderForgotPassword() : (
              <>
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-white  rounded-2xl flex items-center justify-center text-orange-600  mx-auto mb-4 border-2 border-orange-600 "><Coffee size={40} /></div>
                    <h2 className="text-3xl font-bold text-black  mb-2">{t.welcomeBack}</h2>
                    <p className="text-black  text-sm">{t.loginToManage}</p>
                  </div>

                  <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-5">
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-black  block">{t.usernameOrEmail}</label>
                      <div className="relative">
                        <User className={`absolute ${t.dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-black`} size={20} />
                        <input {...register('identifier')} type="text" className={`w-full bg-white  border ${errors.identifier ? 'border-orange-600' : 'border-orange-100 '} rounded-2xl ${t.dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 outline-none focus:ring-2 focus:ring-orange-600 transition-all`} placeholder="admin" />
                      </div>
                      {errors.identifier && <p className="text-xs text-black font-bold mt-1">{errors.identifier.message}</p>}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-semibold text-black  block">{t.password}</label>
                        <button type="button" onClick={() => setViewMode('forgotPassword')} className="text-xs font-bold text-black  hover:underline">{t.forgotPassword}</button>
                      </div>
                      <div className="relative">
                        <Lock className={`absolute ${t.dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-black`} size={20} />
                        <input {...register('password')} type={showPassword ? 'text' : 'password'} className={`w-full bg-white  border ${errors.password ? 'border-orange-600' : 'border-orange-100 '} rounded-2xl ${t.dir === 'rtl' ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-3.5 outline-none focus:ring-2 focus:ring-orange-600 transition-all`} placeholder="••••••••" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute ${t.dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-black`}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                      </div>
                      {errors.password && <p className="text-xs text-black font-bold mt-1">{errors.password.message}</p>}
                    </div>

                    {apiError && (
                      <div className="bg-white  border-2 border-orange-600  p-4 rounded-xl flex items-center gap-3 animate-in shake duration-500">
                        <AlertCircle className="text-orange-600  shrink-0" size={18} />
                        <span className="text-xs font-bold text-black ">{apiError}</span>
                      </div>
                    )}

                    <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl  transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 border-2 border-orange-600">
                      {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <>{t.login} {t.dir === 'rtl' ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}</>}
                    </button>

                  </form>

                  <div className="mt-8 pt-6 border-t border-orange-50  text-center">
                    <div className="flex justify-center items-center gap-2 text-black text-xs italic">
                      <ShieldCheck size={14} /> {t.secureSystem}
                    </div>
                  </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginView;
