# 📚 BookNook – Server

BookNook Server is the backend REST API for the BookNook online library platform. It is built with Express.js, TypeScript, and MongoDB to manage books, borrowing operations, user authorization, and profile image uploads.

## ✨ Features

- **Book Management:** Create, read, update, and delete books.
- **MongoDB Integration:** Store books, borrowing records, and profile image information.
- **JWT Authentication:** Verify authenticated users through Better Auth JWT tokens.
- **Protected APIs:** Restrict private operations to authenticated users.
- **User Authorization:** Allow users to manage only their own books and borrowing records.
- **Borrow Management:** Create borrowing records and manage book returns.
- **Available Copies:** Automatically decrease and increase available copies during borrowing and returning.
- **Duplicate Borrow Protection:** Prevent users from borrowing the same book more than once at a time.
- **Cloudinary Integration:** Upload and manage profile pictures.
- **Google Books API:** Retrieve external book information.
- **Input Validation:** Validate API parameters and request data.

## 🛠️ Technology Stack

- Node.js
- Express.js
- TypeScript
- MongoDB
- MongoDB Node.js Driver
- Better Auth JWT
- JOSE
- Cloudinary
- Multer
- dotenv
- CORS

## 📂 Project Structure

```text
booknook-server/
├── src/
│   ├── config/
│   │   └── db.ts
│   ├── middleware/
│   │   └── authMiddleware.ts
│   ├── routes/
│   │   ├── bookRoutes.ts
│   │   ├── borrowRoutes.ts
│   │   ├── googleBookRoutes.ts
│   │   └── profileRoutes.ts
│   ├── types/
│   │   ├── book.ts
│   │   ├── borrow.ts
│   │   └── express.d.ts
│   └── server.ts
├── package.json
├── tsconfig.json
└── README.md
```

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_SERVER_GITHUB_REPOSITORY_URL
```

### 2. Navigate to the Project

```bash
cd BookNook-Server
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root.

```env
PORT=5000

MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING

CLIENT_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000

CLOUDINARY_CLOUD_NAME=YOUR_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=YOUR_CLOUDINARY_API_SECRET

GOOGLE_BOOKS_API_KEY=YOUR_GOOGLE_BOOKS_API_KEY
```

Use the exact environment variable names required by your source code. Never commit `.env` or share your private credentials.

### 5. Run the Development Server

```bash
npm run dev
```

The backend will run at:

```text
http://localhost:5000
```

### 6. Build for Production

```bash
npm run build
```

Start the production server using the configured start script:

```bash
npm start
```

## 🔗 REST API Documentation

Base URL:

```text
http://localhost:5000
```

### Books API

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/books` | Get all books | Public |
| GET | `/books/:id` | Get a single book | Public |
| POST | `/books` | Add a new book | Protected |
| PATCH | `/books/:id` | Update a book | Protected |
| DELETE | `/books/:id` | Delete a book | Protected |

### Borrow API

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/borrows` | Borrow a book | Protected |
| GET | `/borrows` | Get user's borrow records | Protected |
| DELETE | `/borrows/:id` | Return a borrowed book | Protected |

### Additional API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check server health |
| GET | `/google-books` | Search external book information |
| GET | `/profile` | Get the user's custom profile image |
| POST | `/profile/avatar` | Upload a profile image |
| DELETE | `/profile/avatar` | Remove a custom profile image |

## 🔐 Authentication

Protected endpoints require a valid JWT token issued through Better Auth.

Include the token in the request header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

The server verifies the token using Better Auth's JWKS endpoint before allowing protected operations.

## 📦 Borrowing Logic

- Users can borrow only books with available copies.
- Available copies decrease by one after a successful borrow.
- A user cannot have two active borrow records for the same book.
- Returning a book increases its available copies by one.
- Users can access only their own borrowing records.

## 🚀 Deployment

The backend is designed to be deployed on Render.

1. Push the server code to GitHub.
2. Create a new Web Service on Render.
3. Connect the server repository.
4. Configure the build and start commands.
5. Add production environment variables.
6. Deploy the service.

## 👩‍💻 Developer

**Halima Chowdhury Mahima**

- GitHub: https://github.com/halima-chowdhury-mahima
- LinkedIn: https://linkedin.com/in/halima-chowdhury-mahima/

## 📄 License

This project was developed for educational and learning purposes.