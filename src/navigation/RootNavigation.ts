import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}

export function canGoBack() {
  return navigationRef.isReady() ? navigationRef.canGoBack() : false;
}

export function getState() {
  return navigationRef.isReady() ? navigationRef.getState() : null;
}
