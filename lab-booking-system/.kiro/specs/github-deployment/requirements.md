# Requirements Document

## Introduction

This document defines the requirements for deploying the Lab Booking System (Node.js/Express + sql.js SQLite backend with a static HTML frontend) to Render's free tier via a GitHub Actions CI/CD pipeline. The pipeline triggers automatically on push to `main`, and a Render persistent disk ensures the SQLite database survives restarts and redeploys.

## Glossary

- **CI_Pipeline**: The GitHub Actions workflow defined in `.github/workflows/deploy.yml`
- **Render_Service**: The Render web service hosting the Node.js application
- **Persistent_Disk**: The Render disk volume mounted at `/data` that stores the SQLite database file
- **Deploy_Hook**: The Render-provided HTTPS URL that triggers a new deployment when called
- **DB_Module**: The `db.js` module responsible for initialising and persisting the SQLite database
- **Server**: The `server.js` Express application entry point
- **render_yaml**: The `render.yaml` Infrastructure-as-Code file that defines the Render service
- **JWT_SECRET**: The environment variable used to sign and verify JSON Web Tokens

---

## Requirements

### Requirement 1: GitHub Actions CI/CD Pipeline

**User Story:** As a developer, I want a GitHub Actions workflow that automatically deploys the application on every push to `main`, so that I can ship changes without manual intervention.

#### Acceptance Criteria

1. WHEN a commit is pushed to the `main` branch that modifies files under `lab-booking-system/`, THE CI_Pipeline SHALL trigger automatically.
2. WHEN the CI_Pipeline runs, THE CI_Pipeline SHALL check out the repository code and set up Node.js 20.
3. WHEN the CI_Pipeline runs, THE CI_Pipeline SHALL install backend dependencies by running `npm ci` in the `lab-booking-system/backend` directory.
4. WHEN all CI_Pipeline steps succeed, THE CI_Pipeline SHALL trigger a Render deployment by sending an HTTP POST request to the Deploy_Hook URL stored in the `RENDER_DEPLOY_HOOK_URL` GitHub secret.
5. IF the Deploy_Hook request returns a non-2xx HTTP status, THEN THE CI_Pipeline SHALL mark the workflow as failed and halt further steps.
6. IF any CI_Pipeline step fails before the deploy step, THEN THE CI_Pipeline SHALL not trigger a Render deployment.

---

### Requirement 2: Render Service Definition

**User Story:** As a developer, I want a `render.yaml` file that declaratively defines the Render service, so that the hosting configuration is version-controlled and reproducible.

#### Acceptance Criteria

1. THE render_yaml SHALL define a web service with runtime `node`, root directory `lab-booking-system/backend`, build command `npm install`, and start command `node server.js`.
2. THE render_yaml SHALL declare the `NODE_ENV` environment variable with value `production`.
3. THE render_yaml SHALL declare the `JWT_SECRET` environment variable with `generateValue: true` so Render auto-generates a cryptographically random value on first deploy.
4. THE render_yaml SHALL declare the `DB_PATH` environment variable with value `/data/lab_booking.db`.
5. THE render_yaml SHALL declare a persistent disk named `lab-db` mounted at `/data` with a size of 1 GB.

---

### Requirement 3: Persistent Database Storage

**User Story:** As a system operator, I want the SQLite database to survive application restarts and redeploys, so that booking and user data is not lost.

#### Acceptance Criteria

1. WHEN the Render_Service starts, THE DB_Module SHALL read the database file from the path specified by the `DB_PATH` environment variable, falling back to the local directory path when `DB_PATH` is not set.
2. WHEN `DB_PATH` points to a file that already exists on the Persistent_Disk, THE DB_Module SHALL load the existing database rather than creating a new one.
3. WHEN `DB_PATH` points to a path where no file exists (first deploy), THE DB_Module SHALL create a new database, run schema migrations, seed initial data, and write the file to that path.
4. WHEN any write operation (INSERT, UPDATE, DELETE) completes, THE DB_Module SHALL persist the in-memory database to the file at `DB_PATH`.
5. IF the `DB_PATH` directory does not exist or is not writable, THEN THE Server SHALL log the error and exit with a non-zero status code.

