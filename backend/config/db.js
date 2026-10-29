import mongoose from "mongoose";

async function connectDB() {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error("MONGODB_URI is missing");
  }

  await mongoose.connect(mongoURI);
  console.log("MongoDB connected successfully");
}

export default connectDB;