import React, { useState } from 'react';
import { UserPlus, LoaderCircle } from 'lucide-react';
import { userLogService } from '../../services/userLogService';

interface RegisterFormProps {
    onRegister: (email: string, password: string) => Promise<any>;
    onSwitchToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onRegister, onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError('Kata sandi tidak cocok.');
            return;
        }
        if(password.length < 6) {
            setError('Kata sandi minimal harus 6 karakter.');
            return;
        }

        setIsLoading(true);
        try {
            await onRegister(email, password);
            // Catat ke log pendaftar akun baru
            userLogService.recordRegistration(email, 'Berhasil Terdaftar');
            setSuccess('Registrasi berhasil! Silakan login.');
            // Optionally clear form
            setEmail('');
            setPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            userLogService.recordRegistration(email, 'Gagal Registrasi');
            setError(err.message || 'Terjadi kesalahan saat registrasi.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-center text-white">Buat Akun Baru</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="text-sm text-center text-red-400 bg-red-500/10 p-2 rounded-md">{error}</p>}
                {success && <p className="text-sm text-center text-green-400 bg-green-500/10 p-2 rounded-md">{success}</p>}
                <div>
                    <label htmlFor="email-register" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <input 
                        id="email-register"
                        type="email" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="anda@email.com"
                        required 
                    />
                </div>
                <div>
                    <label htmlFor="password-register" className="block text-sm font-medium text-gray-300 mb-1">Kata Sandi</label>
                    <input 
                        id="password-register"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Minimal 6 karakter"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-1">Konfirmasi Kata Sandi</label>
                    <input 
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Ulangi kata sandi"
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isLoading ? <LoaderCircle className="animate-spin" size={20} /> : <UserPlus size={20} />}
                    <span>{isLoading ? 'Mendaftar...' : 'Daftar'}</span>
                </button>
            </form>
             <p className="text-center text-sm text-gray-400">
                Sudah punya akun?{' '}
                <button onClick={onSwitchToLogin} className="font-medium text-teal-400 hover:text-teal-300">
                    Login di sini
                </button>
            </p>
        </div>
    );
};

export default RegisterForm;