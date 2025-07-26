import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from './firebase';
import { doc, setDoc, collection, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Loader, Sparkles, CheckCircle, AlertCircle, Shield, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import blackLogo from './assets/black-logo2.png';
import { validateBrandName, validateUserName, validateEmail, APP_CONFIG } from './types/constants';

interface FormData {
    brandName: string;
    name: string;
    email: string;
}

interface ValidationErrors {
    brandName?: string;
    name?: string;
    email?: string;
}

interface FieldState {
    value: string;
    isValid: boolean;
    isTouched: boolean;
    isValidating: boolean;
    hasChanged: boolean;
}

interface SubmissionState {
    isLoading: boolean;
    attempts: number;
    lastError?: string;
    startTime?: number;
}

// Enhanced ID generation with collision detection
const generateShortId = (): string => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extraRandom = Math.random().toString(36).substring(2, 4);
    return `${timestamp}${randomStr}${extraRandom}`.toUpperCase().substring(0, 10);
};

// Online status hook
const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

// Rate limiting hook
const useRateLimit = (maxAttempts = 5, windowMs = 60000) => {
    const attempts = useRef<number[]>([]);
    
    const canAttempt = useCallback(() => {
        const now = Date.now();
        attempts.current = attempts.current.filter(time => now - time < windowMs);
        return attempts.current.length < maxAttempts;
    }, [maxAttempts, windowMs]);
    
    const recordAttempt = useCallback(() => {
        attempts.current.push(Date.now());
    }, []);
    
    return { canAttempt, recordAttempt, attemptCount: attempts.current.length };
};

