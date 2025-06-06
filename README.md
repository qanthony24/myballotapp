# MyBallot App

A web application for East Baton Rouge Parish voters to find candidate information, compare candidates, build a personal ballot, and get election details. Powered by Gemini for Q&A.

## Features

- Candidate listings and profiles (filterable by election, office, party)
- Side-by-side candidate comparison for specific races (office & district)
- Personalized ballot building, saved locally per election
- View past election results alongside your archived ballot choices
- Ballot measure information (details, explanations, pro/con) and stance tracking
- Election information (key dates, polling place links)
- Q&A with Gemini AI for election-related questions
- Vote reminders (for early voting or election day) with location selection and calendar integration details.

## Setup and Running

1.  **Clone the repository.**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Environment Variables:**
    *   This project uses the Google Gemini API for its Q&A feature. You will need an API key.
    *   Create a `.env` file in the root of the project by copying the `.env.example` file:
        ```bash
        cp .env.example .env
        ```
    *   Open the `.env` file and replace `YOUR_GEMINI_API_KEY_HERE` with your actual Google Gemini API key.
        ```env
        API_KEY="your_actual_gemini_api_key"
        ```
    *   **Note for Browser-Based Development:** The `index.html` file includes a script to mock `process.env.API_KEY` if it's not set (e.g., during simple local server hosting without a build process that injects environment variables). For development convenience, you can temporarily replace `'YOUR_GEMINI_API_KEY'` directly in that script in `index.html`.
        **However, this is not secure for production. In a real deployment, the API key must be managed securely and not hardcoded in client-side files.** This application context assumes `process.env.API_KEY` will be made available in the execution environment where the Gemini client is initialized.

3.  **Serve the `index.html` file.**
    *   You can use any simple HTTP server. If you have Node.js, you can use `serve` (install globally via `npm install -g serve` or use `npx serve .`):
        ```bash
        npx serve .
        ```
    *   Open your browser to the address provided by the server (e.g., `http://localhost:3000` or `http://localhost:5000`).

## Project Structure

-   `index.html`: Main HTML entry point. Sets up Tailwind CSS, the importmap for ES modules, and includes the main script.
-   `index.tsx`: Root React script that renders the main `App` component.
-   `App.tsx`: Main application component, handles routing and global layout structure (Header, Navbar).
-   `types.ts`: Contains all TypeScript type definitions and interfaces used across the application.
-   `constants.ts`: Holds static data like candidate lists, office details, survey questions, mock election results, and ballot measures. Also includes utility functions related to this data.
-   `metadata.json`: Contains metadata for the application, including its name, description, and permissions requests if any.
-   `components/`: Directory for reusable UI components, further organized into subdirectories like:
    -   `candidates/`: Components related to displaying candidates (e.g., `CandidateCard`, `FilterControls`).
    -   `election/`: Components for displaying election-specific information (e.g., `ElectionResultsDisplay`).
    -   `layout/`: Components for the overall page structure (e.g., `Header`, `Navbar`, `Footer`).
    -   `reminders/`: Components for the vote reminder system (e.g., `ReminderSetupModal`).
    -   `ui/`: General-purpose UI elements (e.g., `Modal`, `LoadingSpinner`).
-   `hooks/`: Custom React hooks, such as `useBallot.ts` for managing ballot state and interactions.
-   `pages/`: Top-level components that represent different views/pages of the application (e.g., `HomePage.tsx`, `CandidateProfilePage.tsx`).
-   `services/`: Modules for data access and business logic, primarily `dataService.ts` for retrieving and processing data from `constants.ts`. `geminiService.ts` is a placeholder for more complex Gemini API interactions.
-   `.env.example`: Example file for environment variables.

## Absolute Imports

This project is configured to use absolute-style imports for local modules, resolved from the project root. This is managed via an `importmap` in `index.html`.
This means that instead of relative paths like `../../hooks/useBallot`, you can use paths like `hooks/useBallot`.

Examples:
- `import HomePage from 'pages/HomePage';`
- `import CandidateCard from 'components/candidates/CandidateCard';`
- `import { useBallot } from 'hooks/useBallot';`
- `import { getCandidateById } from 'services/dataService';`
- `import { Candidate } from 'types';`
- `import { OFFICES_DATA } from 'constants';`
