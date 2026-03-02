# Energy Sharing Platform - Comprehensive Technical Documentation

## 1. Overview

### Project Purpose
The Energy Sharing Platform (branded as "Power Cred") is a comprehensive web application designed to facilitate energy sharing, trading, and financing in developing markets, with a particular focus on Uganda. The platform enables users to share electricity units between meters, purchase energy units, apply for energy loans based on credit scoring, and manage their energy consumption.

### Primary Purpose
The system addresses energy access challenges in developing regions by creating a peer-to-peer energy sharing ecosystem with integrated financial services. It allows users with excess electricity to share it with those in need, while providing financing options for energy purchases through a sophisticated credit scoring system.

### Real-World Problem
In many developing regions, particularly in East Africa, energy access is inconsistent and expensive. Many households experience energy poverty despite being connected to the grid due to inability to afford regular purchases. This platform solves this problem by:
1. Enabling peer-to-peer energy sharing between users
2. Providing micro-loans specifically for energy purchases
3. Creating a credit scoring system based on energy usage patterns
4. Integrating with mobile money systems common in these regions

### Type of Application
This is a full-stack web application with:
- Django REST API backend
- Next.js frontend
- PostgreSQL database
- Integration with external services (MTN Mobile Money)
- IoT integration with ESP32-based smart meters

### Architecture Pattern
The application follows a layered architecture with clear separation of concerns:
- Backend: Django REST API with modular apps
- Frontend: Next.js with component-based architecture
- Database: PostgreSQL with relational data model
- Authentication: JWT-based token authentication
- Background Processing: Celery with Redis for asynchronous tasks

### Main Technologies
- **Backend**:
  - Django 6.0 - Web framework
  - Django REST Framework - API development
  - PostgreSQL - Database
  - Celery - Asynchronous task processing
  - Redis - Caching and message broker
  - JWT - Authentication

- **Frontend**:
  - Next.js 16 - React framework
  - React 19 - UI library
  - TypeScript - Type-safe JavaScript
  - Tailwind CSS - Utility-first CSS framework
  - Redux Toolkit - State management
  - Radix UI - Component primitives
  - Three.js - 3D visualizations

### Component Interaction
The system components interact as follows:
1. Users interact with the Next.js frontend
2. Frontend makes API calls to the Django backend
3. Backend processes requests, interacts with the database, and returns responses
4. Background tasks (payments, notifications) are handled by Celery workers
5. External integrations (mobile money, meters) are managed through webhooks and API calls
6. Real-time meter data is collected from ESP32 devices via API endpoints

## 2. Directory and File Structure Analysis

