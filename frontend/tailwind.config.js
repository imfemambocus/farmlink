/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            fontFamily: {
                'sans': ['Poppins-Regular'],
                'medium': ['Poppins-Medium'],
                'semibold': ['Poppins-SemiBold'],
                'bold': ['Poppins-Bold'],
            },
            colors: {
                primary: '#4CAF50',
                secondary: '#66BB6A',
                background: '#EAF3D0',
                surface: '#FFFFFF',
                light: {
                    100: '#F1F8E9',
                    200: '#DCEDC8',
                    300: '#C5E1A5',
                    400: '#AED581',
                },
                dark: {
                    100: '#66BB6A',
                    200: '#4CAF50',
                    300: '#388E3C',
                },
                accent: '#8BC34A',
                success: '#4CAF50',
                warning: '#FF9800',
                error: '#F44336',
                text: {
                    primary: '#2E7D32',
                    secondary: '#4CAF50',
                    muted: '#757575',
                    light: '#FFFFFF',
                }
            }
        },
    },
    plugins: [],
}
