# CloudyBreeze

A premium e-commerce platform specializing in modern humidifiers and aroma diffusers.

Built with Node.js, Express, Supabase, and vanilla frontend technologies.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

CloudyBreeze is a fully functional e-commerce store designed for selling humidifiers and aroma diffusers. The platform supports guest checkout, comprehensive product management, order tracking, analytics, and a full administrative dashboard.

The system follows a strict separation of concerns: the backend serves as the exclusive intermediary between the frontend and all Supabase services (database, storage, authentication).

---

## Features

### Customer-Facing
- Browse products with category filtering and search
- Product detail pages with variant selection (color, size, capacity)
- Shopping cart (localStorage-based)
- Guest checkout with order tracking
- Contact form and newsletter subscription
- Fully responsive design
- Fast, framework-free frontend

### Admin Dashboard
- Secure login via Supabase Auth
- Product management (CRUD, image uploads, variants)
- Category management
- Order management with status updates
- Analytics dashboard (visitors, revenue, geography, devices)
- Store settings configuration
- Contact message and newsletter subscriber management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express.js |
| **Database** | Supabase PostgreSQL |
| **Storage** | Supabase Storage |
| **Authentication** | Supabase Auth |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Libraries** | multer, helmet, cors, morgan, express-validator, express-rate-limit |

No React, Vue, Angular, Bootstrap, Tailwind, or jQuery.

---

## Prerequisites

- **Node.js** v20.x or later
- **npm** v10.x or later
- **Supabase Account** (free tier or higher)
- **Git** (for version control)

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd CloudyBreeze