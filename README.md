# Farmlink

<div align="center">
  <h2>🌱 Connecting Farmers Directly with Consumers & Businesses 🌱</h2>
  
  <p>
    <em>Revolutionising agriculture in Mauritius through digital innovation</em>
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#api-documentation">API Docs</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native"/>
    <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI"/>
    <img src="https://img.shields.io/badge/Expo-1C1E24?style=for-the-badge&logo=expo&logoColor=#D04A37" alt="Expo"/>
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
  </p>
</div>

---

## About Farmlink

Farmlink is a comprehensive mobile application that bridges the gap between Mauritian farmers and their customers - whether individual households or businesses like restaurants and hotels. By eliminating traditional market inefficiencies, Farmlink empowers farmers with direct market access whilst providing consumers with fresh, local produce at competitive prices.

### Problem Statement

- **Inefficient Distribution**: Traditional markets only operate on specific days (Mondays & Thursdays)
- **High Waste**: Farmers struggle with unsold produce and post-harvest losses  
- **Limited Access**: Consumers rely on intermediaries, increasing costs and reducing freshness
- **Economic Barriers**: Small-scale farmers lack direct market access and fair pricing

### Solution

A comprehensive digital platform that connects all stakeholders in the agricultural supply chain through direct trading, AI-powered recommendations, inclusive design with voice commands and multilingual support, and real-time inventory management.

---

## Features

### Multi-User Platform
- **Farmers**: Product listing, inventory management, order tracking, sales analytics
- **Individual Consumers**: Browse products, AI recipe suggestions, voice ordering
- **Businesses**: Bulk ordering, supplier management, procurement optimization

### AI-Powered Intelligence
- **Recipe Recommendations**: Rule-based engine suggesting recipes based on available produce
- **Smart Suggestions**: Scikit-learn powered "Suggested for You" feature
- **Demand Forecasting**: Predictive analytics for optimal farming decisions

### Accessibility
- **Voice Commands**: Hands-free ordering using Google Speech API
- **Multilingual Support**: English and French UI support
- **Inclusive Design**: Following WCAG guidelines for accessibility

### Secure Transactions
- **Stripe Integration**: Secure payment processing (test mode)
- **Order Management**: Real-time order tracking and notifications
- **Advanced Security**: Comprehensive fraud protection measures

---

## Tech Stack

### Frontend
- **React Native** - Cross-platform mobile development
- **Expo Router** - File-based navigation system
- **Expo** - Development platform and toolkit
- **NativeWind** - Tailwind CSS for React Native
- **React Native Voice** - Voice command functionality
- **Stripe React Native** - Payment processing
- **Axios** - HTTP client for API requests
- **React Native Reanimated** - Advanced animations
- **Lottie React Native** - Vector animations

### Backend
- **FastAPI** - High-performance API framework
- **SQLite** - Database
- **SQLAlchemy** - Database ORM
- **Pydantic** - Data validation and serialization
- **Stripe** - Payment processing
- **Uvicorn** - ASGI server
- **Passlib** - Password hashing
- **Python-Jose** - JWT token handling

### AI & ML
- **Scikit-learn** - Machine learning algorithms
- **Pandas** - Data manipulation and analysis

### Tools
- **GitHub** - Version control and collaboration
- **Render** - Cloud hosting

---

## Quick Start

### Prerequisites

- **Node.js** (v24 or higher)
- **Python** (v3.13.5 or higher)
- **Expo CLI** (`npm install -g @expo/cli`)
- **iOS Simulator** (for iOS development)
- **Android Emulator** (for Android development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/efahiim/farmlink.git
   cd farmlink
   ```

2. **Set up the Backend**
   ```bash
   cd backend
   
   # Create virtual environment
   python -m venv venv
   # If the above doesn't work, try:
   # python3 -m venv venv
   
   # Activate virtual environment
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # (Optional) Populate database with test data
   python seed_data.py
   
   # Set up environment variables (optional - defaults are provided)
   cp .env.example .env
   ```

3. **Set up the Frontend**
   ```bash
   cd ../frontend
   
   # Install dependencies
   npm install
   
   # Set up environment variables (optional - defaults are provided)
   cp .env.example .env
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   
   # Activate virtual environment if not already active
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # (Optional) Seed database with test users and products
   python seed_data.py
   
   # Run the FastAPI server
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   
   Backend will be available at: `http://localhost:8000`
   
   **Test Users** (if seeded):
   - **Individual**: user@test.com (password: testing)
   - **Business**: biz@test.com (password: testing)  
   - **Farmer**: farm@test.com (password: testing)

2. **Start the Frontend App**
   ```bash
   cd frontend
   
   # Start Expo development server
   npx expo start
   ```
   
   Follow the Expo CLI instructions to run on:
   - **Physical device**: Scan QR code with Expo Go app
   - **iOS Simulator**: Press `i` in terminal
   - **Android Emulator**: Press `a` in terminal

### Environment Variables

Both frontend and backend have `.env.example` files with all required variables. **Default values are already configured**, so the app will work out of the box without any environment setup.

**Frontend (.env.example):**
```bash
API_BASE_URL=
STRIPE_PUBLISHABLE_KEY=
MERCHANT_IDENTIFIER=
EXPO_PROJECT_ID=
```

**Backend (.env.example):**
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=

# Platform Configuration
# 10% commission for Farmlink
PLATFORM_FEE_PERCENTAGE=2.5
DELIVERY_FEE=75.0

# Force Seed DB When Deploying
FORCE_SEED=
```

---

## API Documentation

Once the backend is running, access the interactive API documentation:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

## Project Structure

```
farmlink/
├── frontend/                   # React Native Expo app
│   ├── app/                    # Expo Router pages
│   ├── assets/                 # Static assets
│   ├── components/             # Reusable components
│   ├── constants/              # App constants
│   ├── context/                # React context providers
│   ├── services/               # API services
│   ├── types/                  # TypeScript type definitions
│   ├── utils/                  # Utility functions
│   ├── .env.example            # Environment variables template
│   ├── app.config.js           # Expo configuration
│   ├── tailwind.config.js      # Tailwind configuration
│   └── package.json            # Dependencies and scripts
├── backend/                    # FastAPI server
│   ├── core/                   # Core configuration
│   ├── models/                 # Database models
│   ├── routes/                 # API routes
│   ├── schemas/                # Pydantic schemas
│   ├── services/               # Business logic
│   ├── main.py                 # FastAPI app entry point
│   ├── seed_data.py            # Database seeding
│   └── .env.example            # Environment variables template
└── .gitignore                  # Git ignore rules
```

---

## Deployment

### Backend Deployment (Render)
Connect your GitHub repository to Render for automatic deployment.

### Frontend Deployment
```bash
cd frontend

# Android (free)
npx expo build:android

# iOS (requires paid Apple Developer account)
npx expo build:ios
```

**Note**: iOS deployment requires a paid Apple Developer account, whilst Android deployment is free.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

<div align="center">
  <p>
    <strong>IMFE Studio</strong><br>
    © 2025 All rights reserved
  </p>
</div>