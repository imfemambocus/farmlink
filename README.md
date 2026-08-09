<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/banner-dark.png">
  <source media="(prefers-color-scheme: light)" srcset=".github/banner-light.png">
  <img src=".github/banner-dark.png" alt="Farmlink: Mauritian farmers and the people who buy from them, with nobody in between." width="100%">
</picture>

## About

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
- **Voice Commands**: Hands-free ordering using native speech recognition
- **Multilingual Support**: English and French UI support with Google Translate integration
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
- **Google Translate API** - Real-time translation support
- **Axios** - HTTP client for API requests
- **React Native Reanimated** - Advanced animations
- **Lottie React Native** - Vector animations

### Backend
- **FastAPI** - High-performance API framework
- **PostgreSQL** - Production database
- **SQLAlchemy** - Database ORM
- **Pydantic** - Data validation and serialization
- **Stripe** - Payment processing
- **Uvicorn** - ASGI server
- **Passlib** - Password hashing
- **Python-Jose** - JWT token handling

### AI & ML
- **Scikit-learn** - Machine learning algorithms
- **Pandas** - Data manipulation and analysis

### Deployment & Infrastructure
- **Render** - Cloud hosting (Backend + PostgreSQL)
- **GitHub** - Version control and collaboration

---

## Quick Start

### Prerequisites

- **Node.js** (v24 or higher)
- **Python** (v3.13.5 or higher)
- **PostgreSQL** (v14 or higher)
- **Expo CLI** (`npm install -g @expo/cli`)

**To run the app, choose one of these options:**

