
import dotenv from "dotenv";

import connectDB from "./db/dbIndex.js";

dotenv.config({
    path: "./.env"
});

connectDB();