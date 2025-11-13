import express, { Application, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors, { CorsOptions } from "cors";
import path from "path";
import uploadRoutes from "./routes/uploadRoutes";

dotenv.config();

const app: Application = express();

// Middleware to parse JSON
app.use(express.json());

// ✅ Setup CORS configuration
const corsOptions: CorsOptions = {
  origin: process.env.CLIENT_URL || "*", // fallback for safety
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

app.use("/api/v1/uploads", uploadRoutes);
// app.use("/api/v1/auth", (req: Request, res: Response) => {
//   res.send("Auth route working");
// });

// app.use("/api/v1/dashboard", (req: Request, res: Response) => {
//   res.send("Dashboard route working");
// });

// app.use("/api/v1/users", (req: Request, res: Response) => {
//   res.send("Users route working");
// });

// ✅ Error handling middleware (optional but good practice)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.message);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
