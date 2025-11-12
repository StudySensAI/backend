import express from "express";
import env from "dotenv";
import cors from "cors";
import path from "path";

env.config();
const app = express();

app.use(express.json());


// const db = new pg.Client({
//   user: process.env.PG_USER,
//   host: process.env.PG_HOST,
//   database: process.env.PG_DATABASE,
//   password: process.env.PG_PASSWORD,
//   port: process.env.PG_PORT,
// });

// db.connect()
//   .then(() => console.log("Connected to PostgreSQL"))
//   .catch((err) => console.error("DB connection error:", err));


// middleware to handle CORS
app.use(cors({
  origin: process.env.CLIENT_URL , // your React app
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use("/api/v1/",);
app.use("/api/v1/", );
app.use("/api/v1/", );
app.use("/api/v1/",);

const port = process.env.PORT ||5000;



app.listen(port,()=>{console.log(`server is running on port ${port}` )});