### Root Directory
- **backend/** - Contains the Django backend application
- **frontend/** - Contains the Next.js frontend application
- **.idea/** - IDE configuration files (PyCharm/IntelliJ)
- **Readme.md** - Basic setup instructions

### Backend Directory
The backend follows a standard Django project structure with modular apps:

- **backend/backend/** - Main Django project configuration
  - **settings.py** - Project settings including database, authentication, and third-party integrations
  - **urls.py** - Main URL routing configuration
  - **api1.py** - API v1 endpoint definitions
  - **wsgi.py** - WSGI application entry point

- **backend/accounts/** - User account management
  - **models.py** - User model, profile, wallet, and loan-related models
  - **managers.py** - Custom user manager for email-based authentication
  - **api/** - API endpoints for authentication and user management

- **backend/meter/** - Energy meter management
  - **models.py** - Meter and token models
  - **api/** - API endpoints for meter registration and management

- **backend/share/** - Energy sharing functionality
  - **models.py** - Share transaction and transfer request models
  - **urls.py** - URL routing for sharing endpoints

- **backend/loan/** - Energy loan management
  - **models.py** - Loan application, disbursement, and repayment models

- **backend/transactions/** - Financial transaction management
  - **models.py** - Transaction models for financial operations

- **backend/wallet/** - Digital wallet functionality
  - **urls.py** - URL routing for wallet operations

- **backend/mtn_momo/** - MTN Mobile Money integration
  - Integration with MTN's payment API for Uganda

- **backend/webhooks/** - External service integration
  - Webhook endpoints for payment callbacks and notifications

- **backend/utils/** - Utility functions and helpers
  - Common functionality used across the application

- **backend/admin/** - Custom admin interface
  - Enhanced Django admin functionality

- **backend/transfer/** - Energy transfer functionality
  - Handles transfers between meters

### Frontend Directory
The frontend follows a modern Next.js application structure:

- **frontend/src/app/** - Next.js App Router pages and layouts
  - **(authentication)/** - Authentication-related pages (login, signup)
  - **(dashboard)/** - User dashboard and features
    - **dashboard/** - Main dashboard page and components
    - **buy-units/** - Energy unit purchase functionality
    - **myaccount/** - Account management
    - **myloans/** - Loan management
    - **request-loan/** - Loan application
    - **share/** - Energy sharing functionality
    - **tokens/** - Token management
    - **transactions/** - Transaction history
    - **transfering/** - Energy transfer functionality

- **frontend/src/components/** - Reusable UI components
  - Form components, buttons, cards, etc.

- **frontend/src/lib/** - Utility functions and libraries
  - **fetch.ts** - API communication utilities
  - **authenticated.ts** - Authentication helpers
  - **account.ts** - Account management utilities

- **frontend/src/redux/** - Redux state management
  - Store configuration, slices, and reducers

- **frontend/src/hooks/** - Custom React hooks
  - Reusable logic for components

- **frontend/src/interface/** - TypeScript interfaces
  - Type definitions for the application

- **frontend/src/styles/** - CSS and styling
  - Global styles and Tailwind configuration

## 3. Function-Level Analysis

### Backend Functions

#### `get_env_variable` (backend/backend/settings.py)
- **Purpose**: Retrieves environment variables with type casting and validation
- **Inputs**: Variable name, default value, and cast function
- **Outputs**: The environment variable value cast to the specified type
- **Logic**: Attempts to retrieve the variable, raises an exception if missing and no default provided, casts to the specified type

#### `generate_secure_random_int` (backend/accounts/models.py)
- **Purpose**: Generates a secure random integer for various security purposes
- **Inputs**: Upper bound for the random number
- **Outputs**: A random integer between 0 and the upper bound
- **Logic**: Uses Python's random module to generate a secure random integer

#### `generate_random_string` (backend/accounts/models.py, backend/meter/models.py)
- **Purpose**: Generates a random string for IDs, tokens, etc.
- **Inputs**: Length of the string to generate
- **Outputs**: A random string of the specified length
- **Logic**: Uses a character set excluding potentially confusing characters ('i', 'O')

#### `User.tokens` (backend/accounts/models.py)
- **Purpose**: Generates JWT tokens for user authentication
- **Inputs**: None (uses self)
- **Outputs**: Dictionary with refresh and access tokens
- **Logic**: Uses RefreshToken.for_user to generate tokens for the user

#### `User.has_complete_profile` (backend/accounts/models.py)
- **Purpose**: Checks if a user has completed all required profile fields
- **Inputs**: None (uses self)
- **Outputs**: Boolean indicating profile completion status
- **Logic**: Checks if all required fields have values

#### `Wallet.add_funds` (backend/accounts/models.py)
- **Purpose**: Adds funds to a user's wallet
- **Inputs**: Transaction object
- **Outputs**: None (updates wallet balance)
- **Logic**: Adds transaction amount to wallet balance, creates a log entry

#### `Wallet.deduct_funds` (backend/accounts/models.py)
- **Purpose**: Deducts funds from a user's wallet
- **Inputs**: Amount to deduct
- **Outputs**: None (updates wallet balance)
- **Logic**: Validates sufficient balance, deducts amount from wallet

#### `LoanApplication.check_eligibility` (backend/loan/models.py)
- **Purpose**: Determines if a user is eligible for a loan
- **Inputs**: None (uses self)
- **Outputs**: Boolean indicating eligibility
- **Logic**: Checks user's credit score and other eligibility criteria

#### `LoanApplication.calculate_units_from_amount` (backend/loan/models.py)
- **Purpose**: Converts a loan amount to energy units
- **Inputs**: Optional amount (defaults to loan amount)
- **Outputs**: Number of energy units
- **Logic**: Uses tariff blocks to calculate units based on pricing tiers

### Frontend Functions

#### `getInitialData` (frontend/src/app/(dashboard)/dashboard/page.tsx)
- **Purpose**: Fetches initial data for the dashboard
- **Inputs**: None
- **Outputs**: User configuration, setup step, meter status, profile status
- **Logic**: Makes API calls to fetch user data, meter status, and profile status

#### `DashboardClient` (frontend/src/app/(dashboard)/dashboard/dashboard-client.tsx)
- **Purpose**: Main dashboard component with setup flow
- **Inputs**: Initial step, user config, meter status, profile status
- **Outputs**: Rendered dashboard UI
- **Logic**: Manages setup flow for new users, renders appropriate UI based on user state

#### `getHeaders` (frontend/src/lib/fetch.ts)
- **Purpose**: Prepares headers for API requests
- **Inputs**: None
- **Outputs**: Headers object with authentication token
- **Logic**: Retrieves auth cookie, adds it to headers if present

#### `post`, `get`, `patch` (frontend/src/lib/fetch.ts)
- **Purpose**: Make API requests to the backend
- **Inputs**: Path and data (for POST/PATCH)
- **Outputs**: Response data and error information
- **Logic**: Makes fetch requests to the API, handles errors and response parsing

## 4. Class-Level Analysis

### Backend Classes

#### `User` (backend/accounts/models.py)
- **Responsibility**: Represents a user in the system
- **Attributes**: Email, phone number, user role, gender, energy consumption data, loan assessment fields
- **Methods**: tokens, has_complete_profile, is_verified, is_admin, is_client
- **Inheritance**: Extends Django's AbstractUser and TimestampMixin
- **Relationships**: One-to-many with devices, transactions, etc.

#### `Wallet` (backend/accounts/models.py)
- **Responsibility**: Manages a user's financial balance
- **Attributes**: Wallet ID, user, currency, balance
- **Methods**: add_funds, deduct_funds, get_logging_context, total_earnings
- **Inheritance**: Extends TimestampMixin
- **Relationships**: Belongs to a User, has many transactions

#### `Meter` (backend/meter/models.py)
- **Responsibility**: Represents a physical energy meter
- **Attributes**: Meter number, static IP, user, units
- **Methods**: String representation
- **Inheritance**: Extends TimestampMixin
- **Relationships**: Belongs to a User, has many tokens

#### `MeterToken` (backend/meter/models.py)
- **Responsibility**: Represents a token for loading units onto a meter
- **Attributes**: Token, units, meter, is_used, source
- **Methods**: String representation
- **Inheritance**: Extends TimestampMixin
- **Relationships**: Belongs to a User and a Meter

#### `ShareTransaction` (backend/share/models.py)
- **Responsibility**: Tracks energy sharing between users
- **Attributes**: Transaction ID, sender, receiver, units, meters, status
- **Methods**: String representation
- **Inheritance**: Extends TimestampMixin
- **Relationships**: Links two Users and two Meters

#### `LoanApplication` (backend/loan/models.py)
- **Responsibility**: Manages energy loan applications
- **Attributes**: User, amount, credit score, status, etc.
- **Methods**: check_eligibility, calculate_units_from_amount, calculate_cost_for_units
- **Inheritance**: Extends TimeStampedModel
- **Relationships**: Belongs to a User, has many repayments

### Frontend Classes/Components

#### `DashboardPage` (frontend/src/app/(dashboard)/dashboard/page.tsx)
- **Responsibility**: Server component for the dashboard page
- **Attributes**: None
- **Methods**: getInitialData, DashboardContent
- **Relationships**: Renders DashboardClient

#### `DashboardClient` (frontend/src/app/(dashboard)/dashboard/dashboard-client.tsx)
- **Responsibility**: Client component for interactive dashboard
- **Attributes**: initialStep, userConfig, userHasMeter, userHasProfile
- **Methods**: handleMeterSuccess, handleProfileSuccess, etc.
- **Relationships**: Uses various dashboard components

## 5. Execution Flow Analysis

### User Registration and Setup
1. User visits the application and signs up with email and phone number
2. Backend creates a User record with default CLIENT role
3. User is redirected to the dashboard with setup flow
4. User is prompted to register a meter (MeterRegistrationPopup)
5. After meter registration, user is prompted to complete profile (UserProfilePopup)
6. Once setup is complete, user sees the full dashboard

### Energy Purchase Flow
1. User navigates to the buy-units section
2. User selects amount and payment method
3. Frontend makes API call to initiate purchase
4. Backend creates a Transaction record
5. If using mobile money, MTN MOMO API is called
6. On successful payment, a MeterToken is generated
7. User receives the token to load onto their meter

### Energy Sharing Flow
1. User navigates to the share section
2. User selects recipient and amount to share
3. Frontend makes API call to initiate sharing
4. Backend validates the request (sufficient units, rate limits)
5. Backend creates a ShareTransaction record
6. Units are deducted from sender's meter
7. Units are added to recipient's meter
8. Both users receive notifications

### Loan Application Flow
1. User navigates to the request-loan section
2. System checks user's credit score based on profile data
3. User selects loan amount within eligible range
4. Frontend makes API call to submit application
5. Backend creates a LoanApplication record
6. Admin reviews the application (or automatic approval for high scores)
7. On approval, a LoanDisbursement record is created
8. MeterToken is generated for the loan amount
9. Repayment schedule is created

## 6. Data Flow Analysis

### Data Entry Points
1. **User Registration**: Email, phone number, personal details
2. **Meter Registration**: Meter number, static IP
3. **Profile Completion**: Income, consumption patterns, payment history
4. **Purchase Requests**: Amount, payment method
5. **Sharing Requests**: Recipient, amount
6. **Loan Applications**: Amount, purpose

### Data Processing
1. **Authentication**: JWT tokens for secure API access
2. **Credit Scoring**: Profile data analyzed for loan eligibility
3. **Transaction Processing**: Financial transactions validated and recorded
4. **Energy Conversion**: Money converted to energy units based on tariffs
5. **Notification Generation**: Events trigger notifications

### Data Storage
1. **User Data**: PostgreSQL database (User model)
2. **Financial Data**: PostgreSQL database (Wallet, Transaction models)
3. **Energy Data**: PostgreSQL database (Meter, MeterToken models)
4. **Loan Data**: PostgreSQL database (LoanApplication, LoanRepayment models)

### External Data Flows
1. **Mobile Money**: Integration with MTN MOMO API
2. **Meter Communication**: API calls to/from ESP32 devices
3. **Email Notifications**: SMTP for email delivery

## 7. Dependency Analysis

### Backend Dependencies
- **Django (6.0)**: Core web framework
- **Django REST Framework (3.16.1)**: API development
- **djangorestframework_simplejwt (5.5.1)**: JWT authentication
- **Celery (5.6.0)**: Asynchronous task processing
- **Redis (7.1.0)**: Caching and message broker
- **psycopg2-binary (2.9.11)**: PostgreSQL adapter
- **django-cors-headers (4.9.0)**: CORS handling
- **django-phonenumber-field (8.4.0)**: Phone number validation
- **drf-yasg (1.21.11)**: API documentation
- **python-decouple (3.8)**: Environment variable management
- **requests (2.32.5)**: HTTP client for external APIs

### Frontend Dependencies
- **Next.js (16.0.10)**: React framework
- **React (19.2.1)**: UI library
- **TypeScript (5)**: Type-safe JavaScript
- **Redux Toolkit (2.11.1)**: State management
- **Axios (1.13.2)**: HTTP client
- **Tailwind CSS (4)**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **React Hook Form (7.68.0)**: Form state management
- **Zod (4.1.13)**: Schema validation
- **Three.js (0.182.0)**: 3D graphics library
- **SWR (2.3.7)**: Data fetching and caching
- **JWT Decode (4.0.0)**: JWT parsing

## 8. Configuration Analysis

### Environment Variables
- **DEBUG**: Controls debug mode
- **SECRET_KEY**: Django secret key
- **DATABASE_URL**: PostgreSQL connection string
- **REDIS_HOST/PORT**: Redis connection details
- **EMAIL_HOST/PORT/USER/PASSWORD**: Email configuration
- **CELERY_BROKER_URL**: Celery broker URL
- **MTN_MOMO_CONFIG**: Mobile money API configuration

### Django Settings
- **AUTH_USER_MODEL**: Custom user model (accounts.User)
- **REST_FRAMEWORK**: DRF configuration with JWT authentication
- **CORS_ALLOWED_ORIGINS**: Frontend origins for CORS
- **DATABASES**: PostgreSQL configuration
- **CELERY_TIMEZONE**: Set to 'Africa/Nairobi'
- **SHARE_RATE_LIMIT**: 10 shares per hour per user
- **IP_SHARE_RATE_LIMIT**: 50 shares per hour per IP
- **MINIMUM_SHARE_UNITS**: 2 units
- **MAXIMUM_SHARE_UNITS**: 1000 units

### Next.js Configuration
- **API_URL**: Backend API endpoint
- **AUTHENTICATION_COOKIE**: JWT cookie name
- **next.config.ts**: Next.js build configuration
- **tsconfig.json**: TypeScript configuration

## 9. System Architecture Summary

### Components
1. **User Management**: Authentication, profiles, roles
2. **Meter Management**: Registration, monitoring, tokens
3. **Energy Sharing**: Peer-to-peer unit transfers
4. **Financial System**: Wallets, transactions, mobile money
5. **Loan System**: Applications, credit scoring, disbursements
6. **Admin Interface**: User management, loan approvals

### Responsibilities
1. **Backend**: Data storage, business logic, API endpoints
2. **Frontend**: User interface, data presentation, form handling
3. **Database**: Persistent storage of all system data
4. **Celery**: Asynchronous and scheduled tasks
5. **Redis**: Caching and message queue

### Interactions
1. **User → Frontend → Backend → Database**: Data flow for user actions
2. **Backend → External Services**: Mobile money, email
3. **Backend → IoT Devices**: Meter communication
4. **Celery → Backend**: Background processing

### Control Flow
1. **Authentication**: JWT-based with refresh tokens
2. **Authorization**: Role-based access control
3. **Validation**: Input validation at both frontend and backend
4. **Error Handling**: Structured error responses

### Data Flow
1. **User Input → Frontend Validation → API Request → Backend Validation → Database**
2. **Database → Backend → API Response → Frontend → User Display**
3. **Events → Celery Tasks → Background Processing → Database Updates → Notifications**

## 10. Simplified Explanation

The Power Cred platform is an innovative solution that helps people in developing countries like Uganda share and finance electricity. Think of it as a combination of Venmo and a micro-loan service, but specifically for electricity.

Here's how it works:

1. **Users register** with their email and phone number, then connect their electricity meter to the system.

2. **Energy sharing**: If you have extra electricity units, you can share them with friends, family, or neighbors who need them. The system transfers the units directly between meters.

3. **Energy loans**: If you need electricity but can't afford it right now, you can apply for a small loan specifically to buy electricity units. The system checks your payment history and energy usage patterns to determine if you qualify.

4. **Mobile money integration**: You can pay for electricity or repay loans using mobile money services like MTN Mobile Money, which are widely used in Uganda.

5. **Smart meter connection**: The system connects to your electricity meter to track usage and apply shared or purchased units.

The platform solves a real problem in regions where electricity access is inconsistent and expensive. By enabling sharing and providing micro-loans specifically for energy, it helps ensure more people have access to electricity even when they're facing financial challenges.

The technology behind it is sophisticated, using modern web development frameworks (Django and Next.js), but the user experience is designed to be simple and accessible, even for users with limited technical knowledge.