**Option 1: Using Expo Go (Recommended for beginners)**
- **Physical iOS/Android device** with internet connection
- **Expo Go app** installed on your device:
  - iOS: [Download from App Store](https://apps.apple.com/app/expo-go/id982107779)
  - Android: [Download from Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

**Option 2: Using Simulators/Emulators (For development)**
- **iOS Simulator** (macOS only - included with Xcode)
- **Android Emulator** (Android Studio required)

### Database Setup

#### Local PostgreSQL Setup

1. **Install PostgreSQL**
   ```bash
   # macOS (using Homebrew)
   brew install postgresql
   brew services start postgresql
   
   # Windows - Download from https://www.postgresql.org/download/windows/
   # Linux (Ubuntu/Debian)
   sudo apt update && sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql
   ```

2. **Create Database and User**
   ```bash
   # Connect to PostgreSQL
   psql postgres
   
   # In PostgreSQL shell:
   CREATE DATABASE farmlink;
   CREATE USER admin WITH PASSWORD 'admin';
   GRANT ALL PRIVILEGES ON DATABASE farmlink TO admin;
   \q
   ```

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
   
   # Set up environment variables
   cp .env.example .env
   # Edit .env file with your database URL if different from default
   ```

3. **Set up the Frontend**
   ```bash
   cd ../frontend
   
   # Install dependencies
   npm install
   npx expo install --fix
   
   # Set up environment variables
   cp .env.example .env
   # Add your Google Translate API key if using translation features
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   
   # Activate virtual environment if not already active
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # (Optional) Seed database with test users and products
   # python seed_data.py
   # Note: The app works perfectly without seeded data - users can register normally
   
   # Run the FastAPI server
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   
   Backend will be available at: `http://localhost:8000`
   
   **Test Users** (only if you seeded the database):
   - **Individual**: individual@test.com (password: testing)
   - **Business**: business@test.com (password: testing)  
   - **Farmer**: farmer@test.com (password: testing)
   
   **Without seeding**: Users can register normally through the app

2. **Start the Frontend App**
   ```bash
   cd frontend
   
   # Start Expo development server
   npx expo start
   # If the above doesn't work, try:
   # npx expo start --tunnel
   ```

3. **Run the App**

   **Option A: Using Expo Go**
   1. Ensure your phone and computer are on the same network
   2. Open the Expo Go app on your phone
   3. Scan the QR code displayed in your terminal or browser
   4. The app will load automatically

   **Option B: Using Simulators/Emulators**
   - **iOS Simulator**: Press `i` in the terminal where Expo is running
   - **Android Emulator**: Press `a` in the terminal where Expo is running
   
   **Note**: Make sure your chosen simulator/emulator is already running before pressing the key.

### Environment Variables

**Frontend (.env.example):**
```bash
# API Configuration
# API_ENV options: local | remote
API_ENV=local
API_BASE_URL_LOCAL=http://localhost:8000
API_BASE_URL_REMOTE=https://farmlink-bmiy.onrender.com

# Payment Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
MERCHANT_IDENTIFIER=merchant.com.yourcompany.farmlink

# Expo Configuration
EXPO_PROJECT_ID=your_expo_project_id

# Translation (Optional)
GOOGLE_TRANSLATE_API_KEY=your_google_translate_api_key
```

**Backend (.env.example):**
```bash
# Database Configuration
DATABASE_URL=postgresql://admin:admin@localhost/farmlink

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# Platform Configuration
PLATFORM_FEE_PERCENTAGE=2.5
DELIVERY_FEE=75.0

# Database Seeding (Optional)
FORCE_SEED=false  # Set to true only for test/demo data
```

**Default Configuration**: The app will work out of the box with default values. Environment variables are optional unless you need specific configurations (payment processing, translation features, etc.).

---

## Database Schema

The application uses PostgreSQL with the following main entities:

- **Users**: Farmers, individual consumers, and businesses
- **Products**: Farm products with multiple unit pricing
- **Orders**: Unified order system with line items
- **Payments**: Stripe integration for secure transactions
- **Notifications**: Real-time updates and messaging

Tables are automatically created on first run. Use `python seed_data.py` to populate with test data.

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
│   ├── services/               # API services & translation
│   ├── types/                  # TypeScript type definitions
│   ├── utils/                  # Utility functions
│   ├── .env.example            # Environment variables template
│   ├── app.config.js           # Expo configuration
│   ├── tailwind.config.js      # Tailwind configuration
│   └── package.json            # Dependencies and scripts
├── backend/                    # FastAPI server
│   ├── core/                   # Core configuration & database
│   ├── models/                 # SQLAlchemy database models
│   ├── routes/                 # API routes
│   ├── schemas/                # Pydantic schemas
│   ├── services/               # Business logic
│   ├── main.py                 # FastAPI app entry point
│   ├── seed_data.py            # Database seeding
│   ├── requirements.txt        # Python dependencies
│   └── .env.example            # Environment variables template
└── .gitignore                  # Git ignore rules
```

---

## Deployment

### Backend Deployment (Render)

1. **Create PostgreSQL Database**
   - Add PostgreSQL database in Render dashboard
   - Note the internal database URL

2. **Deploy Backend**
   - Connect GitHub repository to Render
   - Set environment variables:
     ```bash
     DATABASE_URL=<render_postgresql_internal_url>
     STRIPE_SECRET_KEY=<your_stripe_secret_key>
     # FORCE_SEED=true  # Optional: Only if you want test/demo data
     ```
   - Deploy automatically on GitHub commits

### Frontend Deployment
```bash
cd frontend

# Android (free)
npx expo build:android

# iOS (requires paid Apple Developer account)
npx expo build:ios
```

**Production Environment**: Update `API_ENV=remote` in frontend environment variables to use the deployed backend.

---

## Translation Support

The app features **dual-layer translation support**:

### **Static UI Translation (Built-in)**
- **LanguageContext system** handles all static app text
- **English ↔ French** interface translation
- **No API required** - translations stored locally
- **Instant language switching** throughout the app
- **Covers**: Buttons, labels, navigation, form fields, error messages

### **Dynamic Content Translation (Google Translate API)**  
- **Real-time translation** of backend content
- **Smart caching** to minimize API usage and stay within free limits
- **Covers**: 
  - Product descriptions from farmers
  - Notification messages  
  - AI recommendation text
- **Optional**: App works fully without this - only backend content remains untranslated

**Setup**: Add `GOOGLE_TRANSLATE_API_KEY` to frontend environment variables to enable dynamic content translation.

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