import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  LoginScreen,
  HomeScreen,
  PaymentsScreen,
  ProfileScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  ManualAssociationScreen,
  SettingsScreen,
  DwellingDetailsScreen,
  PersonalInfoScreen,
  SupportScreen,
  CondoDashboardScreen,
  NotificationsScreen,
  ExpenseDetailScreen,
  MyServicesScreen,
  useAuth,
} from '../index';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return null;
    }

    return (
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#ffffff' }
                }}
            >
                {user ? (
                    <>
                        <Stack.Screen name="Main" component={HomeScreen} />
                        <Stack.Screen name="Payments" component={PaymentsScreen} />
                        <Stack.Screen name="Profile" component={ProfileScreen} />
                        <Stack.Screen name="ManualAssociation" component={ManualAssociationScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                        <Stack.Screen name="DwellingDetails" component={DwellingDetailsScreen} />
                        <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
                        <Stack.Screen name="Support" component={SupportScreen} />
                        <Stack.Screen name="CondoDashboard" component={CondoDashboardScreen} />
                        <Stack.Screen name="Notifications" component={NotificationsScreen} />
                        <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
                        <Stack.Screen name="MyServices" component={MyServicesScreen} />
                    </>
                ) : (
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Register" component={RegisterScreen} />
                        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                    </>
                )}
            </Stack.Navigator>
    );
};
