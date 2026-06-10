import Toast from 'react-native-toast-message';

const DEFAULT_MS = 3800;

export function showError(message: string, title = 'Something went wrong') {
  Toast.show({
    type: 'error',
    text1: title,
    text2: message,
    visibilityTime: DEFAULT_MS,
  });
}

export function showInfo(message: string, title = 'Notice') {
  Toast.show({
    type: 'info',
    text1: title,
    text2: message,
    visibilityTime: DEFAULT_MS,
  });
}

export function showSuccess(message: string, title?: string) {
  Toast.show({
    type: 'success',
    text1: title ?? message,
    text2: title ? message : undefined,
    visibilityTime: DEFAULT_MS,
  });
}

/** Show a mascot-celebrate toast for milestone moments (section complete, etc). */
export function showMascotSuccess(title: string, message?: string) {
  Toast.show({
    type: 'mascot_success',
    text1: title,
    text2: message,
    visibilityTime: 2800,
  });
}
