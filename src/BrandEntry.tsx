import React, { useState } from 'react';
import { db } from './firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import toast from 'react-hot-toast';
// import { config } from './config/environment';
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

const BrandEntry: React.FC = () => {
    const [formData, setFormData] = useState<FormData>({
        brandName: '',
        name: '',
        email: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const navigate = useNavigate();

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    };

    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};
        let uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2);

        // If name is blank, create a unique guest name.
        if (!formData.name.trim()) {
            formData.name = `Guest_${uniqueId}`;
        }

        // If brandName is blank, derive it from the (potentially new) name.
        if (!formData.brandName.trim()) {
            const firstname = formData.name.trim().split(' ')[0];
            formData.brandName = `${firstname}'s Brand Name`;
        }

        // If email is blank, create a unique, non-functional email address.
        if (!formData.email.trim()) {
            formData.email = `user+${uniqueId}@example.com`;
        } else if (!validateEmail(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // const sendToGoHighLevel = async (contactData: FormData): Promise<boolean> => {
    //     try {
    //         const response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
    //             method: 'POST',
    //             headers: {
    //                 'Authorization': `Bearer ${config.gohighlevel.apiKey}`,
    //                 'Content-Type': 'application/json'
    //             },
    //             body: JSON.stringify({
    //                 email: contactData.email,
    //                 // phone: contactData.phone,
    //                 firstName: contactData.name.split(' ')[0],
    //                 lastName: contactData.name.split(' ').slice(1).join(' '),
    //                 name: contactData.name,
    //                 tags: ['Aurum Agent Mini'],
    //             })
    //         });

    //         if (!response.ok) {
    //             throw new Error('Failed to send contact data to GoHighLevel');
    //         }

    //         return true;
    //     } catch (error) {
    //         console.error('Error sending to GoHighLevel:', error);
    //         return false;
    //     }
    // };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (!validateForm()) {
                setIsLoading(false);
                return;
            }

            // Send to GoHighLevel first
            // const ghlSuccess = await sendToGoHighLevel(formData);
            // if (!ghlSuccess) {
            //     throw new Error('Failed to send contact data');
            // }

            // Create interview document in Firestore
            const interviewsCollection = collection(db, 'interviews');
            const newInterviewRef = doc(interviewsCollection);
            
            const interviewData = {
                brandName: formData.brandName.trim(),
                threadId: null,
                createdAt: new Date(),
                lastUpdated: new Date(),
                currentPhase: 'discovery',
                messages: [],
                reports: {},
                contactInfo: {
                    name: formData.name.trim(),
                    email: formData.email.trim()
                }
            };

            await setDoc(newInterviewRef, interviewData);

            // Store interview ID and brand name in sessionStorage
            sessionStorage.setItem('interviewId', newInterviewRef.id);
            sessionStorage.setItem('brandName', formData.brandName.trim());

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
                    />
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
                        placeholder="Your Name* (Feel free to leave blank or use any name)"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                    />
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
                        placeholder="Email Address* (Leave blank or use any email)"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                    />
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