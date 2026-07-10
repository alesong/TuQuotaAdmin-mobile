import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AlertModal } from '../components/AlertModal';
import type { AlertType, AlertButton } from '../components/AlertModal';

interface AlertOptions {
    title?: string;
    message: string;
    type?: AlertType;
    onClose?: () => void;
    buttons?: AlertButton[];
}

interface AlertContextData {
    showAlert: (options: AlertOptions) => void;
    hideAlert: () => void;
}

const AlertContext = createContext<AlertContextData>({} as AlertContextData);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [alertOptions, setAlertOptions] = useState<AlertOptions>({ message: '' });

    const showAlert = useCallback((options: AlertOptions) => {
        setAlertOptions(options);
        setIsVisible(true);
    }, []);

    const hideAlert = useCallback(() => {
        setIsVisible(false);
        if (alertOptions.onClose) {
            alertOptions.onClose();
        }
    }, [alertOptions]);

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            <AlertModal
                isVisible={isVisible}
                title={alertOptions.title}
                message={alertOptions.message}
                type={alertOptions.type || 'info'}
                onClose={hideAlert}
                buttons={alertOptions.buttons}
            />
        </AlertContext.Provider>
    );
};

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};