---

### Requirement 4: Environment Variable Configuration

**User Story:** As a system operator, I want all sensitive and environment-specific values supplied via environment variables, so that no secrets are hardcoded in the repository.

#### Acceptance Criteria

1. THE Render_Service SHALL receive the `PORT` environment variable from Render's runtime injection and listen on that port.
2. THE Render_Service SHALL use the `JWT_SECRET` environment variable to sign and verify all JSON Web Tokens.
3. THE render_yaml SHALL configure `JWT_SECRET` with `generateValue: true` so the secret is never stored in the repository.
4. WHERE the `ADMIN_EMAIL` environment variable is set, THE Server SHALL use its value to identify the administrator account instead of a hardcoded email address.
5. WHERE the `ALLOWED_ORIGIN` environment variable is set, THE Server SHALL restrict CORS to that origin; otherwise THE Server SHALL allow all origins.

---

### Requirement 5: Security Hardening

**User Story:** As a security-conscious operator, I want the deployment to follow security best practices, so that the production service is not exposed to common vulnerabilities.

#### Acceptance Criteria

1. THE render_yaml SHALL use `generateValue: true` for `JWT_SECRET` so the signing key is cryptographically random and unique per service.
2. THE CI_Pipeline SHALL store the Deploy_Hook URL exclusively in the `RENDER_DEPLOY_HOOK_URL` GitHub Actions secret and SHALL NOT include it in any committed file.
3. THE Render_Service SHALL serve all traffic over HTTPS via Render's built-in TLS termination.
4. IF `JWT_SECRET` is absent at startup, THEN THE Server SHALL log a warning indicating that a weak fallback secret is in use.

---

### Requirement 6: Smoke Testing in CI

**User Story:** As a developer, I want the CI pipeline to verify the application starts correctly before deploying, so that broken builds are caught before they reach production.

#### Acceptance Criteria

1. WHEN the CI_Pipeline runs, THE CI_Pipeline SHALL start the Server process and wait for it to become ready.
2. WHEN the Server is ready, THE CI_Pipeline SHALL send an HTTP GET request to `http://localhost:3000/` and assert a 200 response.
3. IF the smoke test request fails or times out, THEN THE CI_Pipeline SHALL terminate the Server process, mark the step as failed, and SHALL NOT trigger the Deploy_Hook.
4. WHEN the smoke test completes (pass or fail), THE CI_Pipeline SHALL terminate the background Server process.

---

### Requirement 7: Post-Deploy Verification

**User Story:** As a developer, I want the CI pipeline to confirm the Render service is live after deployment, so that I know the deploy succeeded end-to-end.

#### Acceptance Criteria

1. WHEN the Deploy_Hook is triggered successfully, THE CI_Pipeline SHALL poll the Render service's public URL until it returns a 200 response or a 2-minute timeout elapses.
2. IF the Render service does not respond with 200 within 2 minutes, THEN THE CI_Pipeline SHALL mark the post-deploy verification step as failed.
3. WHEN the Render service responds with 200, THE CI_Pipeline SHALL mark the workflow as successful.

---

### Requirement 8: Database Initialisation and Schema

**User Story:** As a developer, I want the database schema and seed data to be applied automatically on first deploy, so that the application is immediately usable without manual setup.

#### Acceptance Criteria

1. WHEN the DB_Module initialises on a fresh Persistent_Disk, THE DB_Module SHALL create the `users`, `equipment`, and `bookings` tables using `CREATE TABLE IF NOT EXISTS` statements.
2. WHEN the schema is created, THE DB_Module SHALL insert default seed users (admin, faculty, student) and sample equipment records if no users exist.
3. WHEN the DB_Module initialises on a Persistent_Disk that already contains data, THE DB_Module SHALL not re-run seed data insertion.
4. THE DB_Module SHALL expose `init`, `run`, `all`, `get`, `lastId`, and `persist` functions for use by route handlers.
