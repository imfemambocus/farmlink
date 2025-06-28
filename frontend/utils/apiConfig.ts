import Constants from 'expo-constants';

const {
    API_ENV,
    API_BASE_URL_LOCAL,
    API_BASE_URL_REMOTE,
} = Constants.expoConfig?.extra || {};

let API_BASE_URL = API_BASE_URL_REMOTE;

if (API_ENV === 'local') {
    API_BASE_URL = API_BASE_URL_LOCAL
} else if (API_ENV === 'remote') {
    API_BASE_URL = API_BASE_URL_REMOTE;
}

export { API_BASE_URL };