const BrandEntry: React.FC = () => {
    const [formData, setFormData] = useState<FormData>({
        brandName: '',
        name: '',
        email: ''
    });
    
    const [fieldStates, setFieldStates] = useState<Record<keyof FormData, FieldState>>({
        brandName: { value: '', isValid: true, isTouched: false, isValidating: false, hasChanged: false },
        name: { value: '', isValid: true, isTouched: false, isValidating: false, hasChanged: false },
        email: { value: '', isValid: true, isTouched: false, isValidating: false, hasChanged: false }
    });
    
    const [submissionState, setSubmissionState] = useState<SubmissionState>({
        isLoading: false,
        attempts: 0
    });
    
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [showValidation, setShowValidation] = useState(false);
    const [isDemoMode, setIsDemoMode] = useState(false);
    
    const navigate = useNavigate();
    const isOnline = useOnlineStatus();
    const { canAttempt, recordAttempt, attemptCount } = useRateLimit();
    const formRef = useRef<HTMLFormElement>(null);
    const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Enhanced demo value generation with better uniqueness
    const demoValues = useMemo(() => {
        const uniqueId = generateShortId();
        const timestamp = Date.now().toString().slice(-4);
        
        return {
            name: `Demo_User_${timestamp}`,
            brandName: `${formData.name.trim() || `Demo_User_${timestamp}`}'s Brand`,
            email: `demo.${uniqueId.toLowerCase()}@example.com`
        };
    }, [formData.name]);

    // Enhanced validation with comprehensive checks
    const validateField = useCallback((fieldName: keyof FormData, value: string) => {
        const result = { isValid: true, error: undefined as string | undefined };
        
        if (!value.trim()) {
            return result; // Empty is valid for demo mode
        }

        try {
            switch (fieldName) {
                case 'brandName':
                    if (!validateBrandName(value)) {
                        result.isValid = false;
                        result.error = value.length > APP_CONFIG.MAX_BRAND_NAME_LENGTH 
                            ? `Brand name too long (max ${APP_CONFIG.MAX_BRAND_NAME_LENGTH} characters)`
                            : 'Brand name contains invalid characters';
                    }
                    break;
                    
                case 'name':
                    if (!validateUserName(value)) {
                        result.isValid = false;
                        result.error = value.length > APP_CONFIG.MAX_USER_NAME_LENGTH 
                            ? `Name too long (max ${APP_CONFIG.MAX_USER_NAME_LENGTH} characters)`
                            : 'Name contains invalid characters';
                    }
                    break;
                    
                case 'email':
                    if (!validateEmail(value)) {
                        result.isValid = false;
                        result.error = 'Please enter a valid email address';
                    }
                    break;
            }
        } catch (error) {
            console.error('Validation error:', error);
            result.isValid = false;
            result.error = 'Validation failed. Please try again.';
        }
        
        return result;
    }, []);

    // Enhanced form validation with better error handling
    const validateForm = useCallback((): { isValid: boolean; sanitizedData: FormData; errors: ValidationErrors } => {
        const newErrors: ValidationErrors = {};
        let sanitizedData: FormData;
        
        try {
            // Sanitize inputs
            sanitizedData = {
                name: formData.name.trim().replace(/[<>]/g, '').substring(0, APP_CONFIG.MAX_USER_NAME_LENGTH),
                brandName: formData.brandName.trim().replace(/[<>]/g, '').substring(0, APP_CONFIG.MAX_BRAND_NAME_LENGTH),
                email: formData.email.trim().replace(/[<>]/g, '').substring(0, APP_CONFIG.MAX_EMAIL_LENGTH)
            };

            // Apply demo values if needed
            if (!sanitizedData.name) {
                sanitizedData.name = demoValues.name;
                setIsDemoMode(true);
            }

            if (!sanitizedData.brandName) {
                sanitizedData.brandName = sanitizedData.name.split('_')[0] + "'s Brand";
                setIsDemoMode(true);
            }

            if (!sanitizedData.email) {
                sanitizedData.email = demoValues.email;
                setIsDemoMode(true);
            }

            // Validate filled fields
            Object.entries(sanitizedData).forEach(([key, value]) => {
                if (value && value !== demoValues[key as keyof typeof demoValues]) {
                    const validation = validateField(key as keyof FormData, value);
                    if (!validation.isValid) {
                        newErrors[key as keyof ValidationErrors] = validation.error;
                    }
                }
            });

        } catch (error) {
            console.error('Form validation error:', error);
            newErrors.brandName = 'Validation failed. Please refresh and try again.';
            sanitizedData = formData;
        }

        return {
            isValid: Object.keys(newErrors).length === 0,
            sanitizedData,
            errors: newErrors
        };
    }, [formData, demoValues, validateField]);

    // Enhanced submission with comprehensive error handling
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Prevent double submission
        if (submissionState.isLoading) return;
        
        // Check rate limiting
        if (!canAttempt()) {
            toast.error(`Too many attempts. Please wait before trying again. (${attemptCount}/5)`);
            return;
        }

        // Check online status
        if (!isOnline) {
            toast.error('No internet connection. Please check your connection and try again.');
            return;
        }

        setSubmissionState(prev => ({
            ...prev,
            isLoading: true,
            startTime: Date.now(),
            lastError: undefined
        }));
        setShowValidation(true);

        try {
            recordAttempt();
            
            // Validate form
            const validation = validateForm();
            if (!validation.isValid) {
                setErrors(validation.errors);
                toast.error('Please fix the errors before continuing');
                return;
            }

            const { sanitizedData } = validation;

            // Generate unique interview data
            const interviewsCollection = collection(db, 'interviews');
            const newInterviewRef = doc(interviewsCollection);
            
            const interviewData = {
                brandName: sanitizedData.brandName,
                threadId: null,
                createdAt: new Date(),
                lastUpdated: new Date(),
                currentPhase: 'discovery' as const,
                questionCount: 0,
                messages: [],
                reports: {},
                contactInfo: {
                    name: sanitizedData.name,
                    email: sanitizedData.email
                },
                metadata: {
                    isDemo: isDemoMode,
                    sessionId: generateShortId(),
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                    formData: sanitizedData,
                    submissionAttempt: submissionState.attempts + 1
                }
            };

            // Enhanced retry mechanism
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    // Create document with timeout
                    const createPromise = setDoc(newInterviewRef, interviewData);
                    const timeoutPromise = new Promise((_, reject) => {
                        submitTimeoutRef.current = setTimeout(() => {
                            reject(new Error('Request timeout'));
                        }, 15000);
                    });
                    
                    await Promise.race([createPromise, timeoutPromise]);
                    
                    if (submitTimeoutRef.current) {
                        clearTimeout(submitTimeoutRef.current);
                    }
                    
                    // Verify document creation
                    const verifyDoc = await getDoc(newInterviewRef);
                    if (!verifyDoc.exists()) {
                        throw new Error('Document creation failed');
                    }
                    
                    const verifiedData = verifyDoc.data();
                    if (!verifiedData.brandName || !verifiedData.contactInfo) {
                        throw new Error('Document data incomplete');
                    }
                    
                    break; // Success
                    
                } catch (error) {
                    retryCount++;
                    console.warn(`Document creation attempt ${retryCount}/${maxRetries} failed:`, error);
                    
                    if (retryCount >= maxRetries) {
                        throw error;
                    }
                    
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
                }
            }

            // Enhanced session storage with verification
            try {
                sessionStorage.setItem('interviewId', newInterviewRef.id);
                sessionStorage.setItem('brandName', sanitizedData.brandName);
                sessionStorage.setItem('sessionMetadata', JSON.stringify({
                    startTime: new Date().toISOString(),
                    isDemo: isDemoMode,
                    sessionId: interviewData.metadata.sessionId,
                    verified: true
                }));

                // Verify session storage
                const storedId = sessionStorage.getItem('interviewId');
                if (storedId !== newInterviewRef.id) {
                    throw new Error('Session storage verification failed');
                }
            } catch (storageError) {
                console.error('Session storage error:', storageError);
                toast.error('Session setup failed. Please try again.');
                return;
            }

            // Success feedback
            toast.success(
                isDemoMode 
                    ? 'Demo session created! Starting your brand journey...'
                    : 'Session created successfully! Starting your brand journey...'
            );
            
            // Navigate with delay for better UX
            await new Promise(resolve => setTimeout(resolve, 1000));
            navigate(`/chat/${newInterviewRef.id}`);

        } catch (error) {
            console.error('Submission error:', error);
            
            // Enhanced error categorization and user feedback
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            let userMessage = 'Failed to create session. Please try again.';
            
            if (errorMessage.includes('network') || errorMessage.includes('offline')) {
                userMessage = 'Network error. Please check your connection and try again.';
            } else if (errorMessage.includes('timeout')) {
                userMessage = 'Request timed out. Please try again.';
            } else if (errorMessage.includes('permission') || errorMessage.includes('auth')) {
                userMessage = 'Access denied. Please refresh the page and try again.';
            } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
                userMessage = 'Service temporarily unavailable. Please try again in a few minutes.';
            }
            
            setSubmissionState(prev => ({
                ...prev,
                attempts: prev.attempts + 1,
                lastError: errorMessage
            }));
            
            toast.error(userMessage);
            
        } finally {
            setSubmissionState(prev => ({ ...prev, isLoading: false }));
            
            if (submitTimeoutRef.current) {
                clearTimeout(submitTimeoutRef.current);
            }
        }
    }, [submissionState.isLoading, canAttempt, attemptCount, isOnline, recordAttempt, validateForm, isDemoMode, navigate, submissionState.attempts]);

    // Enhanced input handling with debouncing
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const fieldName = name as keyof FormData;
        
        // Prevent excessively long input
        const maxLengths = {
            brandName: APP_CONFIG.MAX_BRAND_NAME_LENGTH + 100,
            name: APP_CONFIG.MAX_USER_NAME_LENGTH + 50,
            email: APP_CONFIG.MAX_EMAIL_LENGTH + 50
        };
        
        if (value.length > maxLengths[fieldName]) return;
        
        setFormData(prev => ({ ...prev, [fieldName]: value }));
        
        setFieldStates(prev => ({
            ...prev,
            [fieldName]: {
                ...prev[fieldName],
                value,
                isTouched: true,
                hasChanged: true
            }
        }));
    }, []);

    // Enhanced focus handling
    const handleInputFocus = useCallback((fieldName: keyof FormData) => {
        setFieldStates(prev => ({
            ...prev,
            [fieldName]: {
                ...prev[fieldName],
                isTouched: true
            }
        }));
    }, []);

    // Enhanced field icon logic
    const getFieldIcon = useCallback((fieldName: keyof FormData) => {
        const field = fieldStates[fieldName];
        const hasError = errors[fieldName];
        
        if (!field.isTouched && !field.value) return null;
        
        if (hasError) {
            return <AlertCircle className="w-4 h-4 text-red-500" />;
        }
        
        if (field.isValid && field.value) {
            return <CheckCircle className="w-4 h-4 text-green-500" />;
        }
        
        return null;
    }, [fieldStates, errors]);

    // Real-time validation with debouncing
    useEffect(() => {
        const timer = setTimeout(() => {
            const newErrors: ValidationErrors = {};
            
            Object.entries(formData).forEach(([fieldName, value]) => {
                const field = fieldName as keyof FormData;
                if (fieldStates[field].isTouched && value) {
                    const validation = validateField(field, value);
                    if (!validation.isValid) {
                        newErrors[field] = validation.error;
                    }
                }
            });
            
            setErrors(newErrors);
        }, 300);

        return () => clearTimeout(timer);
    }, [formData, fieldStates, validateField]);

    // Cleanup effect
    useEffect(() => {
        return () => {
            if (submitTimeoutRef.current) {
                clearTimeout(submitTimeoutRef.current);
            }
        };
    }, []);

    // Enhanced form validity check
    const isFormValid = useMemo(() => {
        return Object.keys(errors).length === 0 && 
               !submissionState.isLoading &&
               canAttempt();
    }, [errors, submissionState.isLoading, canAttempt]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-white via-white-smoke to-bone">
            {/* Enhanced header with logo */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center pt-8 pb-6"
            >
                <img 
                    src={blackLogo} 
                    alt="Aurum Agent Mini Demo" 
                    className="max-w-md mx-auto p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg w-auto object-contain"
                />
            </motion.div>

            {/* Enhanced status indicators */}
            <AnimatePresence>
                {!isOnline && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-red-100 text-red-800 rounded-full text-sm font-medium border border-red-200"
                    >
                        <WifiOff className="h-4 w-4" />
                        Offline
                    </motion.div>
                )}
                
                {attemptCount >= 3 && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium border border-yellow-200"
                    >
                        <Shield className="h-4 w-4" />
                        Rate Limited ({attemptCount}/5)
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main form container */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="max-w-lg mx-auto px-4 pb-8"
            >
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/50">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-desert-sand to-champagne p-6 text-center">
                        <h1 className="text-2xl font-bold text-dark-gray mb-2">
                            Brand Alchemy Spark
                        </h1>
                        
                        <p className="text-dark-gray/80 text-sm">
                            Discover your brand's authentic essence in minutes
                        </p>
                    </div>

                    <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Enhanced demo info section */}
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6 }}
                            className="bg-gradient-to-r from-goldenrod/10 to-champagne/10 border border-goldenrod/20 rounded-xl p-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 p-2 bg-goldenrod/20 rounded-full">
                                    <Sparkles className="h-4 w-4 text-goldenrod" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-dark-gray text-sm">
                                        Demo Mode Available
                                    </h4>
                                    <p className="text-xs text-neutral-gray">
                                        Leave fields blank for automatic demo values
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                        
                        {/* Enhanced form fields */}
                        <div className="space-y-4">
                            {/* Brand Name Field */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.7 }}
                            >
                                <label className="block text-sm font-medium text-dark-gray mb-2">
                                    Brand Name
                                </label>
                                <div className="relative">
                                    <input
                                        className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 pr-10 ${
                                            errors.brandName 
                                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                                                : fieldStates.brandName.isValid && fieldStates.brandName.isTouched
                                                ? 'border-green-300 focus:border-green-500 focus:ring-green-200'
                                                : 'border-neutral-gray/30 focus:border-goldenrod focus:ring-goldenrod/20'
                                        } focus:outline-none focus:ring-4`}
                                        type="text"
                                        placeholder="Your Brand Name (Leave blank for demo)"
                                        name="brandName"
                                        value={formData.brandName}
                                        onChange={handleInputChange}
                                        onFocus={() => handleInputFocus('brandName')}
                                        maxLength={APP_CONFIG.MAX_BRAND_NAME_LENGTH + 100}
                                        disabled={submissionState.isLoading}
                                        autoComplete="organization"
                                    />
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        {getFieldIcon('brandName')}
                                    </div>
                                </div>
                                
                                <AnimatePresence>
                                    {!formData.brandName.trim() && !fieldStates.brandName.isTouched && (
                                        <motion.p 
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="text-xs text-goldenrod mt-2 bg-goldenrod/5 px-2 py-1 rounded"
                                        >
                                            Demo value: <span className="font-medium">{demoValues.brandName}</span>
                                        </motion.p>
                                    )}
                                    
                                    {errors.brandName && (
                                        <motion.p 
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-red-500 text-xs mt-2 flex items-center gap-1"
                                        >
                                            <AlertCircle className="w-3 h-3" />
                                            {errors.brandName}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </motion.div>

                            {/* Name Field */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.8 }}
                            >
                                <label className="block text-sm font-medium text-dark-gray mb-2">
                                    Your Name
                                </label>
                                <div className="relative">
                                    <input
                                        className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 pr-10 ${
                                            errors.name 
                                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                                                : fieldStates.name.isValid && fieldStates.name.isTouched
                                                ? 'border-green-300 focus:border-green-500 focus:ring-green-200'
                                                : 'border-neutral-gray/30 focus:border-goldenrod focus:ring-goldenrod/20'
                                        } focus:outline-none focus:ring-4`}
                                        type="text"
                                        placeholder="Your Name (Leave blank for demo)"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        onFocus={() => handleInputFocus('name')}
                                        maxLength={APP_CONFIG.MAX_USER_NAME_LENGTH + 50}
                                        disabled={submissionState.isLoading}
                                        autoComplete="name"
                                    />
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        {getFieldIcon('name')}
                                    </div>
                                </div>
                                
                                <AnimatePresence>
                                    {!formData.name.trim() && !fieldStates.name.isTouched && (
                                        <motion.p 
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="text-xs text-goldenrod mt-2 bg-goldenrod/5 px-2 py-1 rounded"
                                        >
                                            Demo value: <span className="font-medium">{demoValues.name}</span>
                                        </motion.p>
                                    )}
                                    
                                    {errors.name && (
                                        <motion.p 
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-red-500 text-xs mt-2 flex items-center gap-1"
                                        >
                                            <AlertCircle className="w-3 h-3" />
                                            {errors.name}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </motion.div>

                            {/* Email Field */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.9 }}
                            >
                                <label className="block text-sm font-medium text-dark-gray mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <input
                                        className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 pr-10 ${
                                            errors.email 
                                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                                                : fieldStates.email.isValid && fieldStates.email.isTouched
                                                ? 'border-green-300 focus:border-green-500 focus:ring-green-200'
                                                : 'border-neutral-gray/30 focus:border-goldenrod focus:ring-goldenrod/20'
                                        } focus:outline-none focus:ring-4`}
                                        type="email"
                                        placeholder="Email Address (Leave blank for demo)"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        onFocus={() => handleInputFocus('email')}
                                        maxLength={APP_CONFIG.MAX_EMAIL_LENGTH + 50}
                                        disabled={submissionState.isLoading}
                                        autoComplete="email"
                                    />
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        {getFieldIcon('email')}
                                    </div>
                                </div>
                                
                                <AnimatePresence>
                                    {!formData.email.trim() && !fieldStates.email.isTouched && (
                                        <motion.p 
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="text-xs text-goldenrod mt-2 bg-goldenrod/5 px-2 py-1 rounded"
                                        >
                                            Demo value: <span className="font-medium">{demoValues.email}</span>
                                        </motion.p>
                                    )}
                                    
                                    {errors.email && (
                                        <motion.p 
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-red-500 text-xs mt-2 flex items-center gap-1"
                                        >
                                            <AlertCircle className="w-3 h-3" />
                                            {errors.email}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </div>

                        {/* Enhanced submit button */}
                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.0 }}
                            className={`w-full font-bold py-4 px-6 rounded-xl focus:outline-none focus:ring-4 focus:ring-dark-gray/20 transition-all duration-300 transform shadow-lg hover:shadow-xl ${
                                isFormValid && isOnline
                                    ? 'bg-gradient-to-r from-black to-dark-gray hover:from-dark-gray hover:to-black text-white hover:scale-105'
                                    : 'bg-neutral-gray text-white cursor-not-allowed'
                            }`}
                            type="submit"
                            disabled={!isFormValid || !isOnline}
                            whileHover={isFormValid && isOnline ? { scale: 1.02 } : {}}
                            whileTap={isFormValid && isOnline ? { scale: 0.98 } : {}}
                        >
                            <AnimatePresence mode="wait">
                                {submissionState.isLoading ? (
                                    <motion.span 
                                        key="loading"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center justify-center gap-3"
                                    >
                                        <Loader className="animate-spin h-5 w-5" />
                                        Creating Your Brand Journey...
                                    </motion.span>
                                ) : !isOnline ? (
                                    <motion.span
                                        key="offline"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center justify-center gap-3"
                                    >
                                        <WifiOff className="h-5 w-5" />
                                        Connection Required
                                    </motion.span>
                                ) : !canAttempt() ? (
                                    <motion.span
                                        key="rate-limited"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center justify-center gap-3"
                                    >
                                        <Shield className="h-5 w-5" />
                                        Rate Limited - Please Wait
                                    </motion.span>
                                ) : (
                                    <motion.span
                                        key="ready"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center justify-center gap-3"
                                    >
                                        Get Your Brand Alchemy Spark
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </motion.button>

                        {/* Enhanced status text */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.1 }}
                            className="text-center space-y-2"
                        >
                            <p className="text-xs text-neutral-gray">
                                Personal info not required for this 5-10 min demo
                            </p>
                            
                            {submissionState.attempts > 0 && (
                                <p className="text-xs text-orange-600">
                                    Attempt {submissionState.attempts + 1} • Last error: {submissionState.lastError}
                                </p>
                            )}
                            
                            {isDemoMode && (
                                <p className="text-xs text-goldenrod font-medium">
                                    ✨ Demo mode active - using generated values
                                </p>
                            )}
                        </motion.div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default BrandEntry;