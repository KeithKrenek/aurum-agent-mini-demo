import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import { doc, setDoc, collection, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Loader, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
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
}

// Enhanced ID generation with better uniqueness
const generateShortId = (): string => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 6);
    return `${timestamp}${randomStr}`.toUpperCase().substring(0, 8);
};

const BrandEntry: React.FC = () => {
    const [formData, setFormData] = useState<FormData>({
        brandName: '',
        name: '',
        email: ''
    });
    
    const [fieldStates, setFieldStates] = useState({
        brandName: { value: '', isValid: true, isTouched: false, isValidating: false },
        name: { value: '', isValid: true, isTouched: false, isValidating: false },
        email: { value: '', isValid: true, isTouched: false, isValidating: false }
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [previewDefaults, setPreviewDefaults] = useState<{
        name?: string;
        brandName?: string;
        email?: string;
    }>({});
    
    const [showValidation, setShowValidation] = useState(false);
    const [isFormValid, setIsFormValid] = useState(false);
    
    const navigate = useNavigate();

    // Enhanced validation with real-time feedback
    const validateField = useCallback((fieldName: keyof FormData, value: string): { isValid: boolean; error?: string } => {
        if (!value.trim()) {
            return { isValid: true }; // Empty is valid for demo mode
        }

        switch (fieldName) {
            case 'brandName':
                if (!validateBrandName(value)) {
                    return { 
                        isValid: false, 
                        error: value.length > APP_CONFIG.MAX_BRAND_NAME_LENGTH 
                            ? `Brand name too long (max ${APP_CONFIG.MAX_BRAND_NAME_LENGTH} characters)`
                            : 'Brand name contains invalid characters'
                    };
                }
                break;
                
            case 'name':
                if (!validateUserName(value)) {
                    return { 
                        isValid: false, 
                        error: value.length > APP_CONFIG.MAX_USER_NAME_LENGTH 
                            ? `Name too long (max ${APP_CONFIG.MAX_USER_NAME_LENGTH} characters)`
                            : 'Name contains invalid characters'
                    };
                }
                break;
                
            case 'email':
                if (!validateEmail(value)) {
                    return { 
                        isValid: false, 
                        error: 'Please enter a valid email address'
                    };
                }
                break;
        }
        
        return { isValid: true };
    }, []);

    // Generate preview of default values with enhanced logic
    useEffect(() => {
        const uniqueId = generateShortId();
        const defaults: {
            name?: string;
            brandName?: string;
            email?: string;
        } = {};

        if (!formData.name.trim()) {
            defaults.name = `Demo_${uniqueId}`;
        }
        if (!formData.brandName.trim()) {
            const firstname = formData.name.trim() || defaults.name || `Demo_${uniqueId}`;
            const cleanName = firstname.split(' ')[0].replace(/[^a-zA-Z]/g, '');
            defaults.brandName = `${cleanName}'s Brand`;
        }
        if (!formData.email.trim()) {
            defaults.email = `demo.${uniqueId.toLowerCase()}@example.com`;
        }

        setPreviewDefaults(defaults);
    }, [formData]);

    // Real-time validation with debouncing
    useEffect(() => {
        const timer = setTimeout(() => {
            const newFieldStates = { ...fieldStates };
            let hasErrors = false;

            Object.keys(formData).forEach(fieldName => {
                const field = fieldName as keyof FormData;
                const value = formData[field];
                const validation = validateField(field, value);
                
                newFieldStates[field] = {
                    ...newFieldStates[field],
                    value,
                    isValid: validation.isValid
                };

                if (!validation.isValid && fieldStates[field].isTouched) {
                    hasErrors = true;
                    setErrors(prev => ({
                        ...prev,
                        [field]: validation.error
                    }));
                } else {
                    setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors[field];
                        return newErrors;
                    });
                }
            });

            setFieldStates(newFieldStates);
            setIsFormValid(!hasErrors);
        }, 300);

        return () => clearTimeout(timer);
    }, [formData, fieldStates, validateField]);

    const sanitizeInput = (input: string): string => {
        return input.trim().replace(/[<>]/g, ''); // Basic XSS prevention
    };

    const validateForm = (): { isValid: boolean; sanitizedData: FormData } => {
        const newErrors: ValidationErrors = {};
        const uniqueId = generateShortId();

        let sanitizedData = {
            name: sanitizeInput(formData.name),
            brandName: sanitizeInput(formData.brandName),
            email: sanitizeInput(formData.email)
        };

        // Enhanced default generation
        if (!sanitizedData.name) {
            sanitizedData.name = `Demo_${uniqueId}`;
        }

        if (!sanitizedData.brandName) {
            const firstname = sanitizedData.name.split(' ')[0].replace(/[^a-zA-Z]/g, '');
            sanitizedData.brandName = `${firstname}'s Brand`;
        }

        if (!sanitizedData.email) {
            sanitizedData.email = `demo.${uniqueId.toLowerCase()}@example.com`;
        } else {
            const emailValidation = validateField('email', sanitizedData.email);
            if (!emailValidation.isValid) {
                newErrors.email = emailValidation.error;
            }
        }

        setErrors(newErrors);
        return {
            isValid: Object.keys(newErrors).length === 0,
            sanitizedData
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setShowValidation(true);

        try {
            const validation = validateForm();
            if (!validation.isValid) {
                setIsLoading(false);
                toast.error('Please fix the errors before continuing');
                return;
            }

            const { sanitizedData } = validation;

            // Enhanced interview document creation with retry logic
            const interviewsCollection = collection(db, 'interviews');
            const newInterviewRef = doc(interviewsCollection);
            
            const interviewData = {
                brandName: sanitizedData.brandName.trim(),
                threadId: null,
                createdAt: new Date(),
                lastUpdated: new Date(),
                currentPhase: 'discovery',
                questionCount: 0,
                messages: [],
                reports: {},
                contactInfo: {
                    name: sanitizedData.name.trim(),
                    email: sanitizedData.email.trim()
                },
                metadata: {
                    isDemo: !formData.name.trim() || !formData.email.trim() || !formData.brandName.trim(),
                    sessionId: generateShortId(),
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                }
            };

            console.log('Creating enhanced interview document:', interviewData);

            // Retry logic for Firestore operations
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    await setDoc(newInterviewRef, interviewData);
                    
                    // Enhanced verification
                    const verifyDoc = await getDoc(newInterviewRef);
                    if (!verifyDoc.exists()) {
                        throw new Error('Failed to create interview document');
                    }
                    
                    const verifiedData = verifyDoc.data();
                    if (!verifiedData.brandName || !verifiedData.contactInfo) {
                        throw new Error('Interview document incomplete');
                    }
                    
                    console.log('Interview document verified successfully:', verifiedData);
                    break;
                    
                } catch (error) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        throw error;
                    }
                    
                    console.warn(`Retry ${retryCount}/${maxRetries} for document creation`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }

            // Enhanced session storage with metadata
            sessionStorage.setItem('interviewId', newInterviewRef.id);
            sessionStorage.setItem('brandName', sanitizedData.brandName.trim());
            sessionStorage.setItem('sessionMetadata', JSON.stringify({
                startTime: new Date().toISOString(),
                isDemo: interviewData.metadata.isDemo,
                sessionId: interviewData.metadata.sessionId
            }));

            // Success animation delay
            await new Promise(resolve => setTimeout(resolve, 500));

            toast.success('Session created successfully! Starting your brand journey...');
            
            // Navigate with slight delay for better UX
            setTimeout(() => {
                navigate(`/chat/${newInterviewRef.id}`);
            }, 800);

        } catch (error) {
            console.error('Error during submission:', error);
            
            // Enhanced error handling
            if (error instanceof Error) {
                if (error.message.includes('network') || error.message.includes('offline')) {
                    toast.error('Network error. Please check your connection and try again.');
                } else if (error.message.includes('permission') || error.message.includes('auth')) {
                    toast.error('Access denied. Please refresh the page and try again.');
                } else {
                    toast.error('Failed to create session. Please try again.');
                }
            } else {
                toast.error('An unexpected error occurred. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Mark field as touched
        setFieldStates(prev => ({
            ...prev,
            [name]: {
                ...prev[name as keyof typeof prev],
                isTouched: true
            }
        }));
    };

    const handleInputFocus = (fieldName: keyof FormData) => {
        setFieldStates(prev => ({
            ...prev,
            [fieldName]: {
                ...prev[fieldName],
                isTouched: true
            }
        }));
    };

    const getFieldIcon = (fieldName: keyof FormData) => {
        const field = fieldStates[fieldName];
        const hasError = errors[fieldName];
        
        if (!field.isTouched && !field.value) {
            return null;
        }
        
        if (hasError) {
            return <AlertCircle className="w-4 h-4 text-red-500" />;
        }
        
        if (field.isValid && field.value) {
            return <CheckCircle className="w-4 h-4 text-green-500" />;
        }
        
        return null;
    };

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
                        {/* <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                            className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
                        >
                            <Sparkles className="w-8 h-8 text-dark-gray" />
                        </motion.div> */}
                        
                        <h1 className="text-2xl font-bold text-dark-gray mb-2">
                            Brand Alchemy Spark
                        </h1>
                        
                        <p className="text-dark-gray/80 text-sm">
                            Discover your brand's authentic essence in minutes
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Demo info section */}
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
                            
                            {/* <p className="text-xs text-neutral-gray leading-relaxed">
                                This is a portfolio demonstration. Empty fields will be filled with realistic demo values to showcase the brand development process without requiring personal information.
                            </p> */}
                        </motion.div>
                        
                        {/* Form fields */}
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
                                        maxLength={APP_CONFIG.MAX_BRAND_NAME_LENGTH}
                                        disabled={isLoading}
                                    />
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        {getFieldIcon('brandName')}
                                    </div>
                                </div>
                                
                                <AnimatePresence>
                                    {previewDefaults.brandName && !formData.brandName.trim() && (
                                        <motion.p 
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="text-xs text-goldenrod mt-2 bg-goldenrod/5 px-2 py-1 rounded"
                                        >
                                            Demo value: <span className="font-medium">{previewDefaults.brandName}</span>
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
                                        maxLength={APP_CONFIG.MAX_USER_NAME_LENGTH}
                                        disabled={isLoading}
                                    />
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        {getFieldIcon('name')}
                                    </div>
                                </div>
                                
                                <AnimatePresence>
                                    {previewDefaults.name && !formData.name.trim() && (
                                        <motion.p 
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="text-xs text-goldenrod mt-2 bg-goldenrod/5 px-2 py-1 rounded"
                                        >
                                            Demo value: <span className="font-medium">{previewDefaults.name}</span>
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
                                        maxLength={APP_CONFIG.MAX_EMAIL_LENGTH}
                                        disabled={isLoading}
                                    />
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        {getFieldIcon('email')}
                                    </div>
                                </div>
                                
                                <AnimatePresence>
                                    {previewDefaults.email && !formData.email.trim() && (
                                        <motion.p 
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="text-xs text-goldenrod mt-2 bg-goldenrod/5 px-2 py-1 rounded"
                                        >
                                            Demo value: <span className="font-medium">{previewDefaults.email}</span>
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

                        {/* Submit button */}
                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.0 }}
                            className="w-full bg-gradient-to-r from-black to-dark-gray hover:from-dark-gray hover:to-black text-white font-bold py-4 px-6 rounded-xl focus:outline-none focus:ring-4 focus:ring-dark-gray/20 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none shadow-lg hover:shadow-xl"
                            type="submit"
                            disabled={isLoading || (showValidation && Object.keys(errors).length > 0)}
                            whileHover={{ scale: isLoading ? 1 : 1.02 }}
                            whileTap={{ scale: isLoading ? 1 : 0.98 }}
                        >
                            <AnimatePresence mode="wait">
                                {isLoading ? (
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
                                ) : (
                                    <motion.span
                                        key="ready"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center justify-center gap-3"
                                    >
                                        {/* <Sparkles className="h-5 w-5" /> */}
                                        Get Your Brand Alchemy Spark
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </motion.button>

                        {/* Estimated time */}
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.1 }}
                            className="text-xs text-neutral-gray text-center"
                        >
                            Personal info not required for this 5-10 min demo
                        </motion.p>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default BrandEntry;