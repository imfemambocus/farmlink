import axios from 'axios';
import Constants from 'expo-constants';

const api = axios.create({
    baseURL: Constants.expoConfig?.extra?.API_BASE_URL
});

export default api;
