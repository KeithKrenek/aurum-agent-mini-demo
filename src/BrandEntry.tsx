import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, setDoc, collection, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import blackLogo from './assets/black-logo2.png';

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

// Generate shorter, more readable unique IDs
const generateShortId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const BrandEntry: React.FC = () => {
    const [formData, setFormData] = useState<FormData>({
        brandName: '',
        name: '',
        email: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [previewDefaults, setPreviewDefaults] = useState<{
        name?: string;
        brandName?: string;
        email?: string;
    }>({});
    const navigate = useNavigate();

    // Generate preview of default values
    useEffect(() => {
        const uniqueId = generateShortId();
        const defaults: {
            name?: string;
            brandName?: string;
            email?: string;
        } = {};

        if (!formData.name.trim()) {
            defaults.name = `Guest_${uniqueId}`;
        }
        if (!formData.brandName.trim()) {
            const firstname = formData.name.trim() || defaults.name || `Guest_${uniqueId}`;
            defaults.brandName = `${firstname.split(' ')[0]}'s Brand`;
        }
        if (!formData.email.trim()) {
            defaults.email = `user+${uniqueId.toLowerCase()}@example.com`;
        }

        setPreviewDefaults(defaults);
    }, [formData]);

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    };

    const sanitizeInput = (input: string): string => {
        return input.trim().replace(/[<>]/g, ''); // Basic XSS prevention
    };

    const validateForm = (): { isValid: boolean; sanitizedData: FormData } => {
        const newErrors: ValidationErrors = {};
        const uniqueId = generateShortId();

        // Create safe defaults with shorter IDs
        let sanitizedData = {
            name: sanitizeInput(formData.name),
            brandName: sanitizeInput(formData.brandName),
            email: sanitizeInput(formData.email)
        };

        // If name is blank, create a shorter unique guest name
        if (!sanitizedData.name) {
            sanitizedData.name = `Guest_${uniqueId}`;
        }

        // If brandName is blank, derive it from the name
        if (!sanitizedData.brandName) {
            const firstname = sanitizedData.name.split(' ')[0];
            sanitizedData.brandName = `${firstname}'s Brand`;
        }

        // If email is blank, create a unique, non-functional email address
        if (!sanitizedData.email) {
            sanitizedData.email = `user+${uniqueId.toLowerCase()}@example.com`;
        } else if (!validateEmail(sanitizedData.email)) {
            newErrors.email = 'Please enter a valid email address';
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

        try {
            const validation = validateForm();
            if (!validation.isValid) {
                setIsLoading(false);
                return;
            }

            // Use the sanitized data directly instead of formData state
            const { sanitizedData } = validation;

            // Create interview document in Firestore with enhanced error handling
            const interviewsCollection = collection(db, 'interviews');
            const newInterviewRef = doc(interviewsCollection);
            
            const interviewData = {
                brandName: sanitizedData.brandName.trim(),
                threadId: null,
                createdAt: new Date(),
                lastUpdated: new Date(),
                currentPhase: 'discovery',
                questionCount: 0, // Start at 0 - will increment when user answers questions
                messages: [],
                reports: {},
                contactInfo: {
                    name: sanitizedData.name.trim(),
                    email: sanitizedData.email.trim()
                }
            };

            console.log('Creating interview document with data:', interviewData); // Debug log
            await setDoc(newInterviewRef, interviewData);

            // Verify the document was created successfully
            const verifyDoc = await getDoc(newInterviewRef);
            if (!verifyDoc.exists()) {
                throw new Error('Failed to create interview document');
            }
            
            console.log('Interview document created successfully:', verifyDoc.data()); // Debug log

            // Store interview ID and brand name in sessionStorage
            sessionStorage.setItem('interviewId', newInterviewRef.id);
            sessionStorage.setItem('brandName', sanitizedData.brandName.trim());

            // Add a small delay to ensure Firestore consistency
            await new Promise(resolve => setTimeout(resolve, 500));

            // Navigate to chat
            navigate(`/chat/${newInterviewRef.id}`);

        } catch (error) {
            console.error('Error during submission:', error);
            toast.error('An error occurred. Please try again.');
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
        // Clear error when user starts typing
        if (errors[name as keyof ValidationErrors]) {
            setErrors(prev => ({
                ...prev,
                [name]: undefined
            }));
        }
    };

    return (
        <div>
            <img src={blackLogo} alt="Aurum Agent Mini Demo" className="max-w-md mx-auto mt-2 p-4 bg-white w-auto object-contain" />
            <div className="max-w-md mx-auto mt-6 p-4 bg-white rounded-lg shadow-lg">            
                <h1 className="text-3xl font-normal mb-6 text-center text-black">
                    The Aurum Agent Mini Demo
                </h1>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Demo info section */}
                    <div className="bg-gradient-to-r from-desert-sand/10 to-champagne/10 border border-desert-sand/30 rounded-lg p-3 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs bg-goldenrod text-white px-2 py-1 rounded-full font-medium">
                                Demo Mode
                            </span>
                            <span className="text-sm text-dark-gray font-medium">Leave fields blank for automatic demo values</span>
                        </div>
                        <p className="text-xs text-neutral-gray">
                            Empty fields will be automatically filled with demo-friendly values for testing the brand development process.
                        </p>
                    </div>
                    
                    <div>
                        <input
                            className={`shadow appearance-none border rounded w-full py-2 px-3 text-dark-gray leading-tight focus:outline-none focus:ring-2 focus:ring-dark-gray ${
                                errors.brandName ? 'border-red-500' : ''
                            }`}
                            type="text"
                            placeholder="Brand Name (Leave blank for demo)"
                            name="brandName"
                            value={formData.brandName}
                            onChange={handleInputChange}
                            maxLength={100} // Prevent extremely long brand names
                        />
                        {previewDefaults.brandName && !formData.brandName.trim() && (
                            <p className="text-xs text-neutral-gray mt-1">
                                Demo value: <span className="font-medium text-goldenrod">{previewDefaults.brandName}</span>
                            </p>
                        )}
                        {errors.brandName && (
                            <p className="text-red-500 text-sm mt-1">{errors.brandName}</p>
                        )}
                    </div>    

                    <div>
                        <input
                            className={`shadow appearance-none border rounded w-full py-2 px-3 text-dark-gray leading-tight focus:outline-none focus:ring-2 focus:ring-dark-gray ${
                                errors.name ? 'border-red-500' : ''
                            }`}
                            type="text"
                            placeholder="Your Name (Leave blank for demo)"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            maxLength={100}
                        />
                        {previewDefaults.name && !formData.name.trim() && (
                            <p className="text-xs text-neutral-gray mt-1">
                                Demo value: <span className="font-medium text-goldenrod">{previewDefaults.name}</span>
                            </p>
                        )}
                        {errors.name && (
                            <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                        )}
                    </div>

                    <div>
                        <input
                            className={`shadow appearance-none border rounded w-full py-2 px-3 text-dark-gray leading-tight focus:outline-none focus:ring-2 focus:ring-dark-gray ${
                                errors.email ? 'border-red-500' : ''
                            }`}
                            type="email"
                            placeholder="Email Address (Leave blank for demo)"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            maxLength={200}
                        />
                        {previewDefaults.email && !formData.email.trim() && (
                            <p className="text-xs text-neutral-gray mt-1">
                                Demo value: <span className="font-medium text-goldenrod">{previewDefaults.email}</span>
                            </p>
                        )}
                        {errors.email && (
                            <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                        )}
                    </div>

                    <button
                        className="w-full bg-black hover:bg-dark-gray text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300 disabled:opacity-50"
                        type="submit"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center">
                                <Loader className="animate-spin -ml-1 mr-2 h-5 w-5" />
                                Processing...
                            </span>
                        ) : (
                            'Get Your Brand Alchemy Spark'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BrandEntry;